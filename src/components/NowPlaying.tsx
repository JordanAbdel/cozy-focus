import { useSpotify } from "../lib/useSpotify";

export function NowPlaying() {
  const { connected, track, connect, disconnect } = useSpotify();

  return (
    <div
      className="rounded-[22px] border backdrop-blur-2xl flex items-center gap-7"
      style={{
        padding: 34,
        maxWidth: 520,
        borderColor: "rgba(237,224,206,.10)",
        background: "linear-gradient(160deg,rgba(52,33,22,.7),rgba(28,18,12,.72))",
        boxShadow: "0 30px 70px -30px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05)",
      }}
    >
      <div
        className="rounded-sm grid place-items-center flex-shrink-0 overflow-hidden"
        style={{
          width: 172,
          height: 172,
          transform: "rotate(-1.6deg)",
          background: "var(--stripe), linear-gradient(150deg,#4A2E1B,#2A1A11)",
          boxShadow: "0 20px 40px -18px rgba(0,0,0,.8), inset 0 0 0 1px rgba(237,224,206,.07)",
        }}
      >
        {track?.albumArt ? (
          <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[9px] tracking-[.22em] uppercase" style={{ color: "rgba(237,224,206,.3)" }}>
            no album
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="font-serif-cf" style={{ fontSize: 27, lineHeight: 1.2, color: "rgba(237,224,206,.9)" }}>
            {track ? track.name : connected ? "Nothing playing" : "Bring your own music"}
          </div>
          <div className="text-[13px] leading-relaxed mt-2" style={{ color: "rgba(237,224,206,.48)", maxWidth: 290 }}>
            {track
              ? `${track.artist}${track.isPlaying ? "" : " · paused"}`
              : connected
                ? "Play something on Spotify and it'll show up here."
                : "Ambience keeps playing without it. Connect Spotify when you want records on the desk too."}
          </div>
        </div>
        <button
          onClick={connected ? disconnect : connect}
          className="self-start cursor-pointer rounded-full text-[12px] tracking-[.1em] uppercase border"
          style={{
            padding: "11px 22px",
            color: "#EDE0CE",
            borderColor: "rgba(237,224,206,.22)",
            background: "linear-gradient(160deg,rgba(232,160,92,.22),rgba(201,106,60,.10))",
          }}
        >
          {connected ? "Disconnect Spotify" : "Connect Spotify"}
        </button>
      </div>
    </div>
  );
}
