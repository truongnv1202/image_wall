"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import type { ImagesPayload } from "@/lib/types";
import type { WallTextPayload } from "@/lib/wallTextStore";
import { HERO_FLY_MS, HERO_POPUP_MS, STRIP_GAP_PX, STRIP_TILE_H, STRIP_TILE_W } from "@/lib/wallStripConstants";

const POLL_MS = 4000;
const WALL_TEXT_POLL_MS = 10_000;

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<ImagesPayload>;
  });

const fetcherWallText = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<WallTextPayload>;
  });

type WallOverlayMeta = {
  exists: boolean;
  version: number;
  width: number | null;
  height: number | null;
};

const fetcherOverlayMeta = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<WallOverlayMeta>;
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
  const lastGoodUploadPoolRef = useRef<string[] | null>(null);
  const heroQueueRef = useRef<string[]>([]);
  const [hero, setHero] = useState<HeroState>(null);
  const wallViewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: 1200, h: 800 });

  const { data } = useSWR<ImagesPayload>("/api/images", fetcher, {
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
  });
  const { data: wallCfg } = useSWR<WallTextPayload>("/api/wall-text", fetcherWallText, {
    refreshInterval: WALL_TEXT_POLL_MS,
    revalidateOnFocus: true,
  });
  const { data: overlayMeta } = useSWR<WallOverlayMeta>("/api/wall-overlay-a", fetcherOverlayMeta, {
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
  });

  /** Chỉ ảnh gửi qua API/upload (`/uploads/...`) — không dùng URL mẫu. */
  const uploadPool = useMemo(() => {
    const raw = Array.isArray(data?.images) && data.images.length > 0 ? data.images : [];
    const uploads = raw.filter((u) => typeof u === "string" && u.startsWith("/uploads/"));
    if (uploads.length > 0) {
      lastGoodUploadPoolRef.current = uploads;
      return uploads;
    }
    if (lastGoodUploadPoolRef.current && lastGoodUploadPoolRef.current.length > 0) {
      return lastGoodUploadPoolRef.current;
    }
    return [];
  }, [data?.images]);

  const tileW = wallCfg?.gridTileWidthPx ?? STRIP_TILE_W;
  const tileH = wallCfg?.gridTileHeightPx ?? STRIP_TILE_H;

  const rows = useMemo(
    () => countTracks(viewportSize.h, tileH, STRIP_GAP_PX),
    [viewportSize.h, tileH],
  );

  const tilesPerRow = useMemo(
    () => countTracks(viewportSize.w, tileW, STRIP_GAP_PX),
    [viewportSize.w, tileW],
  );

  const rowTiles = useMemo(() => {
    if (rows <= 0 || tilesPerRow <= 0 || uploadPool.length === 0) return [];
    const len = uploadPool.length;
    return Array.from({ length: rows }, (_, row) => {
      const offset = row * 17;
      return Array.from({ length: tilesPerRow }, (_, i) => uploadPool[(offset + i) % len]!);
    });
  }, [rows, tilesPerRow, uploadPool]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** Ảnh upload mới: popup giữa màn → thu về góc (chỉ URL `/uploads/`). */
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
    const added = imgs.filter((u) => !prevSet.has(u) && u.startsWith("/uploads/"));
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
        >
          {uploadPool.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-500">
              <p>Chưa có ảnh upload trên tường.</p>
              <p className="max-w-md text-xs text-zinc-600">
                Gửi file qua <code className="text-zinc-400">POST /api/upload</code> (multipart{" "}
                <code className="text-zinc-400">file</code>, kèm token).
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ gap: STRIP_GAP_PX }}>
              {rowTiles.map((tiles, row) => (
                <div
                  key={row}
                  className="min-h-0 w-full shrink-0 overflow-hidden"
                  style={{ height: tileH }}
                >
                  <div className="flex h-full w-full min-w-0 flex-nowrap items-stretch" style={{ gap: STRIP_GAP_PX }}>
                    {tiles.map((src, i) => (
                      <div
                        key={`${row}-${i}`}
                        className="shrink-0 overflow-hidden bg-[#0c1226]"
                        style={{
                          width: tileW,
                          height: tileH,
                          contentVisibility: "auto",
                          containIntrinsicSize: `${tileW}px ${tileH}px`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          width={tileW}
                          height={tileH}
                          className="block object-cover"
                          loading="lazy"
                          decoding="async"
                          sizes={`${tileW}px`}
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {overlayMeta?.exists === true && overlayMeta.version > 0 ? (
          <div
            className="pointer-events-none absolute inset-0 z-[50] min-h-0 min-w-0"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/wall-overlay-a/image?v=${overlayMeta.version}`}
              alt=""
              width={overlayMeta.width && overlayMeta.height ? overlayMeta.width : undefined}
              height={overlayMeta.width && overlayMeta.height ? overlayMeta.height : undefined}
              className="h-full w-full object-contain object-center opacity-100"
              decoding="async"
              draggable={false}
            />
          </div>
        ) : null}

        {hero ? (
          <div
            className="wall-hero-backdrop pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/45"
            aria-live="polite"
          >
            <div
              className={`wall-hero-card pointer-events-none overflow-hidden rounded-lg bg-black/20 shadow-2xl ring-1 ring-white/10 ${
                hero.phase === "popup" ? "wall-hero-card--popup" : "wall-hero-card--fly"
              }`}
              style={
                hero.phase === "fly"
                  ? {
                      top: 12,
                      left: 12,
                      width: tileW,
                      height: tileH,
                      maxWidth: tileW,
                      maxHeight: tileH,
                      transform: "none",
                    }
                  : undefined
              }
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
