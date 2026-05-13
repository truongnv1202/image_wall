/** Ảnh overlay trên tường (một file trong `public/wall-overlays/`). */
export const WALL_GRAPHIC_URL = "/wall-overlays/deplam-hoabinh.png";

/** Độ mờ mặc định lớp overlay / watermark ảnh (0–1); có thể chỉnh trên trang upload. */
export const WALL_GRAPHIC_OVERLAY_OPACITY = 0.9;

/** Chuẩn hoá opacity từ JSON / form. */
export function coerceGraphicOverlayOpacity(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/**
 * Toàn bộ giá trị hợp lệ cho CSS `mix-blend-mode` (theo MDN / Compositing):
 * các chế độ blend + từ khóa cascade toàn cục.
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
  "inherit",
  "initial",
  "revert",
  "revert-layer",
  "unset",
] as const;

export type WallGraphicBlendMode = (typeof WALL_GRAPHIC_BLEND_MODE_CHOICES)[number];

/** Mặc định khi không có trong JSON và không có env hợp lệ. */
export const WALL_GRAPHIC_DEFAULT_BLEND: WallGraphicBlendMode = "hard-light";

function normalizeBlendToken(s: string): string {
  return s.trim().toLowerCase().replace(/_/g, "-");
}

export function isWallGraphicBlendMode(s: string): s is WallGraphicBlendMode {
  return (WALL_GRAPHIC_BLEND_MODE_CHOICES as readonly string[]).includes(s);
}

/** `NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE` — chỉ khi build; dùng làm fallback khi JSON chưa có field. */
export function resolveEnvWallGraphicBlendMode(): WallGraphicBlendMode | null {
  const raw =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE
      ? process.env.NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE
      : "";
  const key = normalizeBlendToken(raw);
  if (key.length > 0 && isWallGraphicBlendMode(key)) return key;
  return null;
}

export function coerceWallGraphicBlendMode(
  value: unknown,
  fallback: WallGraphicBlendMode,
): WallGraphicBlendMode {
  if (typeof value !== "string") return fallback;
  const key = normalizeBlendToken(value);
  if (key.length > 0 && isWallGraphicBlendMode(key)) return key;
  return fallback;
}
