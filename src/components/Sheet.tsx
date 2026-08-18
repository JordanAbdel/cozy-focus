import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Bottom sheet for the compact layout. Deliberately shares the visual language of
// SettingsPanel and SpotifyLibrary — same ground, border and shadow — so this is a
// third position for a panel, not a third style of panel.
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(8,5,3,.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-panel w-full border backdrop-blur-2xl flex flex-col gap-5"
        style={{
          maxHeight: "80vh",
          padding: "20px 18px calc(20px + env(safe-area-inset-bottom))",
          borderRadius: "20px 20px 0 0",
          borderColor: "rgba(237,224,206,.10)",
          background: "rgba(38,24,16,.94)",
          boxShadow: "0 -30px 70px -28px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06)",
          color: "rgba(237,224,206,.85)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-serif-cf" style={{ fontSize: 20 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-[13px]"
            style={{ color: "rgba(237,224,206,.5)" }}
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
