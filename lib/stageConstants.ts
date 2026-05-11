import type { CSSProperties } from "react";

/**
 * Khung lớn (stage) luôn tỉ lệ 16:9 — tối đa 1920×1080, thu nhỏ vừa viewport.
 * Lưới ảnh bên trong giữ tỉ lệ ô 3:4 (PhotoWall), nằm gọn trong khung này.
 * Chiều cao suy ra từ `aspect-ratio` theo chiều rộng đã chặn.
 */
export const DISPLAY_REGION_STYLE: CSSProperties = {
  aspectRatio: "16 / 9",
  boxSizing: "border-box",
  width: "min(1920px, 100dvw, calc(100dvh * 16 / 9))",
  height: "auto",
  maxWidth: "100%",
};
