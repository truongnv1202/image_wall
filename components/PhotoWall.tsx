"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import type { ImagesPayload } from "@/lib/types";
import { HERO_FLY_MS, HERO_POPUP_MS, STRIP_GAP_PX, STRIP_TILE_H, STRIP_TILE_W } from "@/lib/wallStripConstants";
import { WallGraphicBlend } from "@/components/WallGraphicBlend";

const POLL_MS = 4000;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<ImagesPayload>;
  });

type HeroState = { url: string; phase: "popup" | "fly" } | null;

function countTracks(axisPx: number, cellPx: number, gapPx: number): number {
  if (axisPx <= 0 || cellPx <= 0) return 0;
  const step = cellPx + gapPx;
  return Math.ceil((axisPx + gapPx) / step);
}

export function PhotoWall() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevImagesSnapshotRef = useRef<string[] | null>(null);
  const lastGoodPoolRef = useRef<string[] | null>(null);
  const heroQueueRef = useRef<string[]>([]);
  const [hero, setHero] = useState<HeroState>(null);
  const wallViewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 1200, h: 800 });

  const { data } = useSWR<ImagesPayload>("/api/images", fetcher, {
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
  });

  const pool = useMemo(() => {
    if (Array.isArray(data?.images) && data.images.length > 0) {
      lastGoodPoolRef.current = data.images;
      return data.images;
    }
    if (lastGoodPoolRef.current && lastGoodPoolRef.current.length > 0) {
      return lastGoodPoolRef.current;
    }
    return DEFAULT_IMAGE_URLS;
  }, [data?.images]);

  const rows = useMemo(
    () => countTracks(viewportSize.h, STRIP_TILE_H, STRIP_GAP_PX),
    [viewportSize.h],
  );

  /** Số ô theo chiều ngang vừa khít viewport — không lặp đôi / không marquee (nhẹ máy yếu). */
  const tilesPerRow = useMemo(
    () => countTracks(viewportSize.w, STRIP_TILE_W, STRIP_GAP_PX),
    [viewportSize.w],
  );

  const rowTiles = useMemo(() => {
    if (rows <= 0 || tilesPerRow <= 0) return [];
    const safe = pool.length > 0 ? pool : DEFAULT_IMAGE_URLS;
    const len = safe.length;
    return Array.from({ length: rows }, (_, row) => {
      const offset = row * 17;
      return Array.from({ length: tilesPerRow }, (_, i) => safe[(offset + i) % len]!);
    });
  }, [rows, tilesPerRow, pool]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Ảnh mới: hàng chờ popup → bay góc trái trên (27×36px, trùng ô lưới). */
  useEffect(() => {
    const imgs = data?.images;
    if (!imgs?.length) return;
    const prev = prevImagesSnapshotRef.current;
    const unchanged =
      prev !== null && prev.length === imgs.length && prev.every((u, i) => u === imgs[i]);
    if (unchanged) return;
    if (prev === null) {
      prevImagesSnapshotRef.current = imgs.slice();
      return;
    }
    const prevSet = new Set(prev);
    const added = imgs.filter((u) => !prevSet.has(u));
    prevImagesSnapshotRef.current = imgs.slice();
    for (const u of added) heroQueueRef.current.push(u);
    if (!added.length) return;

    setHero((h) => {
      if (h) return h;
      const next = heroQueueRef.current.shift();
      return next ? { url: next, phase: "popup" } : null;
    });
  }, [data?.images]);

  const finishHeroAndAdvance = useCallback(() => {
    setHero(() => {
      const n = heroQueueRef.current.shift();
      return n ? { url: n, phase: "popup" } : null;
    });
  }, []);

  useEffect(() => {
    if (!hero || hero.phase !== "popup") return;
    const url = hero.url;
    if (reducedMotion) {
      const t = window.setTimeout(() => {
        finishHeroAndAdvance();
      }, HERO_POPUP_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setHero((h) => (h && h.phase === "popup" && h.url === url ? { ...h, phase: "fly" } : h));
    }, HERO_POPUP_MS);
    return () => window.clearTimeout(t);
  }, [hero, reducedMotion, finishHeroAndAdvance]);

  useEffect(() => {
    if (!hero || hero.phase !== "fly") return;
    const t = window.setTimeout(() => {
      finishHeroAndAdvance();
    }, HERO_FLY_MS);
    return () => window.clearTimeout(t);
  }, [hero, finishHeroAndAdvance]);

  useEffect(() => {
    const el = wallViewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setViewportSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#0b1020]">
        <div
          ref={wallViewportRef}
          className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col overflow-hidden"
          style={{ gap: STRIP_GAP_PX }}
        >
          {rowTiles.map((tiles, row) => (
            <div
              key={row}
              className="min-h-0 w-full shrink-0 overflow-hidden"
              style={{ height: STRIP_TILE_H }}
            >
              <div className="flex h-full w-full min-w-0 flex-nowrap items-stretch" style={{ gap: STRIP_GAP_PX }}>
                {tiles.map((src, i) => (
                  <div
                    key={`${row}-${i}`}
                    className="shrink-0 overflow-hidden bg-[#0c1226]"
                    style={{
                      width: STRIP_TILE_W,
                      height: STRIP_TILE_H,
                      contentVisibility: "auto",
                      containIntrinsicSize: `${STRIP_TILE_W}px ${STRIP_TILE_H}px`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      width={STRIP_TILE_W}
                      height={STRIP_TILE_H}
                      className="block object-cover"
                      loading="lazy"
                      decoding="async"
                      sizes="27px"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <WallGraphicBlend />

        {hero ? (
          <div
            className="wall-hero-backdrop pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/45"
            aria-live="polite"
          >
            <div
              className={`wall-hero-card pointer-events-none overflow-hidden rounded-lg bg-black/20 shadow-2xl ring-1 ring-white/10 ${
                hero.phase === "popup" ? "wall-hero-card--popup" : "wall-hero-card--fly"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.url}
                alt=""
                className={`h-full w-full ${
                  hero.phase === "popup" ? "object-contain" : "object-cover"
                }`}
                decoding="async"
                fetchPriority="high"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
