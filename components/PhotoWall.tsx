"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { notoSans } from "@/app/fonts";
import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import type { ImagesPayload } from "@/lib/types";
import { wallPhraseMaskDataUrl } from "@/lib/wallPhraseMask";
import {
  GRID_COLS as DEFAULT_GRID_COLS,
  GRID_ROWS as DEFAULT_GRID_ROWS,
  WALL_CELL_ASPECT_H,
  WALL_CELL_ASPECT_W,
  WALL_MASK_TEXT,
} from "@/lib/wallConstants";
import type { WallTextPayload } from "@/lib/wallTextStore";

const POLL_MS = 4000;
const WALL_TEXT_POLL_MS = 10_000;
/** Ảnh mới: thu scale vào ô (ms). */
const NEW_IMAGE_ENTRANCE_MS = 900;

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

type WallCell = {
  key: string;
  src: string;
};

type PhraseWavePhase = "idle" | "bloom" | "settle";

function buildCells(images: string[], cols: number, rows: number): WallCell[] {
  const safe = images.length > 0 ? images : DEFAULT_IMAGE_URLS;
  const len = safe.length;
  const cells: WallCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const flatIndex = r * cols + c;
      cells.push({
        key: `${r}-${c}`,
        src: safe[flatIndex % len],
      });
    }
  }
  return cells;
}

export function PhotoWall() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [wavePhase, setWavePhase] = useState<PhraseWavePhase>("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const wavePhaseRef = useRef<PhraseWavePhase>("idle");
  const prevImagesSnapshotRef = useRef<string[] | null>(null);
  const pendingEntranceTimersRef = useRef<number[]>([]);
  const [newImageEntranceUrls, setNewImageEntranceUrls] = useState(() => new Set<string>());

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
  const crossfadeMs = wallText?.phraseCrossfadeMs ?? 800;
  const gridCols = wallText?.gridCols ?? DEFAULT_GRID_COLS;
  const gridRows = wallText?.gridRows ?? DEFAULT_GRID_ROWS;

  const staggerMax = Math.round(Math.min(580, Math.max(220, crossfadeMs * 0.65)));
  const bloomDurMs = Math.round(Math.min(1200, Math.max(720, crossfadeMs * 1.15)));
  const settleDurMs = Math.round(Math.min(1400, Math.max(780, crossfadeMs * 1.35)));
  const bloomTotalMs = bloomDurMs + staggerMax + 140;

  const wallAspectW = gridCols * WALL_CELL_ASPECT_W;
  const wallAspectH = gridRows * WALL_CELL_ASPECT_H;

  const displayPhrase = (phrases[phraseIndex % phrases.length] || WALL_MASK_TEXT).toUpperCase();
  const phraseMaskUrl = useMemo(
    () => wallPhraseMaskDataUrl(displayPhrase, notoSans.style.fontFamily),
    [displayPhrase, notoSans.style.fontFamily],
  );

  useEffect(() => {
    wavePhaseRef.current = wavePhase;
  }, [wavePhase]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setNewImageEntranceUrls(new Set());
    }
  }, [reducedMotion]);

  useEffect(() => {
    return () => {
      for (const t of pendingEntranceTimersRef.current) window.clearTimeout(t);
      pendingEntranceTimersRef.current = [];
    };
  }, []);

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
    if (!added.length || reducedMotion) return;

    setNewImageEntranceUrls((s) => {
      const next = new Set(s);
      for (const u of added) next.add(u);
      return next;
    });

    for (const u of added) {
      const tid = window.setTimeout(() => {
        pendingEntranceTimersRef.current = pendingEntranceTimersRef.current.filter((x) => x !== tid);
        setNewImageEntranceUrls((s) => {
          if (!s.has(u)) return s;
          const next = new Set(s);
          next.delete(u);
          return next;
        });
      }, NEW_IMAGE_ENTRANCE_MS) as unknown as number;
      pendingEntranceTimersRef.current.push(tid);
    }
  }, [data?.images, reducedMotion]);

  useEffect(() => {
    setPhraseIndex((i) => i % Math.max(1, phrases.length));
  }, [phrases]);

  useEffect(() => {
    if (rotateMs <= 0 || phrases.length <= 1) return;
    if (reducedMotion) {
      const id = window.setInterval(() => {
        if (wavePhaseRef.current !== "idle") return;
        setPhraseIndex((i) => (i + 1) % phrases.length);
      }, rotateMs);
      return () => window.clearInterval(id);
    }
    const id = window.setInterval(() => {
      if (wavePhaseRef.current !== "idle") return;
      setWavePhase("bloom");
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [rotateMs, phrases.length, reducedMotion]);

  useEffect(() => {
    if (wavePhase !== "bloom" || reducedMotion) return;
    const nextIdx = (phraseIndex + 1) % phrases.length;
    let unmounted = false;
    const t = window.setTimeout(() => {
      if (!unmounted) {
        setPhraseIndex(nextIdx);
        setWavePhase("settle");
      }
    }, bloomTotalMs);
    return () => {
      unmounted = true;
      window.clearTimeout(t);
    };
  }, [wavePhase, phraseIndex, phrases, bloomTotalMs, reducedMotion]);

  useEffect(() => {
    if (wavePhase !== "settle" || reducedMotion) return;
    const t = window.setTimeout(() => setWavePhase("idle"), settleDurMs + 80);
    return () => window.clearTimeout(t);
  }, [wavePhase, settleDurMs, reducedMotion]);

  const pool = data?.images?.length ? data.images : DEFAULT_IMAGE_URLS;

  const cells = useMemo(() => buildCells(pool, gridCols, gridRows), [gridCols, gridRows, pool]);

  const waveClass =
    wavePhase === "bloom" ? "phrase-wave-bloom" : wavePhase === "settle" ? "phrase-wave-settle" : "";
  const animating = wavePhase === "bloom" || wavePhase === "settle";

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

  const mosaicAspectStyle = {
    aspectRatio: `${wallAspectW} / ${wallAspectH}`,
    maxWidth: "100%",
    maxHeight: "100%",
  } as const;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
      {/* Khung 16:9: cần chiều ngang xác định (w-full) — tránh width/height auto khiến khung 0px và ảnh không vẽ. */}
      <div
        className="relative aspect-video w-full max-w-full shrink-0 overflow-hidden rounded-md border border-[#2a2f3f] bg-[#0b1020] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ maxHeight: "100%" }}
      >
        <div className="absolute inset-0 flex min-h-0 min-w-0 items-center justify-center">
          <div
            className={`relative min-h-0 min-w-0 ${waveClass}`}
            style={
              {
                ...mosaicAspectStyle,
                height: "100%",
                width: "auto",
                minWidth: 0,
                minHeight: 0,
                ["--wall-bloom-dur" as string]: `${bloomDurMs}ms`,
                ["--wall-settle-dur" as string]: `${settleDurMs}ms`,
                ["--wall-new-entrance-dur" as string]: `${NEW_IMAGE_ENTRANCE_MS}ms`,
              } as CSSProperties
            }
          >
            <div
              className="wall-grid grid h-full w-full gap-0"
              style={
                {
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
                } as CSSProperties
              }
            >
              {cells.map((cell) => {
                const incoming = newImageEntranceUrls.has(cell.src);
                return (
                  <div
                    key={cell.key}
                    className="relative min-h-0 min-w-0 overflow-hidden bg-[#0c1226]"
                  >
                    <div
                      className={
                        incoming
                          ? "wall-new-img-scale-entrance flex h-full w-full min-h-0 min-w-0 items-center justify-center"
                          : "flex h-full w-full min-h-0 min-w-0 items-center justify-center"
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cell.src}
                        alt=""
                        draggable={false}
                        className={
                          animating
                            ? "wall-grid-img-wave h-full w-full object-contain"
                            : "h-full w-full object-contain transition-[filter] ease-out"
                        }
                        style={
                          !animating
                            ? { transitionDuration: `${Math.min(600, crossfadeMs)}ms` }
                            : undefined
                        }
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              aria-hidden
              className="wall-text-overlay pointer-events-none absolute inset-0 bg-[rgba(4,8,18,0.72)]"
              style={overlayStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
