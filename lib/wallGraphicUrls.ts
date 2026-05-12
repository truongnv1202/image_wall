/** Hai ảnh overlay xen kỳ trên tường (file trong `public/wall-overlays/`). */
export const WALL_GRAPHIC_A = "/wall-overlays/deplam-hoabinh.png";
export const WALL_GRAPHIC_B = "/wall-overlays/giu-lay-binh-yen.png";

/** Thời gian mỗi ảnh hiển thị trước khi chuyển (ms). */
export const WALL_GRAPHIC_CYCLE_MS = 10_000;

/** Độ dài crossfade giữa hai ảnh (ms). */
export const WALL_GRAPHIC_BLEND_MS = 1_400;

/** Sau khi hiển thị xong cả hai ảnh: ẩn hết, nghỉ rồi mới bắt đầu lại từ ảnh đầu (ms). */
export const WALL_GRAPHIC_IDLE_MS = 60_000;
