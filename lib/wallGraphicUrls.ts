/** Ảnh overlay trên tường (một file trong `public/wall-overlays/`). */
export const WALL_GRAPHIC_URL = "/wall-overlays/deplam-hoabinh.png";

/** Độ mờ lớp overlay (0–1). */
export const WALL_GRAPHIC_OVERLAY_OPACITY = 0.9;

/**
 * Các giá trị hợp lệ cho CSS `mix-blend-mode`.
 * Chọn mode:
 * - **Mặc định khi không có env:** sửa hằng `DEFAULT_BLEND` trong file này.
 * - **Deploy / Docker:** đặt `NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE` (vd. `soft-light`, `overlay`).
 */
export const WALL_GRAPHIC_BLEND_MODE_CHOICES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "plus-darker",
  "plus-lighter",
] as const;

export type WallGraphicBlendMode = (typeof WALL_GRAPHIC_BLEND_MODE_CHOICES)[number];

const DEFAULT_BLEND: WallGraphicBlendMode = "hard-light";

function normalizeBlendToken(s: string): string {
  return s.trim().toLowerCase().replace(/_/g, "-");
}

function isWallGraphicBlendMode(s: string): s is WallGraphicBlendMode {
  return (WALL_GRAPHIC_BLEND_MODE_CHOICES as readonly string[]).includes(s);
}

/** Đọc từ env (client bundle) hoặc dùng mặc định — gọi khi import module. */
function resolveWallGraphicBlendMode(): WallGraphicBlendMode {
  const raw =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE
      ? process.env.NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE
      : "";
  const key = normalizeBlendToken(raw);
  if (key.length > 0 && isWallGraphicBlendMode(key)) return key;
  return DEFAULT_BLEND;
}

/** Mode blend áp dụng cho overlay (ưu tiên `NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE` khi build). */
export const WALL_GRAPHIC_MIX_BLEND: WallGraphicBlendMode = resolveWallGraphicBlendMode();
