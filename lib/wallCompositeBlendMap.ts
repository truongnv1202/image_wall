import type { Blend } from "sharp";

import type { WallGraphicBlendMode } from "@/lib/wallGraphicUrls";

/** Map CSS `mix-blend-mode` → `sharp.composite` blend (chỉ các mode Sharp hỗ trợ). */
export function cssBlendToSharp(blend: WallGraphicBlendMode): Blend {
  const map: Partial<Record<WallGraphicBlendMode, Blend>> = {
    normal: "over",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    darken: "darken",
    lighten: "lighten",
    "color-dodge": "colour-dodge",
    "color-burn": "colour-burn",
    "hard-light": "hard-light",
    "soft-light": "soft-light",
    difference: "difference",
    exclusion: "exclusion",
    "plus-darker": "darken",
    "plus-lighter": "lighten",
    inherit: "over",
    initial: "over",
    revert: "over",
    "revert-layer": "over",
    unset: "over",
    hue: "over",
    saturation: "over",
    color: "over",
    luminosity: "over",
  };
  return map[blend] ?? "over";
}
