import { SCENES, SCENE_ORDER, type SceneKey } from "../lib/scenes";

interface Props {
  scene: SceneKey;
  onChange: (scene: SceneKey) => void;
  compact?: boolean;
}

export function SceneSwitcher({ scene, onChange, compact = false }: Props) {
  return (
    <div
      className={`flex gap-1 rounded-full border backdrop-blur-md${
        compact ? " max-w-full overflow-x-auto" : " absolute left-1/2"
      }`}
      style={{
        padding: 5,
        ...(compact ? { scrollbarWidth: "none" as const } : { bottom: 34, transform: "translateX(-50%)" }),
        borderColor: "rgba(237,224,206,.08)",
        background: "rgba(28,18,12,.42)",
      }}
    >
      {SCENE_ORDER.map((key) => {
        const active = key === scene;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`cursor-pointer flex-shrink-0 rounded-full tracking-[.14em] uppercase transition-colors ${
              compact ? "px-3 py-[6px] text-[10px]" : "px-[18px] py-[7px] text-[11px]"
            }`}
            style={{
              color: active ? "#EDE0CE" : "rgba(237,224,206,.42)",
              background: active ? "rgba(201,106,60,.28)" : "transparent",
            }}
          >
            {SCENES[key].label}
          </button>
        );
      })}
    </div>
  );
}
