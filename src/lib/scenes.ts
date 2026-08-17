export type LayerKey = "rain" | "fire" | "cafe" | "wind" | "keys" | "thunder";
export type SceneKey = "rain" | "fire" | "forest" | "night" | "art";

export type LevelState = Record<LayerKey, number>;

export interface LayerMeta {
  key: LayerKey;
  glyph: string;
  label: string;
  short: string;
  tint: string;
}

export const LAYER_META: LayerMeta[] = [
  { key: "rain", glyph: "≈", label: "Rain", short: "Rain", tint: "#7FA8A0" },
  { key: "fire", glyph: "△", label: "Campfire", short: "Fire", tint: "#C96A3C" },
  { key: "cafe", glyph: "◌", label: "Café", short: "Café", tint: "#C9A478" },
  { key: "wind", glyph: "〰", label: "Wind", short: "Wind", tint: "#8FA6A8" },
  { key: "keys", glyph: "▤", label: "Keys", short: "Keys", tint: "#B08A63" },
  { key: "thunder", glyph: "◍", label: "Thunder", short: "Storm", tint: "#6E8CA0" },
];

export interface SceneDef {
  key: SceneKey;
  label: string;
  base: number;
  backdrop: string;
  overlay: string;
  rainOpacity: number;
  fireOpacity: number;
  fogOpacity: number;
  preset: LevelState;
}

export const SCENES: Record<SceneKey, SceneDef> = {
  rain: {
    key: "rain",
    label: "Rain",
    base: 1,
    backdrop: "radial-gradient(120% 90% at 22% 18%,#4A2E1B 0%,#2A1A11 45%,#140D08 100%)",
    overlay: "radial-gradient(70% 55% at 78% 26%,rgba(127,168,160,.20),transparent 70%)",
    rainOpacity: 0.55,
    fireOpacity: 0.22,
    fogOpacity: 0.55,
    preset: { rain: 74, fire: 30, cafe: 0, wind: 18, keys: 0, thunder: 22 },
  },
  fire: {
    key: "fire",
    label: "Fire",
    base: 1,
    backdrop: "radial-gradient(120% 90% at 22% 18%,#4A2E1B 0%,#2A1A11 45%,#140D08 100%)",
    overlay: "radial-gradient(75% 60% at 24% 82%,rgba(201,106,60,.30),transparent 72%)",
    rainOpacity: 0.06,
    fireOpacity: 0.95,
    fogOpacity: 0.35,
    preset: { rain: 0, fire: 82, cafe: 0, wind: 12, keys: 0, thunder: 0 },
  },
  forest: {
    key: "forest",
    label: "Forest",
    base: 1,
    backdrop: "radial-gradient(120% 90% at 22% 18%,#4A2E1B 0%,#2A1A11 45%,#140D08 100%)",
    overlay: "radial-gradient(80% 60% at 60% 30%,rgba(127,168,160,.26),transparent 72%)",
    rainOpacity: 0.18,
    fireOpacity: 0.1,
    fogOpacity: 0.85,
    preset: { rain: 26, fire: 0, cafe: 0, wind: 58, keys: 0, thunder: 8 },
  },
  night: {
    key: "night",
    label: "Night city",
    base: 1,
    backdrop: "radial-gradient(120% 90% at 22% 18%,#4A2E1B 0%,#2A1A11 45%,#140D08 100%)",
    overlay: "radial-gradient(70% 50% at 50% 88%,rgba(232,160,92,.22),transparent 70%)",
    rainOpacity: 0.3,
    fireOpacity: 0.14,
    fogOpacity: 0.45,
    preset: { rain: 34, fire: 0, cafe: 46, wind: 10, keys: 24, thunder: 0 },
  },
  art: {
    key: "art",
    label: "Artwork",
    base: 0.18,
    backdrop: "radial-gradient(120% 90% at 22% 18%,#4A2E1B 0%,#2A1A11 45%,#140D08 100%)",
    overlay: "radial-gradient(90% 70% at 50% 30%,rgba(232,160,92,.10),transparent 75%)",
    rainOpacity: 0.16,
    fireOpacity: 0.1,
    fogOpacity: 0.22,
    preset: { rain: 40, fire: 0, cafe: 30, wind: 14, keys: 18, thunder: 0 },
  },
};

export const SCENE_ORDER: SceneKey[] = ["rain", "fire", "forest", "night", "art"];

export function tintFor(key: LayerKey, accent: string, cool: string): string {
  const tints: Record<LayerKey, string> = {
    rain: cool,
    fire: accent,
    cafe: "#C9A478",
    wind: "#8FA6A8",
    keys: "#B08A63",
    thunder: cool,
  };
  return tints[key];
}
