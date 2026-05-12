/** Hai ảnh title luân phiên blend lên lưới ảnh (file trong `public/wall-overlays/`). */
export const WALL_OVERLAY_URLS = [
  "/wall-overlays/deplam-hoabinh.png",
  "/wall-overlays/giu-lay-binh-yen.png",
] as const;

/** Thời gian mỗi ảnh gần như “đứng yên” trước khi bắt đầu crossfade sang ảnh kia. */
export const WALL_OVERLAY_DISPLAY_MS = 10_000;

/** Độ dài crossfade (opacity). */
export const WALL_OVERLAY_BLEND_MS = 1_200;

/** Độ mạnh toàn lớp overlay (0–1); với `mix-blend-mode` thường để ~1. */
export const WALL_OVERLAY_STACK_OPACITY = 1;

/**
 * Hòa overlay vào lưới ảnh bên dưới (full tường + object-cover).
 * Có thể đổi: `soft-light` | `overlay` | `screen` | `multiply` | `hard-light` …
 */
export const WALL_OVERLAY_MIX_BLEND_MODE = "soft-light" as const;
