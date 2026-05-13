"use client";

import { WALL_GRAPHIC_MIX_BLEND, WALL_GRAPHIC_OVERLAY_OPACITY, WALL_GRAPHIC_URL } from "@/lib/wallGraphicUrls";

/**
 * Một ảnh overlay, `mix-blend-mode` chọn qua `lib/wallGraphicUrls.ts` (mặc định / env
 * `NEXT_PUBLIC_WALL_GRAPHIC_BLEND_MODE`).
 */
export function WallGraphicBlend() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden"
    >
      <div
        className="relative"
        style={{
          width: "min(100vw, calc(100vh * 16 / 9))",
          height: "min(100vh, calc(100vw * 9 / 16))",
          maxWidth: 1920,
          maxHeight: 1080,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            mixBlendMode: WALL_GRAPHIC_MIX_BLEND,
            opacity: WALL_GRAPHIC_OVERLAY_OPACITY,
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
