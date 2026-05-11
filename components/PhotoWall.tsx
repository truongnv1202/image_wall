"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { notoSans } from "@/app/fonts";
import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import { buildTextMask } from "@/lib/textMask";
import type { ImagesPayload } from "@/lib/types";
import {
  GRID_COLS as DEFAULT_GRID_COLS,
  GRID_ROWS as DEFAULT_GRID_ROWS,
  WALL_MASK_TEXT,
} from "@/lib/wallConstants";
import type { WallTextPayload } from "@/lib/wallTextStore";

const POLL_MS = 4000;
const WALL_TEXT_POLL_MS = 10_000;

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
  isText: boolean;
};

type PhraseWavePhase = "idle" | "bloom" | "settle";

function buildCells(mask: boolean[][], images: string[], cols: number, rows: number): WallCell[] {
  const safe = images.length > 0 ? images : DEFAULT_IMAGE_URLS;
  const len = safe.length;
  const cells: WallCell[] = [];
  let textOrdinal = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const flatIndex = r * cols + c;
      const isText = Boolean(mask[r]?.[c]);
      cells.push({
        key: `${r}-${c}`,
        src: safe[flatIndex % len],
        isText,
        textOrdinal: isText ? textOrdinal++ : -1,
      });
    }
  }
  return cells;
}

/** Trễ sóng theo khoảng cách từ tâm khối chữ (ô chữ sáng dần lan ra). */
function buildTextWaveDelaysMs(mask: boolean[][], rows: number, cols: number, staggerMax: number) {
  const map = new Map<string, number>();
  let sumR = 0;
  let sumC = 0;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r]?.[c]) {
        sumR += r;
        sumC += c;
        n++;
      }
    }
  }
  const cy = n > 0 ? sumR / n : rows / 2;
  const cx = n > 0 ? sumC / n : cols / 2;
  let maxD = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r]?.[c]) {
        const d = Math.hypot(c - cx, r - cy);
        if (d > maxD) maxD = d;
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r]?.[c]) {
        const d = Math.hypot(c - cx, r - cy);
        map.set(`${r}-${c}`, (d / maxD) * staggerMax);
      }
    }
  }
  return map;
}

export function PhotoWall() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [mask, setMask] = useState<boolean[][] | null>(null);
  const [wavePhase, setWavePhase] = useState<PhraseWavePhase>("idle");
  const [reducedMotion, setReducedMotion] = useState(false);
  const wavePhaseRef = useRef<PhraseWavePhase>("idle");
  const nextMaskRef = useRef<boolean[][] | null>(null);

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

  const wallAspectW = gridCols * 3;
  const wallAspectH = gridRows * 4;

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
    if (wavePhase !== "idle") return;
    let cancelled = false;
    const text = (phrases[phraseIndex % phrases.length] || WALL_MASK_TEXT).toUpperCase();
    buildTextMask({
      text,
      cols: gridCols,
      rows: gridRows,
      fontFamily: notoSans.style.fontFamily,
    }).then((m) => {
      if (!cancelled) setMask(m);
    });
    return () => {
      cancelled = true;
    };
  }, [phraseIndex, phrases, gridCols, gridRows, wavePhase]);

  useEffect(() => {
    if (wavePhase !== "bloom" || reducedMotion) return;
    const nextIdx = (phraseIndex + 1) % phrases.length;
    const nextText = (phrases[nextIdx] || WALL_MASK_TEXT).toUpperCase();
    let unmounted = false;
    nextMaskRef.current = null;
    const maskPromise = buildTextMask({
      text: nextText,
      cols: gridCols,
      rows: gridRows,
      fontFamily: notoSans.style.fontFamily,
    });
    void maskPromise.then((m) => {
      if (!unmounted) nextMaskRef.current = m;
    });
    const t = window.setTimeout(() => {
      const m = nextMaskRef.current;
      if (m) {
        setMask(m);
        setPhraseIndex(nextIdx);
        setWavePhase("settle");
      } else {
        void maskPromise.then((m2) => {
          setMask(m2);
          setPhraseIndex(nextIdx);
          setWavePhase("settle");
        });
      }
    }, bloomTotalMs);
    return () => {
      unmounted = true;
      window.clearTimeout(t);
    };
  }, [wavePhase, phraseIndex, phrases, gridCols, gridRows, bloomTotalMs, reducedMotion]);

  useEffect(() => {
    if (wavePhase !== "settle" || reducedMotion) return;
    const t = window.setTimeout(() => setWavePhase("idle"), settleDurMs + 80);
    return () => window.clearTimeout(t);
  }, [wavePhase, settleDurMs, reducedMotion]);

  const waveDelays = useMemo(() => {
    if (!mask) return new Map<string, number>();
    return buildTextWaveDelaysMs(mask, gridRows, gridCols, staggerMax);
  }, [mask, gridCols, gridRows, staggerMax]);

  const pool = data?.images?.length ? data.images : DEFAULT_IMAGE_URLS;

  const cells = useMemo(() => {
    if (!mask) return null;
    return buildCells(mask, pool, gridCols, gridRows);
  }, [gridCols, gridRows, mask, pool]);

  const waveClass =
    wavePhase === "bloom" ? "phrase-wave-bloom" : wavePhase === "settle" ? "phrase-wave-settle" : "";
  const animating = wavePhase === "bloom" || wavePhase === "settle";

  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
      <div
        className="relative max-h-full max-w-full overflow-hidden rounded-md border border-[#2a2f3f] bg-[#0b1020] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{
          aspectRatio: `${wallAspectW} / ${wallAspectH}`,
          width: "auto",
          height: "auto",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        <div
          className={`grid h-full w-full gap-0 ${waveClass}`}
          style={
            {
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
              ["--wall-bloom-dur" as string]: `${bloomDurMs}ms`,
              ["--wall-settle-dur" as string]: `${settleDurMs}ms`,
            } as CSSProperties
          }
        >
          {(cells ?? Array.from({ length: gridCols * gridRows })).map((cell, i) => {
            const isText = Boolean(cell?.isText);
            const delayMs = cell ? (waveDelays.get(cell.key) ?? 0) : 0;
            return (
              <div
                key={cell?.key ?? `loading-${i}`}
                className={`relative min-h-0 min-w-0 overflow-hidden bg-[#0c1226] ${isText ? "wall-cell--text" : ""}`}
                style={
                  isText
                    ? ({ ["--wave-delay" as string]: `${delayMs}ms` } as CSSProperties)
                    : undefined
                }
              >
                {cell ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cell.src}
                      alt=""
                      draggable={false}
                      className={
                        isText
                          ? animating
                            ? "h-full w-full object-contain"
                            : `h-full w-full object-contain transition-[filter] ease-out brightness-[1.04] contrast-[1.05] saturate-[1.06]`
                          : "h-full w-full object-contain"
                      }
                      style={
                        isText && !animating
                          ? { transitionDuration: `${Math.min(600, crossfadeMs)}ms` }
                          : undefined
                      }
                      loading="lazy"
                      decoding="async"
                    />
                    {/* Nền ảnh mẫu: phủ tối ~70% lên ô ngoài chữ; ô chữ không phủ → ảnh sáng “xuyên lỗ”. */}
                    {!isText ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[rgba(4,8,18,0.72)]"
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
