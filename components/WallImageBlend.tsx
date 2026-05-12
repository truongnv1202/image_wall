"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  WALL_OVERLAY_BLEND_MS,
  WALL_OVERLAY_DISPLAY_MS,
  WALL_OVERLAY_MIX_BLEND_MODE,
  WALL_OVERLAY_STACK_OPACITY,
  WALL_OVERLAY_URLS,
} from "@/lib/wallOverlayConstants";

type Props = {
  reducedMotion: boolean;
};

const blendLayerStyle = {
  mixBlendMode: WALL_OVERLAY_MIX_BLEND_MODE,
} satisfies CSSProperties;

/**
 * Hai ảnh luân phiên: phủ kín tường (`object-cover`) + crossfade opacity,
 * `mix-blend-mode` để hòa vào lưới ảnh phía dưới.
 */
export function WallImageBlend({ reducedMotion }: Props) {
  const [baseIdx, setBaseIdx] = useState(0);
  const [blend, setBlend] = useState(0);
  /** Sau khi reset blend=0 cần một khung hình không transition, tránh “nháy” opacity. */
  const skipTransitionRef = useRef(false);
  /** Chỉ swap khi vừa chủ động gọi setBlend(1) — tránh transitionEnd thừa. */
  const pendingSwapRef = useRef(false);

  const urls = WALL_OVERLAY_URLS;
  const topIdx = (baseIdx + 1) % urls.length;

  const bump = useCallback(() => {
    skipTransitionRef.current = true;
    setBaseIdx((i) => (i + 1) % urls.length);
    setBlend(0);
    requestAnimationFrame(() => {
      skipTransitionRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      const id = window.setInterval(() => {
        setBaseIdx((i) => (i + 1) % urls.length);
      }, WALL_OVERLAY_DISPLAY_MS);
      return () => window.clearInterval(id);
    }

    const tick = () => {
      pendingSwapRef.current = true;
      setBlend(1);
    };
    const id = window.setInterval(tick, WALL_OVERLAY_DISPLAY_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const onTopTransitionEnd = (e: React.TransitionEvent<HTMLImageElement>) => {
    if (reducedMotion || e.propertyName !== "opacity") return;
    if (!pendingSwapRef.current) return;
    pendingSwapRef.current = false;
    bump();
  };

  const transitionMs = skipTransitionRef.current ? 0 : WALL_OVERLAY_BLEND_MS;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      style={{ opacity: WALL_OVERLAY_STACK_OPACITY }}
    >
      <div className="absolute inset-0" style={blendLayerStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[baseIdx]}
          alt=""
          className="absolute inset-0 block h-full w-full min-h-full min-w-full object-cover"
          style={{
            opacity: reducedMotion ? 1 : 1 - blend,
            transition: reducedMotion ? undefined : `opacity ${transitionMs}ms ease-in-out`,
          }}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[topIdx]}
          alt=""
          className="absolute inset-0 block h-full w-full min-h-full min-w-full object-cover"
          style={{
            opacity: reducedMotion ? 0 : blend,
            transition: reducedMotion ? undefined : `opacity ${transitionMs}ms ease-in-out`,
          }}
          onTransitionEnd={onTopTransitionEnd}
          draggable={false}
        />
      </div>
    </div>
  );
}
