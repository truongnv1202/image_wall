"use client";

import type { WallGraphicBlendMode } from "@/lib/wallGraphicUrls";
import { WALL_GRAPHIC_OVERLAY_OPACITY, WALL_GRAPHIC_URL } from "@/lib/wallGraphicUrls";

type Props = {
  blendMode: WallGraphicBlendMode;
};

/**
 * Một ảnh overlay; `mix-blend-mode` do cấu hình tường (`/api/wall-text`, chỉnh trên trang upload).
 */
export function WallGraphicBlend({ blendMode }: Props) {
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
            mixBlendMode: blendMode,
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
