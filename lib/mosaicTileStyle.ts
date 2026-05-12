import { WALL_OVERLAY_MASK_HIGH, WALL_OVERLAY_MASK_LOW } from "@/lib/wallOverlayConstants";

/** Biên mềm giữa vùng “nền mask” và “chữ mask” (0–1). */
export function smoothMaskWeight(L: number, low = WALL_OVERLAY_MASK_LOW, high = WALL_OVERLAY_MASK_HIGH): number {
  if (L <= low) return 0;
  if (L >= high) return 1;
  const t = (L - low) / (high - low);
  return t * t * (3 - 2 * t);
}

/**
 * `m` = 0 → ô nền (tối, lạnh); `m` = 1 → ô chữ (sáng, ấm) — giống ảnh mẫu mosaic.
 */
export function mosaicCssFilter(m: number): string {
  const b = 0.4 + m * 0.72;
  const sep = m * 0.48;
  const sat = 0.58 + m * 0.48;
  const hue = -32 + m * 58;
  const con = 0.92 + m * 0.14;
  return `brightness(${b}) contrast(${con}) sepia(${sep}) saturate(${sat}) hue-rotate(${hue}deg)`;
}
