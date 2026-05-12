/** Ảnh “mask” (nền tối + chữ sáng) — lấy độ sáng từng ô lưới để tô màu mosaic như mẫu. */
export const WALL_OVERLAY_URLS = [
  "/wall-overlays/deplam-hoabinh.png",
  "/wall-overlays/giu-lay-binh-yen.png",
] as const;

/** Đổi mask sau mỗi khoảng này (ms). */
export const WALL_OVERLAY_DISPLAY_MS = 10_000;

/**
 * Ngưỡng độ sáng (0–1) sau khi downsample mask theo lưới.
 * Chữ thường sáng hơn nền → `m` cao ở ô chữ, thấp ở nền.
 */
export const WALL_OVERLAY_MASK_LOW = 0.34;
export const WALL_OVERLAY_MASK_HIGH = 0.62;
