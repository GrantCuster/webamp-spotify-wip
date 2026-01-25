"use client";

import { useEffect, useRef, useState } from "react";
import { useSpotify } from "../hooks/useSpotify";
import { SpotifyMedia } from "../services/spotify-media";

interface Skin {
  id: number;
  md5: string;
  filename: string;
  filepath: string;
  liked: boolean;
  flagged: boolean;
  s3_key: string;
}

interface SkinsResponse {
  skins: Skin[];
}

export function WebampPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const webampRef = useRef<any | null>(null);
  const spotifyMediaRef = useRef<SpotifyMedia | null>(null);
  const { spotifyService, isInitialized, playerState, error } = useSpotify();
  const [webampReady, setWebampReady] = useState(false);
  const [skins, setSkins] = useState<Skin[]>([]);
  const currentSkinIndexRef = useRef<number>(0);

  const [currentSkinName, setCurrentSkinName] = useState<string>("");

  const [skinLoading, setSkinLoading] = useState<boolean>(false);

  const prevTrackIdRef = useRef<string | null>(null);

  // Function to change to a random skin
  const shuffleSkin = async () => {
    if (!webampRef.current || skins.length === 0 || skinLoading) return;

    const webamp = webampRef.current;

    // Get random skin (different from current)
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * skins.length);
    } while (randomIndex === currentSkinIndexRef.current && skins.length > 1);

    currentSkinIndexRef.current = randomIndex;
    const nextSkin = skins[randomIndex];

    // Remove .wsz extension from filename for display
    const displayName = nextSkin.filename.replace(/\.(wsz|zip|wal)$/i, "");
    setCurrentSkinName(displayName);

    // Set loading state and wait for skin to load
    setSkinLoading(true);
    try {
      webamp.setSkinFromUrl(
        `https://grant-uploader.s3.us-east-2.amazonaws.com/${nextSkin.s3_key}`,
      );
      await webamp.skinIsLoaded();
    } catch (error) {
      console.error("Error loading skin:", error);
    } finally {
      setSkinLoading(false);
    }
  };

  // Initialize Webamp after Spotify is ready
  useEffect(() => {
    if (
      !isInitialized ||
      !containerRef.current ||
      webampRef.current ||
      !spotifyService
    )
      return;

    // Create custom media class for Spotify
    spotifyMediaRef.current = new SpotifyMedia(spotifyService);

    // Dynamically import Webamp only on the client
    import("webamp").then((WebampModule) => {
      const Webamp = WebampModule.default;

      const webamp = new Webamp({
        initialTracks: [],
        windowLayout: {
          main: {
            position: { left: 0, top: 0 },
          },
          equalizer: {
            position: { left: 0, top: 116 },
          },
          playlist: {
            position: { left: 0, top: 232 },
            size: {
              extraHeight: 3,
              extraWidth: 0,
            },
          },
        },
        __customMediaClass: class {
          constructor() {
            return spotifyMediaRef.current!;
          }
        } as any,
      });

      webamp.renderWhenReady(containerRef.current!).then(() => {
        webampRef.current = webamp;
        setWebampReady(true);
      });
    });

    return () => {
      if (webampRef.current) {
        webampRef.current.dispose();
      }
      if (spotifyMediaRef.current) {
        spotifyMediaRef.current.dispose();
      }
    };
  }, [isInitialized, spotifyService]);

  // // Update Webamp's playlist when track ID changes (not on every poll)
  const currentTrackId = playerState.currentTrack?.id;
  useEffect(() => {
    console.log("Playlist update effect, trackId:", currentTrackId);
    if (
      !webampReady ||
      !webampRef.current ||
      !currentTrackId ||
      !spotifyService
    )
      return;

    const updatePlaylist = async () => {
      const webamp = webampRef.current;
      if (!webamp) return;

      // Fetch the queue from Spotify
      const queueData = await spotifyService.getQueue();

      // Convert all tracks (current + queue) to Webamp format
      const tracks = [];

      // Add current track first
      if (queueData.currently_playing) {
        tracks.push({
          metaData: {
            artist: queueData.currently_playing.artists
              .map((a) => a.name)
              .join(", "),
            title: queueData.currently_playing.name,
          },
          url: queueData.currently_playing.id,
          duration: queueData.currently_playing.duration_ms / 1000,
        });
      }

      // Add queued tracks (filter duplicates)
      const seenIds = new Set<string>();
      if (queueData.currently_playing) {
        seenIds.add(queueData.currently_playing.id);
      }
      const uniqueQueue = queueData.queue.filter((track) => {
        if (seenIds.has(track.id)) return false;
        seenIds.add(track.id);
        return true;
      });

      uniqueQueue.forEach((track) => {
        tracks.push({
          metaData: {
            artist: track.artists.map((a) => a.name).join(", "),
            title: track.name,
          },
          url: track.id,
          duration: track.duration_ms / 1000,
        });
      });

      // Set track context for next/prev detection
      const currentId = queueData.currently_playing?.id || null;
      spotifyMediaRef.current?.setTrackContext(
        currentId,
        uniqueQueue.map((t) => t.id),
      );

      // Update Webamp's playlist
      if (tracks.length > 0) {
        console.log("-> calling setTracksToPlay");
        webamp.setTracksToPlay(tracks);
        webamp.play()
      }
    };

    updatePlaylist();
  }, [currentTrackId, webampReady, spotifyService]);

  useEffect(() => {
    console.log("Play sync effect:", {
      webampReady,
      isPlaying: playerState.isPlaying,
    });
    if (!webampReady || !webampRef.current) return;
    const webamp = webampRef.current;
    // Only sync play state, not pause - pause causes stop() to be called repeatedly
    if (playerState.isPlaying) {
      console.log("-> calling webamp.play()");
      webamp.play();
    }
  }, [playerState.isPlaying, webampReady]);

  useEffect(() => {
    function runLayout() {
      if (isInitialized) {
        // redo sizing
        const $webamp = document.getElementById("webamp");
        if ($webamp) {
          const padding = 0;
          const windowWidth = window.innerWidth - padding * 2;
          const windowHeight = window.innerHeight - padding * 2;
          const originalWidth = 274;
          const originalHeight = 435;
          const scale = Math.min(
            Math.min(
              windowWidth / originalWidth,
              windowHeight / originalHeight,
            ),
            2,
          );

          $webamp.children[0].children[0].children[0].setAttribute(
            "style",
            "transform: none;",
          );
          $webamp.children[0].children[0].children[2].setAttribute(
            "style",
            "transform: none; position: absolute; top: 116px;",
          );
          $webamp.children[0].children[0].children[1].setAttribute(
            "style",
            "transform: none; position: absolute; top: 232px;",
          );

          $webamp.children[0].children[0].setAttribute(
            "style",
            `position: absolute;
            transform: scale(${scale});
            transform-origin: top left;
left: ${(windowWidth - originalWidth * scale) / 2 + padding}px;
top: ${(windowHeight - originalHeight * scale) / 2 + padding}px;
`,
          );
        }
      }
    }
    setTimeout(() => {
      runLayout();
    }, 400);
    window.addEventListener("resize", runLayout);
    return () => {
      window.removeEventListener("resize", runLayout);
    };
  }, [isInitialized]);

  useEffect(() => {
    const url = "/api/skins?flagged=false";

    fetch(url)
      .then((res) => res.json())
      .then((data: SkinsResponse) => {
        setSkins(data.skins);
      })
      .catch((err) => console.error("Error loading skins:", err));
  }, []);

  // Trigger shuffle when song changes (no timer mode)
  const lastShuffleTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!webampReady || skins.length === 0) return;

    const currentTrackId = playerState.currentTrack?.id || null;

    // Only shuffle if track actually changed (not on initial load)
    // Also debounce to prevent multiple shuffles in quick succession
    const now = Date.now();
    if (
      prevTrackIdRef.current !== null &&
      currentTrackId !== prevTrackIdRef.current &&
      currentTrackId !== null &&
      now - lastShuffleTimeRef.current > 2000
    ) {
      lastShuffleTimeRef.current = now;
      shuffleSkin();
    }

    prevTrackIdRef.current = currentTrackId;
  }, [playerState.currentTrack?.id, webampReady, skins.length]);

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
        <p>Initializing Spotify player...</p>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} id="webamp-container" />
      <div className="absolute left-0 bottom-0 text-center w-full text-gray-300 mb-2">
        {currentSkinName || "Default"}
      </div>
    </>
  );
}
