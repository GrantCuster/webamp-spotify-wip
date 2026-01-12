// Simplified Spotify Web API types
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  uri: string;
}

export interface SpotifyPlayerState {
  isPlaying: boolean;
  currentTrack: SpotifyTrack | null;
  progress_ms: number;
  duration_ms: number;
}

export class SpotifyService {
  private accessToken: string;
  private stateListeners: Set<(state: SpotifyPlayerState) => void> = new Set();
  private pollingInterval: number | null = null;
  private lastState: SpotifyPlayerState | null = null;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Start polling for playback state
  startPolling(intervalMs: number = 1000): void {
    if (this.pollingInterval) return;

    // Poll immediately
    this.pollPlaybackState();

    // Then poll at interval
    this.pollingInterval = window.setInterval(() => {
      this.pollPlaybackState();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async pollPlaybackState(): Promise<void> {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 204 || !response.ok) {
        // No content or error - nothing is playing
        this.notifyStateListeners({
          isPlaying: false,
          currentTrack: null,
          progress_ms: 0,
          duration_ms: 0,
        });
        return;
      }

      const data = await response.json();

      if (data.item && data.item.type === 'track') {
        const state: SpotifyPlayerState = {
          isPlaying: data.is_playing,
          currentTrack: {
            id: data.item.id,
            name: data.item.name,
            artists: data.item.artists,
            album: data.item.album,
            duration_ms: data.item.duration_ms,
            uri: data.item.uri,
          },
          progress_ms: data.progress_ms || 0,
          duration_ms: data.item.duration_ms,
        };

        this.lastState = state;
        this.notifyStateListeners(state);
      }
    } catch (error) {
      console.error('Error polling playback state:', error);
    }
  }

  onStateChange(listener: (state: SpotifyPlayerState) => void): () => void {
    this.stateListeners.add(listener);

    // Send current state immediately if available
    if (this.lastState) {
      listener(this.lastState);
    }

    return () => this.stateListeners.delete(listener);
  }

  private notifyStateListeners(state: SpotifyPlayerState): void {
    this.stateListeners.forEach((listener) => listener(state));
  }

  async play(): Promise<void> {
    try {
      await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error playing:', error);
    }
  }

  async pause(): Promise<void> {
    try {
      await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  async togglePlay(): Promise<void> {
    if (this.lastState?.isPlaying) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  async nextTrack(): Promise<void> {
    try {
      await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      // Poll immediately after skip to update UI faster
      setTimeout(() => this.pollPlaybackState(), 300);
    } catch (error) {
      console.error('Error skipping to next track:', error);
    }
  }

  async previousTrack(): Promise<void> {
    try {
      await fetch('https://api.spotify.com/v1/me/player/previous', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      // Poll immediately after skip to update UI faster
      setTimeout(() => this.pollPlaybackState(), 300);
    } catch (error) {
      console.error('Error skipping to previous track:', error);
    }
  }

  async seek(positionMs: number): Promise<void> {
    try {
      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  async getQueue(): Promise<{ currently_playing: SpotifyTrack | null; queue: SpotifyTrack[] }> {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return { currently_playing: null, queue: [] };
      }

      const data = await response.json();

      return {
        currently_playing: data.currently_playing ? {
          id: data.currently_playing.id,
          name: data.currently_playing.name,
          artists: data.currently_playing.artists,
          album: data.currently_playing.album,
          duration_ms: data.currently_playing.duration_ms,
          uri: data.currently_playing.uri,
        } : null,
        queue: (data.queue || []).map((track: any) => ({
          id: track.id,
          name: track.name,
          artists: track.artists,
          album: track.album,
          duration_ms: track.duration_ms,
          uri: track.uri,
        })),
      };
    } catch (error) {
      console.error('Error fetching queue:', error);
      return { currently_playing: null, queue: [] };
    }
  }

  disconnect(): void {
    this.stopPolling();
    this.stateListeners.clear();
  }
}
