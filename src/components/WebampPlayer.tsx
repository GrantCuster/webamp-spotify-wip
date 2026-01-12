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
  const [currentSkin, setCurrentSkin] = useState<Skin | null>(null);
  const [shuffleMode, setShuffleMode] = useState<"all" | "liked">("all");
  const [currentSkinName, setCurrentSkinName] = useState<string>("");
  const [autoShuffle, setAutoShuffle] = useState<boolean>(true);
  const [shuffleProgress, setShuffleProgress] = useState<number>(0);
  const progressIntervalRef = useRef<number | null>(null);
  const prevProgressRef = useRef<number>(0);
  const [skinLoading, setSkinLoading] = useState<boolean>(false);

  // Check if controls should be shown based on URL param
  const [showControls, setShowControls] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowControls(params.get("controls") === "true");
    setDisplayMode(params.get("display") === "true");
  }, []);

  // Function to toggle like status of current skin
  const toggleLikeSkin = async () => {
    if (!currentSkin) return;

    const newLikedStatus = !currentSkin.liked;

    // Optimistically update local state
    setCurrentSkin({ ...currentSkin, liked: newLikedStatus });
    setSkins((prevSkins) =>
      prevSkins.map((skin) =>
        skin.id === currentSkin.id ? { ...skin, liked: newLikedStatus } : skin,
      ),
    );

    try {
      const response = await fetch(`/api/skins/${currentSkin.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ liked: newLikedStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update like status");
      }

      console.log(
        `Skin ${currentSkin.filename} ${newLikedStatus ? "liked" : "unliked"}`,
      );
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert optimistic update on error
      setCurrentSkin({ ...currentSkin, liked: !newLikedStatus });
      setSkins((prevSkins) =>
        prevSkins.map((skin) =>
          skin.id === currentSkin.id
            ? { ...skin, liked: !newLikedStatus }
            : skin,
        ),
      );
    }
  };

  // Function to toggle flag status of current skin
  const toggleFlagSkin = async () => {
    if (!currentSkin) return;

    const newFlaggedStatus = !currentSkin.flagged;

    // Optimistically update local state
    setCurrentSkin({ ...currentSkin, flagged: newFlaggedStatus });
    setSkins((prevSkins) =>
      prevSkins.map((skin) =>
        skin.id === currentSkin.id
          ? { ...skin, flagged: newFlaggedStatus }
          : skin,
      ),
    );

    try {
      const response = await fetch(`/api/skins/${currentSkin.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ flagged: newFlaggedStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update flag status");
      }

      console.log(
        `Skin ${currentSkin.filename} ${newFlaggedStatus ? "flagged" : "unflagged"}`,
      );

      // If we just flagged the current skin, remove it from the list and shuffle to next
      if (newFlaggedStatus) {
        setSkins((prevSkins) =>
          prevSkins.filter((skin) => skin.id !== currentSkin.id),
        );
        // Shuffle to a different skin since this one is now flagged
        setTimeout(() => shuffleSkin(), 100);
      }
    } catch (error) {
      console.error("Error toggling flag:", error);
      // Revert optimistic update on error
      setCurrentSkin({ ...currentSkin, flagged: !newFlaggedStatus });
      setSkins((prevSkins) =>
        prevSkins.map((skin) =>
          skin.id === currentSkin.id
            ? { ...skin, flagged: !newFlaggedStatus }
            : skin,
        ),
      );
    }
  };

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

    // Update current skin state
    setCurrentSkin(nextSkin);

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
      // Reset progress after skin loads
      setShuffleProgress(0);
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

    console.log("Loading Webamp...");

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
        console.log("Webamp is ready!");
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

  // Update Webamp's playlist when track changes
  useEffect(() => {
    if (
      !webampReady ||
      !webampRef.current ||
      !playerState.currentTrack ||
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
          url: "",
          duration: queueData.currently_playing.duration_ms / 1000,
        });
      }

      // Add queued tracks
      queueData.queue.forEach((track) => {
        tracks.push({
          metaData: {
            artist: track.artists.map((a) => a.name).join(", "),
            title: track.name,
          },
          url: "",
          duration: track.duration_ms / 1000,
        });
      });

      // Update Webamp's playlist
      if (tracks.length > 0) {
        webamp.setTracksToPlay(tracks);

        // Sync play/pause state with Spotify
        if (playerState.isPlaying) {
          webamp.play();
        } else {
          webamp.pause();
        }
      }
    };

    updatePlaylist();
  }, [
    playerState.currentTrack,
    playerState.isPlaying,
    webampReady,
    spotifyService,
  ]);

  useEffect(() => {
    function runLayout() {
      if (isInitialized) {
        // redo sizing
        const $webamp = document.getElementById("webamp");
        if ($webamp) {
          const padding = displayMode ? 0 : 16;
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
  }, [isInitialized, displayMode]);

  // Load skins from API based on shuffle mode (always exclude flagged skins)
  useEffect(() => {
    const url =
      shuffleMode === "liked"
        ? "/api/skins?liked=true&flagged=false"
        : "/api/skins?flagged=false";

    fetch(url)
      .then((res) => res.json())
      .then((data: SkinsResponse) => {
        setSkins(data.skins);
        console.log(
          `Loaded ${data.skins.length} ${shuffleMode === "liked" ? "liked" : ""} skins (excluding flagged)`,
        );
      })
      .catch((err) => console.error("Error loading skins:", err));
  }, [shuffleMode]);

  // Update progress bar for auto-shuffle
  useEffect(() => {
    if (!autoShuffle || !webampReady || skins.length === 0) {
      // Clear progress interval and reset progress if auto-shuffle is disabled
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setShuffleProgress(0);
      return;
    }

    // Update progress every 100ms (1% every 100ms = 100% in 10s)
    progressIntervalRef.current = window.setInterval(() => {
      setShuffleProgress((prev) => {
        // Don't increment while skin is loading, keep at current value
        if (skinLoading) return prev;
        if (prev >= 100) return 100; // Stay at 100% until skin loads
        return prev + 1;
      });
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [autoShuffle, webampReady, skins.length, skinLoading]);

  // Track previous progress for transition control
  useEffect(() => {
    prevProgressRef.current = shuffleProgress;
  }, [shuffleProgress]);

  // Trigger shuffle when progress reaches 100%
  useEffect(() => {
    if (shuffleProgress >= 100 && autoShuffle && !skinLoading) {
      shuffleSkin();
    }
  }, [shuffleProgress, autoShuffle, skinLoading]);

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
      {/* Progress bar */}
      {autoShuffle && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${shuffleProgress}%`,
              backgroundColor: "#444",
              transition:
                shuffleProgress > prevProgressRef.current
                  ? "width 0.1s linear"
                  : "none",
            }}
          />
        </div>
      )}
      {showControls && (
        <div
          style={{
            position: "fixed",
            top: autoShuffle ? "3px" : 0,
            left: 0,
            right: 0,
            height: "48px",
            backgroundColor: "#000",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "0 16px",
            zIndex: 9999,
            borderBottom: "1px solid #333",
          }}
        >
          <button
            onClick={() => shuffleSkin()}
            disabled={skins.length === 0}
            style={{
              padding: "8px 12px",
              backgroundColor: "#1db954",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: skins.length > 0 ? "pointer" : "not-allowed",
              fontSize: "18px",
              fontWeight: "600",
              opacity: skins.length === 0 ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={`Shuffle skin (${skins.length} available)`}
          >
            🔀
          </button>
          <button
            onClick={toggleLikeSkin}
            disabled={!currentSkin}
            style={{
              padding: "8px 12px",
              backgroundColor: currentSkin?.liked ? "#e91e63" : "#666",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: currentSkin ? "pointer" : "not-allowed",
              fontSize: "18px",
              fontWeight: "600",
              opacity: currentSkin ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={
              currentSkin
                ? currentSkin.liked
                  ? "Unlike skin"
                  : "Like skin"
                : "No skin loaded"
            }
          >
            {currentSkin?.liked ? "❤️" : "🤍"}
          </button>
          <button
            onClick={toggleFlagSkin}
            disabled={!currentSkin}
            style={{
              padding: "8px 12px",
              backgroundColor: currentSkin?.flagged ? "#f44336" : "#666",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: currentSkin ? "pointer" : "not-allowed",
              fontSize: "18px",
              fontWeight: "600",
              opacity: currentSkin ? 1 : 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={
              currentSkin
                ? currentSkin.flagged
                  ? "Unflag skin (will be excluded)"
                  : "Flag skin to exclude from shuffle"
                : "No skin loaded"
            }
          >
            {currentSkin?.flagged ? "🚩" : "⚑"}
          </button>
          <select
            value={shuffleMode}
            onChange={(e) => setShuffleMode(e.target.value as "all" | "liked")}
            style={{
              padding: "8px 12px",
              backgroundColor: "#333",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "400",
            }}
          >
            <option value="all">All skins</option>
            <option value="liked">Liked only</option>
          </select>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#fff",
              fontSize: "14px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={autoShuffle}
              onChange={(e) => setAutoShuffle(e.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                cursor: "pointer",
              }}
            />
            Auto-shuffle (10s)
          </label>
          {currentSkinName && (
            <span
              style={{
                color: "#fff",
                fontSize: "14px",
                fontWeight: "400",
              }}
            >
              {currentSkinName}
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} id="webamp-container" />
      <div className="absolute left-0 bottom-0 text-center w-full text-gray-500 text-sm mb-2">
        {currentSkinName || "Default"}
      </div>
    </>
  );
}
