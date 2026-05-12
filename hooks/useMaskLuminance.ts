"use client";

import { useEffect, useState } from "react";

/**
 * Downsample ảnh mask về lưới `cols × rows`, trả độ chói 0–1 mỗi ô (theo hàng chính).
 * Cùng origin với app → `getImageData` an toàn.
 */
export function useMaskLuminance(imageUrl: string, cols: number, rows: number): Float32Array | null {
  const [data, setData] = useState<Float32Array | null>(null);

  useEffect(() => {
    if (cols <= 0 || rows <= 0 || !imageUrl) {
      setData(null);
      return;
    }

    let cancelled = false;
    const img = new Image();

    const run = () => {
      const c = document.createElement("canvas");
      c.width = cols;
      c.height = rows;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, cols, rows);
      let id: ImageData;
      try {
        id = ctx.getImageData(0, 0, cols, rows);
      } catch {
        return;
      }
      const out = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const j = i * 4;
        const r = id.data[j]! / 255;
        const g = id.data[j + 1]! / 255;
        const b = id.data[j + 2]! / 255;
        out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }
      if (!cancelled) setData(out);
    };

    img.onload = () => {
      if (cancelled) return;
      run();
    };
    img.onerror = () => {
      if (!cancelled) setData(null);
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, cols, rows]);

  return data;
}
