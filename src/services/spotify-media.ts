import { IMedia } from "webamp";
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

export class SpotifyMedia implements IMedia {
  private _emitter: Emitter;
  private _spotifyService: SpotifyService;
  private _timeElapsed: number = 0;
  private _duration: number = 0;
  private _isPlaying: boolean = false;
  private _timeInterval: number | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _allowSpotifyControl: boolean = false;
  private _controlTimeout: number | null = null;

  constructor(spotifyService: SpotifyService) {
    this._emitter = new Emitter();
    this._spotifyService = spotifyService;

    // Subscribe to Spotify state changes
    this._unsubscribe = this._spotifyService.onStateChange((state) => {
      this._handleSpotifyStateChange(state);
    });

    // After a short delay, allow Spotify control (after Webamp initialization)
    this._controlTimeout = window.setTimeout(() => {
      this._allowSpotifyControl = true;
    }, 2000);
  }

  private _handleSpotifyStateChange(state: SpotifyPlayerState): void {
    // Update duration
    if (state.currentTrack) {
      this._duration = state.duration_ms / 1000; // Convert to seconds
    } else {
      this._duration = 0;
    }

    // Update time elapsed from Spotify's progress
    this._timeElapsed = state.progress_ms / 1000;

    // Update playing state
    const wasPlaying = this._isPlaying;
    this._isPlaying = state.isPlaying;

    // Start or stop time tracking
    if (this._isPlaying && !wasPlaying) {
      this._startTimeTracking();
    } else if (!this._isPlaying && wasPlaying) {
      this._stopTimeTracking();
    }

    // Emit timeupdate event
    this._emitter.trigger("timeupdate");
  }

  private _startTimeTracking(): void {
    if (this._timeInterval) return;

    // Increment time every second
    this._timeInterval = window.setInterval(() => {
      if (this._isPlaying) {
        this._timeElapsed += 1;

        // Don't exceed duration
        if (this._timeElapsed > this._duration) {
          this._timeElapsed = this._duration;
        }

        this._emitter.trigger("timeupdate");
      }
    }, 1000);
  }

  private _stopTimeTracking(): void {
    if (this._timeInterval) {
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    }
  }

  // IMedia interface methods
  on(event: string, callback: (...args: any[]) => void): void {
    this._emitter.on(event, callback);
  }

  timeElapsed(): number {
    return this._timeElapsed;
  }

  timeRemaining(): number {
    return Math.max(0, this._duration - this._timeElapsed);
  }

  percentComplete(): number {
    if (this._duration === 0) return 0;
    return (this._timeElapsed / this._duration) * 100;
  }

  duration(): number {
    return this._duration;
  }

  async play(): Promise<void> {
    // Only control Spotify if allowed (after initialization)
    // if (this._allowSpotifyControl) {
    //   await this._spotifyService.play();
    // }
  }

  pause(): void {
    // Only control Spotify if allowed (after initialization)
    // if (this._allowSpotifyControl) {
    //   this._spotifyService.pause();
    // }
  }

  stop(): void {
    // Only control Spotify if allowed (after initialization)
    // if (this._allowSpotifyControl) {
    //   this._spotifyService.pause();
    // }
    // this._timeElapsed = 0;
    // this._emitter.trigger("timeupdate");
  }

  seekToPercentComplete(percent: number): void {
    const positionMs = (percent / 100) * this._duration * 1000;
    // Only control Spotify if allowed (after initialization)
    // if (this._allowSpotifyControl) {
    //   this._spotifyService.seek(positionMs);
    // }
    // this._timeElapsed = positionMs / 1000;
    // this._emitter.trigger("timeupdate");
  }

  // Methods that don't apply to Spotify playback
  setVolume(volume: number): void {
    // Spotify volume is controlled by the device, not the web API
  }

  setBalance(balance: number): void {
    // Balance control not supported
  }

  setPreamp(value: number): void {
    // Preamp not supported
  }

  setEqBand(band: any, value: number): void {
    // EQ not supported
  }

  disableEq(): void {
    // EQ not supported
  }

  enableEq(): void {
    // EQ not supported
  }

  getAnalyser(): AnalyserNode {
    // Return a dummy analyser node since we can't get audio data from Spotify
    const audioContext = new AudioContext();
    return audioContext.createAnalyser();
  }

  async loadFromUrl(url: string, autoPlay: boolean): Promise<void> {
    // We don't load from URLs with Spotify
    // Tracks are loaded via Spotify's own mechanisms
  }

  dispose(): void {
    this._stopTimeTracking();
    if (this._controlTimeout) {
      clearTimeout(this._controlTimeout);
      this._controlTimeout = null;
    }
    if (this._unsubscribe) {
      this._unsubscribe();
    }
    this._emitter.dispose();
  }
}
