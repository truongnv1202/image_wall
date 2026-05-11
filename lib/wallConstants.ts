/** Lưới mẫu: 100 × 60 ô (spec triển lãm). */
export const GRID_COLS = 100;
export const GRID_ROWS = 60;

/** Chữ mặc định — 2 dòng, in hoa (mask canvas). */
export const WALL_MASK_TEXT = "HÒA BÌNH\nĐẸP LẮM";

/** Vàng, cam đỏ, trắng — luân phiên theo `textNodeIndex % 3`. */
export const TEXT_OVERLAY_COLORS = ["#FFD700", "#FF4500", "#FFFFFF"] as const;
