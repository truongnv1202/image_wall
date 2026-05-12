"use client";

import { useEffect, useState } from "react";

import {
  WALL_GRAPHIC_A,
  WALL_GRAPHIC_B,
  WALL_GRAPHIC_BLEND_MS,
  WALL_GRAPHIC_CYCLE_MS,
  WALL_GRAPHIC_IDLE_MS,
} from "@/lib/wallGraphicUrls";

type Props = {
  reducedMotion: boolean;
};

type Phase = "a" | "b" | "hidden";

/**
 * Hai ảnh thay phiên (A → B), rồi ẩn cả hai, nghỉ `WALL_GRAPHIC_IDLE_MS`, lặp lại từ A.
 */
export function WallGraphicBlend({ reducedMotion }: Props) {
  const [phase, setPhase] = useState<Phase>("a");

  useEffect(() => {
    if (reducedMotion) {
      setPhase("a");
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (t: ReturnType<typeof setTimeout>) => {
      timers.push(t);
    };

    const runCycle = () => {
      setPhase("a");
      push(
        setTimeout(() => {
          if (cancelled) return;
          setPhase("b");
          push(
            setTimeout(() => {
              if (cancelled) return;
              setPhase("hidden");
              push(
                setTimeout(() => {
                  if (cancelled) return;
                  runCycle();
                }, WALL_GRAPHIC_IDLE_MS),
              );
            }, WALL_GRAPHIC_CYCLE_MS),
          );
        }, WALL_GRAPHIC_CYCLE_MS),
      );
    };

    runCycle();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

  const durMs = reducedMotion ? 0 : WALL_GRAPHIC_BLEND_MS;
  const opacityA = phase === "a" ? 1 : 0;
  const opacityB = phase === "b" ? 1 : 0;

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
          style={{
            opacity: phase === "hidden" ? 0 : 0.9,
            transition: `opacity ${durMs}ms ease-in-out`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WALL_GRAPHIC_A}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              opacity: opacityA,
              transition: `opacity ${durMs}ms ease-in-out`,
              zIndex: phase === "a" ? 2 : 1,
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
              opacity: opacityB,
              transition: `opacity ${durMs}ms ease-in-out`,
              zIndex: phase === "b" ? 2 : 1,
            }}
            draggable={false}
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}
