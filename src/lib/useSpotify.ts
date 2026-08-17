import { useCallback, useEffect, useState } from "react";
import { beginLogin, completeLogin, getAccessToken, isCallback, isConnected, logout } from "./spotifyAuth";

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

  const connect = useCallback(() => {
    void beginLogin();
  }, []);

  const disconnect = useCallback(() => {
    logout();
    setConnected(false);
    setTrack(null);
  }, []);

  return { connected, track, connect, disconnect };
}
