import { SCENES, SCENE_ORDER, type SceneKey } from "../lib/scenes";

interface Props {
  scene: SceneKey;
  onChange: (scene: SceneKey) => void;
}

export function SceneSwitcher({ scene, onChange }: Props) {
  return (
    <div
      className="absolute left-1/2 flex gap-1 rounded-full border backdrop-blur-md"
      style={{
        bottom: 34,
        transform: "translateX(-50%)",
        padding: 5,
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
            className="cursor-pointer px-[18px] py-[7px] rounded-full text-[11px] tracking-[.14em] uppercase transition-colors"
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
