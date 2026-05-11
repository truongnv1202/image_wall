import type { CSSProperties } from "react";

/**
 * Vùng tường tỷ lệ 4:3, chạy mọi màn hình.
 * Công thức: ưu tiên đủ chiều cao; nếu (cao×4/3) vượt ngang viewport thì co theo chiều ngang.
 */
export const DISPLAY_REGION_STYLE: CSSProperties = {
  width: "min(100dvw, calc(100dvh * 4 / 3))",
  height: "min(100dvh, calc(100dvw * 3 / 4))",
};
