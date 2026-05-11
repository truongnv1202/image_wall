"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { notoSans } from "@/app/fonts";
import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import type { ImagesPayload } from "@/lib/types";
import {
  HERO_FLY_MS,
  HERO_MAX_H,
  HERO_MAX_W,
  HERO_POPUP_MS,
  STAGE_H,
  STAGE_W,
  STRIP_GAP_PX,
  STRIP_MIN_HALF_LEN,
  STRIP_TILE_H,
  STRIP_TILE_W,
} from "@/lib/wallStripConstants";
import { wallPhraseMaskDataUrl } from "@/lib/wallPhraseMask";
import { WALL_MASK_TEXT } from "@/lib/wallConstants";
import type { WallTextPayload } from "@/lib/wallTextStore";

const POLL_MS = 4000;
const WALL_TEXT_POLL_MS = 10_000;
/** Tốc độ trôi dải ảnh (px/giây). */
const MARQUEE_PX_PER_SEC = 38;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<ImagesPayload>;
  });

const fetcherWallText = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<WallTextPayload>;
  });

type HeroState = { url: string; phase: "popup" | "fly" } | null;

async function makeThumbBlobUrl(src: string): Promise<string | null> {
  try {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load"));
      img.src = src;
    });
    await img.decode?.();
    const canvas = document.createElement("canvas");
    canvas.width = STRIP_TILE_W;
    canvas.height = STRIP_TILE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, STRIP_TILE_W, STRIP_TILE_H);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
    );
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function buildStripHalf(pool: string[]): string[] {
  const safe = pool.length > 0 ? pool : DEFAULT_IMAGE_URLS;
  const len = safe.length;
  const half: string[] = [];
  let i = 0;
  while (half.length < STRIP_MIN_HALF_LEN) {
    half.push(safe[i % len]!);
    i++;
  }
  return half;
}

export function PhotoWall() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevImagesSnapshotRef = useRef<string[] | null>(null);
  const lastGoodPoolRef = useRef<string[] | null>(null);
  const heroQueueRef = useRef<string[]>([]);
  const [hero, setHero] = useState<HeroState>(null);
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  const blobUrlsRef = useRef(new Set<string>());

  const { data } = useSWR<ImagesPayload>("/api/images", fetcher, {
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
  });
  const { data: wallText } = useSWR<WallTextPayload>("/api/wall-text", fetcherWallText, {
    refreshInterval: WALL_TEXT_POLL_MS,
    revalidateOnFocus: true,
  });

  const phrases = useMemo(() => {
    if (!wallText?.phrases?.length) return [WALL_MASK_TEXT];
    const t = wallText.phrases.map((p) => p.trim()).filter((p) => p.length > 0);
    return t.length > 0 ? t : [WALL_MASK_TEXT];
  }, [wallText]);

  const rotateMs = wallText?.rotateIntervalMs ?? 60_000;

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

  const stripHalf = useMemo(() => buildStripHalf(pool), [pool]);
  const stripDup = useMemo(() => [...stripHalf, ...stripHalf], [stripHalf]);

  const halfWidthPx = stripHalf.length * (STRIP_TILE_W + STRIP_GAP_PX);
  const marqueeDurSec = Math.max(48, halfWidthPx / MARQUEE_PX_PER_SEC);

  const displayPhrase = (phrases[phraseIndex % phrases.length] || WALL_MASK_TEXT).toUpperCase();
  const phraseMaskUrl = useMemo(
    () => wallPhraseMaskDataUrl(displayPhrase, notoSans.style.fontFamily),
    [displayPhrase, notoSans.style.fontFamily],
  );

  const revokeBlob = useCallback((u: string) => {
    if (blobUrlsRef.current.has(u)) {
      URL.revokeObjectURL(u);
      blobUrlsRef.current.delete(u);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (rotateMs <= 0 || phrases.length <= 1) return;
    const id = window.setInterval(
      () => setPhraseIndex((i) => (i + 1) % phrases.length),
      rotateMs,
    );
    return () => window.clearInterval(id);
  }, [rotateMs, phrases.length]);

  useEffect(() => {
    setPhraseIndex((i) => i % Math.max(1, phrases.length));
  }, [phrases]);

  /** Ảnh mới: hàng chờ popup → bay góc trái trên → thumbnail 27×36 cho dải. */
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

  const finishHeroAndAdvance = useCallback(
    async (url: string) => {
      const blob = await makeThumbBlobUrl(url);
      setThumbMap((prev) => {
        const next = { ...prev };
        const old = next[url];
        if (old) revokeBlob(old);
        if (blob) {
          next[url] = blob;
          blobUrlsRef.current.add(blob);
        }
        return next;
      });
      setHero(() => {
        const n = heroQueueRef.current.shift();
        return n ? { url: n, phase: "popup" } : null;
      });
    },
    [revokeBlob],
  );

  useEffect(() => {
    if (!hero || hero.phase !== "popup") return;
    const url = hero.url;
    if (reducedMotion) {
      const t = window.setTimeout(() => {
        void finishHeroAndAdvance(url);
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
    const url = hero.url;
    const t = window.setTimeout(() => {
      void finishHeroAndAdvance(url);
    }, HERO_FLY_MS);
    return () => window.clearTimeout(t);
  }, [hero, finishHeroAndAdvance]);

  useEffect(() => {
    return () => {
      for (const b of blobUrlsRef.current) URL.revokeObjectURL(b);
      blobUrlsRef.current.clear();
    };
  }, []);

  const overlayStyle = {
    WebkitMaskImage: phraseMaskUrl,
    maskImage: phraseMaskUrl,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as CSSProperties;

  const stageStyle = {
    width: `min(100%, ${STAGE_W}px)`,
    aspectRatio: `${STAGE_W} / ${STAGE_H}`,
    maxHeight: "100%",
  } as const;

  const marqueeStyle = {
    ["--wall-marquee-dur" as string]: `${marqueeDurSec}s`,
  } as CSSProperties;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
      <div
        className="relative shrink-0 overflow-hidden rounded-md border border-[#2a2f3f] bg-[#0b1020] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={stageStyle}
      >
        {/* Dải ảnh 27×36, lặp pool, trôi ngang; lazy để nhẹ. */}
        <div className="absolute inset-x-0 top-1/2 z-0 flex -translate-y-1/2 items-center px-2">
          <div
            className="wall-marquee-viewport relative w-full overflow-hidden"
            style={{ height: STRIP_TILE_H }}
          >
            <div
              className={`wall-marquee-track flex ${!reducedMotion ? "wall-marquee-animate" : ""}`}
              style={{ gap: STRIP_GAP_PX, ...marqueeStyle }}
            >
              {stripDup.map((src, i) => (
                <div
                  key={`${i}-${src}`}
                  className="shrink-0 overflow-hidden rounded-[2px] bg-[#0c1226]"
                  style={{ width: STRIP_TILE_W, height: STRIP_TILE_H }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbMap[src] ?? src}
                    alt=""
                    width={STRIP_TILE_W}
                    height={STRIP_TILE_H}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="wall-text-overlay pointer-events-none absolute inset-0 z-[1] bg-[rgba(4,8,18,0.72)]"
          style={overlayStyle}
        />

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
                className="h-full w-full object-contain"
                decoding="async"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
