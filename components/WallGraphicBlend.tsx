"use client";

import type { WallGraphicBlendMode } from "@/lib/wallGraphicUrls";
import { WALL_GRAPHIC_URL } from "@/lib/wallGraphicUrls";

type Props = {
  blendMode: WallGraphicBlendMode;
  /** 0–1, từ cấu hình tường — áp dụng cho lớp ảnh watermark (không phải nền trong khung). */
  overlayOpacity: number;
};

/**
 * Luồng hiển thị:
 * 1. Lưới ảnh nền (PhotoWall, lớp z-0).
 * 2. Khung 16:9 giữa màn hình — `isolate` để blend chỉ trong khung.
 * 3. Nền trong khung (màu/độ mờ) trên vùng lưới.
 * 4. Ảnh watermark đè lên + `mix-blend-mode` và opacity từ `/api/wall-text` (upload).
 */
export function WallGraphicBlend({ blendMode, overlayOpacity }: Props) {
  return (
    <div
      aria-hidden
      className="wall-watermark-root pointer-events-none absolute inset-0 z-[1] flex items-center justify-center"
    >
      <div
        className="wall-watermark-frame relative isolate overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15"
        style={{
          width: "min(100vw, calc(100vh * 16 / 9))",
          height: "min(100vh, calc(100vw * 9 / 16))",
          maxWidth: 1920,
          maxHeight: 1080,
        }}
      >
        {/* Bước 1 — nền trong khung (trên lưới ảnh toàn màn phía dưới) */}
        <div
          className="wall-watermark-frame-bg absolute inset-0 bg-[#0b1020]/75"
          style={{ boxShadow: "inset 0 0 72px rgba(0,0,0,0.5)" }}
        />
        {/* Bước 2 — ảnh watermark + blend (cấu hình upload) */}
        <div
          className="wall-watermark-art absolute inset-0"
          style={{
            mixBlendMode: blendMode,
            opacity: overlayOpacity,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WALL_GRAPHIC_URL}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}
