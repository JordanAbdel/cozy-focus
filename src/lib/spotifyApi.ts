import { getAccessToken } from "./spotifyAuth";

const BASE = "https://api.spotify.com/v1";

export class PlaybackError extends Error {}

// Set whenever Spotify responds 429, so subsequent calls back off instead of
// hammering the API until the window it asked for has passed.
let rateLimitedUntil = 0;

async function authedFetch(path: string, init?: RequestInit) {
  if (Date.now() < rateLimitedUntil) {
    throw new PlaybackError("Spotify is rate-limiting requests. Try again in a moment.");
  }
  const token = await getAccessToken();
  if (!token) throw new PlaybackError("Not connected to Spotify.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    const seconds = Number(res.headers.get("Retry-After")) || 5;
    rateLimitedUntil = Date.now() + seconds * 1000;
  }
  return res;
}

export interface NowPlayingTrack {
  name: string;
  artist: string;
  albumArt: string | null;
  isPlaying: boolean;
}

export async function fetchCurrentlyPlaying(): Promise<NowPlayingTrack | null> {
  const res = await authedFetch("/me/player/currently-playing");
  if (res.status === 204 || !res.ok) return null;
  const data = await res.json();
  if (!data?.item) return null;
  return {
    name: data.item.name,
    artist: (data.item.artists as { name: string }[] | undefined)?.map((a) => a.name).join(", ") ?? "",
    albumArt: data.item.album?.images?.[0]?.url ?? null,
    isPlaying: !!data.is_playing,
  };
}

export interface PlaylistSummary {
  id: string;
  name: string;
  uri: string;
  image: string | null;
}

interface RawPlaylist {
  id: string;
  name: string;
  uri: string;
  images?: { url: string }[];
}

export async function fetchMyPlaylists(): Promise<PlaylistSummary[]> {
  const res = await authedFetch("/me/playlists?limit=50");
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.items ?? []) as RawPlaylist[]).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    uri: p.uri,
    image: p.images?.[0]?.url ?? null,
  }));
}

export async function searchPlaylist(query: string): Promise<PlaylistSummary | null> {
  const res = await authedFetch(`/search?q=${encodeURIComponent(query)}&type=playlist&limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const items = ((data.playlists?.items ?? []) as RawPlaylist[]).filter(Boolean);
  const item = items[0];
  if (!item) return null;
  return { id: item.id, name: item.name, uri: item.uri, image: item.images?.[0]?.url ?? null };
}

export const PRESET_STATIONS: { label: string; query: string }[] = [
  { label: "Lo-Fi Beats", query: "Lofi Beats" },
  { label: "Deep Focus", query: "Deep Focus" },
  { label: "Peaceful Piano", query: "Peaceful Piano" },
  { label: "Ambient Chill", query: "Ambient Relaxation" },
];

async function playerAction(path: string, init?: RequestInit) {
  const res = await authedFetch(`/me/player${path}`, init);
  if (res.ok || res.status === 204) return;
  if (res.status === 404) throw new PlaybackError("Open Spotify on a device first, then try again.");
  if (res.status === 403) throw new PlaybackError("This needs Spotify Premium.");
  throw new PlaybackError("Playback control failed.");
}

export function pausePlayback() {
  return playerAction("/pause", { method: "PUT" });
}

export function resumePlayback() {
  return playerAction("/play", { method: "PUT" });
}

export function playContext(uri: string) {
  return playerAction("/play", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_uri: uri }),
  });
}

export function skipNext() {
  return playerAction("/next", { method: "POST" });
}

export function skipPrevious() {
  return playerAction("/previous", { method: "POST" });
}
