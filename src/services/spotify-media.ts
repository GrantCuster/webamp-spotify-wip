import { SpotifyService, SpotifyPlayerState } from "./spotify";

// Simple emitter implementation
class Emitter {
  private _listeners: { [event: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  trigger(event: string, ...args: any[]): void {
    const listeners = this._listeners[event];
    if (listeners) {
      listeners.forEach((callback) => callback(...args));
    }
  }

  dispose(): void {
    this._listeners = {};
  }
}

export enum STATUS {
  PLAYING,
  PAUSED,
  STOPPED,
}

export class SpotifyMedia {
  private _emitter: Emitter;
  private _spotifyService: SpotifyService;
  private _timeElapsed: number = 0;
  private _duration: number = 0;
  private _timeInterval: number | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _status: STATUS = STATUS.STOPPED;
  private _context: AudioContext;
  private _analyser: AnalyserNode;
  private _allowControl: boolean = false;
  private _currentTrackId: string | null = null;
  private _queue: string[] = [];
  private _contextUri: string | null = null;

  constructor(spotifyService: SpotifyService) {
    this._emitter = new Emitter();
    this._spotifyService = spotifyService;

    // Create audio context for analyser (required by Webamp)
    this._context = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    this._analyser = this._context.createAnalyser();
    this._analyser.fftSize = 2048;

    // Delay subscription and control to allow Webamp to initialize first
    setTimeout(() => {
      this._unsubscribe = this._spotifyService.onStateChange((state) => {
        this._handleSpotifyStateChange(state);
      });
      // Allow control after Webamp is set up
      this._allowControl = true;
    }, 1000);
  }

  private _handleSpotifyStateChange(state: SpotifyPlayerState): void {
    // Update duration - only if we have a valid track
    if (state.currentTrack && state.duration_ms > 0) {
      this._duration = state.duration_ms / 1000;
    }

    // Update time elapsed from Spotify's progress
    if (state.progress_ms >= 0) {
      this._timeElapsed = state.progress_ms / 1000;
    }

    console.log("SpotifyMedia detected state change:", {
      isPlaying: state.isPlaying,
      currentTrackId: state.currentTrack ? state.currentTrack.id : null,
      progress_ms: state.progress_ms,
      duration_ms: state.duration_ms,
    });

    // Handle play/pause state changes from external sources (e.g., Spotify app)
    if (state.isPlaying && this._status !== STATUS.PLAYING) {
      this._resumeTimer();
    } else if (!state.isPlaying && this._status === STATUS.PLAYING) {
      this._stopTimer();
      this._status = STATUS.PAUSED;
    }

    // Always emit timeupdate so Webamp can refresh the display
    this._emitter.trigger("timeupdate");
  }

  private _stopTimer(): void {
    if (this._timeInterval) {
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    }
  }

  private _resumeTimer(): void {
    if (this._timeInterval) return;

    this._timeInterval = window.setInterval(() => {
      if (this._status === STATUS.PLAYING) {
        this._timeElapsed += 1;
        if (this._timeElapsed > this._duration) {
          this._timeElapsed = this._duration;
        }
        this._emitter.trigger("timeupdate");
      }
    }, 1000);

    this._emitter.trigger("playing");
    this._emitter.trigger("timeupdate");
    this._status = STATUS.PLAYING;
  }

  // Getters - using arrow functions as in reference
  duration = () => this._duration;
  timeElapsed = () => this._timeElapsed;
  timeRemaining = () => Math.max(0, this._duration - this._timeElapsed);
  percentComplete = () => {
    if (this._duration <= 0) return 0;
    return Math.min(100, (this._timeElapsed / this._duration) * 100);
  };

  // Actions triggered by Webamp's buttons
  async play() {
    this._spotifyService.play();
    this._resumeTimer();
  }

  async pause() {
    console.log(
      "SpotifyMedia.pause() called, _allowControl:",
      this._allowControl,
      "_status:",
      this._status,
    );
    // if (!this._allowControl) return;
    // // Webamp's pause button acts as toggle
    if (this._status === STATUS.PLAYING) {
      console.log("-> pausing spotify");
      await this._spotifyService.pause();
      this._stopTimer();
      this._status = STATUS.PAUSED;
    } else if (
      this._status === STATUS.PAUSED ||
      this._status === STATUS.STOPPED
    ) {
      console.log("-> resuming spotify");
      await this._spotifyService.play();
      this._resumeTimer();
    }
  }

  // async stop() {
  //   console.log(
  //     "SpotifyMedia.stop() called, _allowControl:",
  //     this._allowControl,
  //   );
  //   // if (!this._allowControl) return;
  //   // console.log("-> stopping spotify");
  //   // await this._spotifyService.pause();
  //   // this._stopTimer();
  //   // this._status = STATUS.STOPPED;
  //   // this._timeElapsed = 0;
  //   // this._emitter.trigger("timeupdate");
  // }

  // i don't think these actually get used
  async next() {
    console.log(
      "SpotifyMedia.next() called, _allowControl:",
      this._allowControl,
    );
  }
  async previous() {
    console.log(
      "SpotifyMedia.previous() called, _allowControl:",
      this._allowControl,
    );
  }

  async seekToPercentComplete(percent: number) {
    if (!this._allowControl) return;
    const seekTime = this._duration * (percent / 100);
    await this._spotifyService.seek(seekTime * 1000);
    this._timeElapsed = seekTime;
    this._emitter.trigger("timeupdate");
  }

  // Listeners
  on(event: string, callback: (...args: any[]) => void): void {
    this._emitter.on(event, callback);
  }

  // Methods that don't work with Spotify - using arrow functions
  stop = () => {};
  getAnalyser = () => this._analyser;
  setVolume = (_volume: number) => {};
  setBalance = (_balance: number) => {};
  setPreamp = (_value: number) => {};
  setEqBand = (_band: any, _value: number) => {};
  disableEq = () => {};
  enableEq = () => {};

  // Set track context so we can detect next/prev actions
  setTrackContext(
    currentId: string | null,
    queue: string[],
    contextUri: string | null = null,
  ) {
    this._currentTrackId = currentId;
    this._queue = queue;
    this._contextUri = contextUri;
  }

  async loadFromUrl(url: string): Promise<void> {
    if (!url || url === this._currentTrackId) return;

    // Check if this is a next or previous track request
    if (url === this._queue[0]) {
      console.log("-> Detected NEXT track request, calling nextTrack()");
      await this._spotifyService.nextTrack();
    } else {
      // Play the track within its context (album/playlist) to preserve queue
      console.log(
        "-> Detected direct track load, calling playTrack() with context:",
        this._contextUri,
      );
      await this._spotifyService.playTrack(url, this._contextUri);
    }
  }

  dispose(): void {
    this._stopTimer();
    if (this._unsubscribe) {
      this._unsubscribe();
    }
    this._emitter.dispose();
  }
}
