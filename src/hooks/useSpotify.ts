import { useState, useEffect, useRef } from 'react';
import { SpotifyService, SpotifyPlayerState } from '../services/spotify';
import { getSpotifyToken } from '../utils/spotify-token';

export function useSpotify() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>({
    isPlaying: false,
    currentTrack: null,
    progress_ms: 0,
    duration_ms: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const spotifyServiceRef = useRef<SpotifyService | null>(null);

  // Fetch access token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const data = await getSpotifyToken();
        setAccessToken(data.access_token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching token:', err);
      }
    };

    fetchToken();
  }, []);

  // Initialize Spotify service when we have a token
  useEffect(() => {
    if (!accessToken || isInitialized) return;

    try {
      const service = new SpotifyService(accessToken);

      // Listen to state changes
      service.onStateChange((state) => {
        setPlayerState(state);
      });

      // Start polling for playback state
      service.startPolling(1000);

      spotifyServiceRef.current = service;
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Spotify');
      console.error('Error initializing Spotify:', err);
    }

    return () => {
      if (spotifyServiceRef.current) {
        spotifyServiceRef.current.disconnect();
      }
    };
  }, [accessToken]); // Removed isInitialized from dependencies

  return {
    spotifyService: spotifyServiceRef.current,
    isInitialized,
    playerState,
    error,
  };
}
