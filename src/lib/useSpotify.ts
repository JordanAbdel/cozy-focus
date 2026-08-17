import { useCallback, useEffect, useState } from "react";
import { beginLogin, completeLogin, getAccessToken, isCallback, isConnected, logout } from "./spotifyAuth";
import {
  PlaybackError,
  fetchCurrentlyPlaying,
  fetchMyPlaylists,
  pausePlayback,
  playContext,
  resumePlayback,
  searchPlaylist,
  skipNext,
  skipPrevious,
  type NowPlayingTrack,
  type PlaylistSummary,
} from "./spotifyApi";

const POLL_MS = 6000;

export function useSpotify() {
  const [connected, setConnected] = useState(isConnected());
  const [track, setTrack] = useState<NowPlayingTrack | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCallback()) return;
    completeLogin().then((ok) => {
      if (ok) setConnected(true);
    });
  }, []);

  const poll = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setConnected(false);
      setTrack(null);
      return;
    }
    try {
      setTrack(await fetchCurrentlyPlaying());
    } catch {
      // transient network or rate-limit error, keep last known track
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    const tick = () => {
      if (!document.hidden) void poll();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [connected, poll]);

  useEffect(() => {
    if (!connected) {
      setPlaylists([]);
      return;
    }
    fetchMyPlaylists()
      .then(setPlaylists)
      .catch(() => setPlaylists([]));
  }, [connected]);

  const connect = useCallback(() => {
    void beginLogin();
  }, []);

  const disconnect = useCallback(() => {
    logout();
    setConnected(false);
    setTrack(null);
    setPlaylists([]);
  }, []);

  const runControl = useCallback(
    async (action: () => Promise<void>) => {
      try {
        setError(null);
        await action();
        window.setTimeout(poll, 400);
      } catch (e) {
        setError(e instanceof PlaybackError ? e.message : "Something went wrong.");
      }
    },
    [poll],
  );

  const togglePlayback = useCallback(() => {
    void runControl(track?.isPlaying ? pausePlayback : resumePlayback);
  }, [runControl, track]);

  const next = useCallback(() => void runControl(skipNext), [runControl]);
  const previous = useCallback(() => void runControl(skipPrevious), [runControl]);
  const playPlaylist = useCallback((uri: string) => void runControl(() => playContext(uri)), [runControl]);
  const playPreset = useCallback(
    (query: string) =>
      void runControl(async () => {
        const match = await searchPlaylist(query);
        if (!match) throw new PlaybackError("Couldn't find that station.");
        await playContext(match.uri);
      }),
    [runControl],
  );

  return { connected, track, connect, disconnect, playlists, error, togglePlayback, next, previous, playPlaylist, playPreset };
}
