"use client";

import { useEffect, useState } from "react";

import {
  WALL_GRAPHIC_A,
  WALL_GRAPHIC_B,
  WALL_GRAPHIC_BLEND_MS,
  WALL_GRAPHIC_CYCLE_MS,
  WALL_GRAPHIC_REST_AFTER_BOTH_MS,
} from "@/lib/wallGraphicUrls";

type Props = {
  reducedMotion: boolean;
};

/**
 * Hai ảnh: A → B → nghỉ → A → … Crossfade + mix-blend lên lưới phía dưới.
 */
export function WallGraphicBlend({ reducedMotion }: Props) {
  const [showFirst, setShowFirst] = useState(true);

  useEffect(() => {
    if (reducedMotion) return;
    const ids: number[] = [];
    let alive = true;
    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!alive) return;
        fn();
      }, ms);
      ids.push(id);
    };
    const cycleFromA = () => {
      setShowFirst(true);
      later(WALL_GRAPHIC_CYCLE_MS, () => {
        setShowFirst(false);
        later(WALL_GRAPHIC_CYCLE_MS, () => {
          later(WALL_GRAPHIC_REST_AFTER_BOTH_MS, () => {
            cycleFromA();
          });
        });
      });
    };
    cycleFromA();
    return () => {
      alive = false;
      for (const id of ids) window.clearTimeout(id);
    };
  }, [reducedMotion]);

  const durMs = reducedMotion ? 0 : WALL_GRAPHIC_BLEND_MS;

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
          className="absolute inset-0 mix-blend-soft-light"
          style={{ opacity: 0.9 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WALL_GRAPHIC_A}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              opacity: showFirst ? 1 : 0,
              transition: `opacity ${durMs}ms ease-in-out`,
              zIndex: showFirst ? 2 : 1,
            }}
            draggable={false}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WALL_GRAPHIC_B}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              opacity: showFirst ? 0 : 1,
              transition: `opacity ${durMs}ms ease-in-out`,
              zIndex: showFirst ? 1 : 2,
            }}
            draggable={false}
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}
