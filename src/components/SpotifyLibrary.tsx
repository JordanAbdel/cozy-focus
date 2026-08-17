import { PRESET_STATIONS, type PlaylistSummary } from "../lib/spotifyApi";

interface Props {
  open: boolean;
  onClose: () => void;
  playlists: PlaylistSummary[];
  onPlayPlaylist: (uri: string) => void;
  onPlayPreset: (query: string) => void;
}

export function SpotifyLibrary({ open, onClose, playlists, onPlayPlaylist, onPlayPreset }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: "rgba(8,5,3,.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-[20px] border backdrop-blur-2xl flex flex-col gap-6"
        style={{
          width: 420,
          maxHeight: "72vh",
          padding: "26px 28px",
          borderColor: "rgba(237,224,206,.10)",
          background: "rgba(38,24,16,.94)",
          boxShadow: "0 30px 70px -28px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06)",
          color: "rgba(237,224,206,.85)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-serif-cf" style={{ fontSize: 20 }}>
            Choose music
          </div>
          <button onClick={onClose} className="cursor-pointer text-[13px]" style={{ color: "rgba(237,224,206,.5)" }}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-[10px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.32)" }}>
            Stations
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_STATIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => onPlayPreset(s.query)}
                className="cursor-pointer px-3.5 py-[7px] rounded-full text-[11px] tracking-[.05em] border"
                style={{ color: "rgba(237,224,206,.75)", borderColor: "rgba(237,224,206,.16)", background: "rgba(237,224,206,.04)" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 overflow-hidden">
          <div className="text-[10px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.32)" }}>
            Your playlists
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "34vh" }}>
            {playlists.length === 0 && (
              <div className="text-[13px]" style={{ color: "rgba(237,224,206,.4)" }}>
                No playlists found.
              </div>
            )}
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => onPlayPlaylist(p.uri)}
                className="cursor-pointer flex items-center gap-3 rounded-[10px] text-left"
                style={{ padding: "6px 8px" }}
              >
                {p.image ? (
                  <img src={p.image} alt="" className="rounded-sm flex-shrink-0" style={{ width: 40, height: 40, objectFit: "cover" }} />
                ) : (
                  <div className="rounded-sm flex-shrink-0" style={{ width: 40, height: 40, background: "rgba(237,224,206,.08)" }} />
                )}
                <span className="text-[13px] truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
