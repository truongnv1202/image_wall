/**
 * Mask chữ từ chu.png: ưu tiên kênh alpha; nếu không có alpha thật thì dùng
 * độ lệch màu so với màu trung bình viền canvas (chữ thường khác nền).
 */

export type ChuMaskOptions = {
  /** Dưới ngưỡng này (khoảng cách RGB) → nền. */
  colorDistLow: number;
  /** Trên ngưỡng này → chữ đục hoàn toàn (sau smoothstep). */
  colorDistHigh: number;
  /** Độ rộng vòng lấy mẫu viền (pixel). */
  borderSamplePx: number;
};

const DEFAULT_MASK_OPTS: ChuMaskOptions = {
  colorDistLow: 5,
  colorDistHigh: 58,
  borderSamplePx: 3,
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleBorderRgb(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  borderPx: number,
): { r: number; g: number; b: number; count: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const bpx = Math.min(borderPx, Math.floor(Math.min(w, h) / 4) || 1);

  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const a = rgba[i + 3]!;
    if (a < 32) return;
    r += rgba[i]!;
    g += rgba[i + 1]!;
    b += rgba[i + 2]!;
    count++;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < bpx || y >= h - bpx || x < bpx || x >= w - bpx) {
        add(x, y);
      }
    }
  }

  if (count === 0) {
    return { r: 255, g: 255, b: 255, count: 1 };
  }

  return { r: r / count, g: g / count, b: b / count, count };
}

/** Phát hiện alpha có ý nghĩa (không phải toàn 255 đồng đều). */
function detectMeaningfulAlpha(rgba: Uint8ClampedArray, w: number, h: number): boolean {
  let minA = 255;
  let maxA = 0;
  const stepX = Math.max(1, Math.floor(w / 32));
  const stepY = Math.max(1, Math.floor(h / 32));
  for (let y = 0; y < h; y += stepY) {
    for (let x = 0; x < w; x += stepX) {
      const a = rgba[(y * w + x) * 4 + 3]!;
      minA = Math.min(minA, a);
      maxA = Math.max(maxA, a);
    }
  }
  if (minA < 250) return true;
  if (maxA - minA > 8) return true;
  return false;
}

function colorDistanceMask(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  br: number,
  bg: number,
  bb: number,
  low: number,
  high: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; p++) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    i += 4;
    const d = Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2);
    out[p] = Math.round(255 * smoothstep(low, high, d));
  }
  return out;
}

/** Làm mịn nhẹ mask (1 pass box 3×3). */
function boxBlurMask3(mask: Uint8Array, w: number, h: number): void {
  const copy = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          s += copy[(y + dy) * w + (x + dx)]!;
        }
      }
      mask[y * w + x] = Math.round(s / 9);
    }
  }
}

/**
 * @param rgba — raw RGBA, length w*h*4
 * @returns mask 0–255, length w*h
 */
export function buildLetterMaskFromChuRgba(
  rgba: Buffer,
  w: number,
  h: number,
  opts: Partial<ChuMaskOptions> = {},
): Uint8Array {
  const o = { ...DEFAULT_MASK_OPTS, ...opts };
  const u8 = new Uint8ClampedArray(rgba);
  const { r: br, g: bg, b: bb } = sampleBorderRgb(u8, w, h, o.borderSamplePx);
  const hasAlpha = detectMeaningfulAlpha(u8, w, h);
  const colorM = colorDistanceMask(u8, w, h, br, bg, bb, o.colorDistLow, o.colorDistHigh);

  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const a = u8[p * 4 + 3]! / 255;
    const cm = colorM[p]! / 255;
    const combined = hasAlpha ? a * cm : cm;
    out[p] = Math.round(Math.min(1, Math.max(0, combined)) * 255);
  }

  boxBlurMask3(out, w, h);
  return out;
}

export function maskMaxValue(mask: Uint8Array): number {
  let m = 0;
  for (let i = 0; i < mask.length; i++) {
    m = Math.max(m, mask[i]!);
  }
  return m;
}

/** Nhân alpha lưới với mask chữ → CHUMOI (RGBA). */
export function applyLetterMaskToGridRgba(
  gridRgba: Buffer,
  mask: Uint8Array,
  w: number,
  h: number,
): Buffer {
  const src = new Uint8ClampedArray(gridRgba);
  const out = Buffer.alloc(w * h * 4);
  const dst = new Uint8ClampedArray(out.buffer, out.byteOffset, out.byteLength);
  for (let p = 0; p < w * h; p++) {
    const si = p * 4;
    const m = mask[p]! / 255;
    dst[si] = src[si]!;
    dst[si + 1] = src[si + 1]!;
    dst[si + 2] = src[si + 2]!;
    const ga = src[si + 3]! / 255;
    dst[si + 3] = Math.round(255 * ga * m);
  }
  return out;
}
