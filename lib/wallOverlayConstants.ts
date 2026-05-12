/** Hai ảnh title luân phiên blend lên lưới ảnh (file trong `public/wall-overlays/`). */
export const WALL_OVERLAY_URLS = [
  "/wall-overlays/deplam-hoabinh.png",
  "/wall-overlays/giu-lay-binh-yen.png",
] as const;

/** Thời gian mỗi ảnh gần như “đứng yên” trước khi bắt đầu crossfade sang ảnh kia. */
export const WALL_OVERLAY_DISPLAY_MS = 10_000;

/** Độ dài crossfade (opacity). */
export const WALL_OVERLAY_BLEND_MS = 1_200;

/** Độ mờ toàn lớp overlay so lưới ảnh vẫn lộ nhẹ (0–1). */
export const WALL_OVERLAY_STACK_OPACITY = 0.92;
