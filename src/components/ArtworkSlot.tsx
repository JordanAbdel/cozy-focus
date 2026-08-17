import { useRef, useState } from "react";

interface Props {
  image: string | null;
  onImageChange: (dataUrl: string | null) => void;
  error?: string | null;
}

function resizeToDataUrl(file: File, maxDim = 1920): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ArtworkSlot({ image, onImageChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      onImageChange(dataUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      {image ? (
        <img src={image} alt="Scene artwork" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed transition-colors"
          style={{
            borderColor: dragOver ? "rgba(232,160,92,.6)" : "rgba(237,224,206,.16)",
            background: dragOver ? "rgba(201,106,60,.08)" : "transparent",
          }}
        >
          <span className="text-[11px] tracking-[.14em] uppercase" style={{ color: "rgba(237,224,206,.42)" }}>
            {busy ? "Processing…" : "Drop lofi scene art, or click to browse"}
          </span>
          {error && (
            <span className="text-[11px] tracking-[.14em] uppercase" style={{ color: "rgba(237,224,206,.42)" }}>
              {error}
            </span>
          )}
        </button>
      )}
      {image && error && (
        <span
          className="absolute text-[11px] tracking-[.14em] uppercase text-center"
          style={{
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(237,224,206,.42)",
            background: "rgba(14,9,6,.55)",
            padding: "6px 14px",
            borderRadius: 999,
          }}
        >
          {error}
        </span>
      )}
      {image && (
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute cursor-pointer text-[10px] tracking-[.12em] uppercase px-3 py-1.5 rounded-full border"
          style={{
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            borderColor: "rgba(237,224,206,.2)",
            color: "rgba(237,224,206,.75)",
            background: "rgba(14,9,6,.55)",
          }}
        >
          Replace artwork
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
