import { useCallback, useEffect, useState } from "react";
import { beginLogin, completeLogin, getAccessToken, isCallback, isConnected, logout } from "./spotifyAuth";
import {
  PlaybackError,
  fetchMyPlaylists,
  pausePlayback,
  playContext,
  resumePlayback,
  searchPlaylist,
  skipNext,
  skipPrevious,
  type PlaylistSummary,
} from "./spotifyApi";

export interface NowPlayingTrack {
  name: string;
  artist: string;
  albumArt: string | null;
  isPlaying: boolean;
}

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
      const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204 || !res.ok) {
        setTrack(null);
        return;
      }
      const data = await res.json();
      if (!data?.item) {
        setTrack(null);
        return;
      }
      setTrack({
        name: data.item.name,
        artist: (data.item.artists as { name: string }[] | undefined)?.map((a) => a.name).join(", ") ?? "",
        albumArt: data.item.album?.images?.[0]?.url ?? null,
        isPlaying: !!data.is_playing,
      });
    } catch {
      // transient network error, keep last known track
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [connected, poll]);

  useEffect(() => {
    if (!connected) {
      setPlaylists([]);
      return;
    }
    fetchMyPlaylists().then(setPlaylists);
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
