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
 * 2. Lớp watermark full màn (`inset-0`), `isolate` để blend gọn trong vùng tường.
 * 3. Nền trong lớp (mờ trên lưới).
 * 4. Ảnh watermark phủ toàn màn + `mix-blend-mode` và opacity (upload).
 */
export function WallGraphicBlend({ blendMode, overlayOpacity }: Props) {
  return (
    <div
      aria-hidden
      className="wall-watermark-root pointer-events-none absolute inset-0 z-[1] min-h-0 min-w-0"
    >
      <div className="wall-watermark-frame relative isolate h-full w-full min-h-0 min-w-0 overflow-hidden">
        {/* Nền trong lớp — full màn */}
        <div
          className="wall-watermark-frame-bg absolute inset-0 bg-[#0b1020]/75"
          style={{ boxShadow: "inset 0 0 72px rgba(0,0,0,0.5)" }}
        />
        <div
          className="wall-watermark-art absolute inset-0 min-h-0 min-w-0"
          style={{
            mixBlendMode: blendMode,
            opacity: overlayOpacity,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WALL_GRAPHIC_URL}
            alt=""
            className="absolute inset-0 h-full w-full min-h-0 min-w-0 object-cover"
            draggable={false}
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}
