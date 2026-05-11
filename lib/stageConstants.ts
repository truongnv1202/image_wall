import type { CSSProperties } from "react";

/**
 * Vùng hiển thị Full HD 16:9 (tối đa 1920×1080), thu nhỏ vừa viewport.
 * Chiều cao suy ra từ `aspect-ratio` theo chiều rộng đã chặn.
 */
export const DISPLAY_REGION_STYLE: CSSProperties = {
  aspectRatio: "16 / 9",
  width: "min(1920px, 100dvw, calc(100dvh * 16 / 9))",
  height: "auto",
};
