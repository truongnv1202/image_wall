"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { notoSans } from "@/app/fonts";
import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import { buildTextMask } from "@/lib/textMask";
import type { ImagesPayload } from "@/lib/types";
import {
  GRID_COLS as DEFAULT_GRID_COLS,
  GRID_ROWS as DEFAULT_GRID_ROWS,
  TEXT_OVERLAY_COLORS,
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
  textOrdinal: number;
};

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

export function PhotoWall() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [mask, setMask] = useState<boolean[][] | null>(null);
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
  const displayCount = wallText?.displayImageCount ?? 1000;
  const activePhrase = useMemo(
    () => (phrases[phraseIndex % phrases.length] || WALL_MASK_TEXT).toUpperCase(),
    [phraseIndex, phrases],
  );

  useEffect(() => {
    setPhraseIndex((i) => i % Math.max(1, phrases.length));
  }, [phrases]);

  useEffect(() => {
    if (rotateMs <= 0 || phrases.length <= 1) return;
    const id = window.setInterval(() => {
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [rotateMs, phrases.length]);

  useEffect(() => {
    let cancelled = false;
    buildTextMask({
      text: activePhrase,
      cols: gridCols,
      rows: gridRows,
      fontFamily: notoSans.style.fontFamily,
    }).then((m) => {
      if (!cancelled) setMask(m);
    });
    return () => {
      cancelled = true;
    };
  }, [activePhrase, gridCols, gridRows]);

  const poolRaw = data?.images?.length ? data.images : DEFAULT_IMAGE_URLS;
  const pool = useMemo(() => {
    const n = Math.max(1, Math.min(displayCount, poolRaw.length));
    return poolRaw.slice(0, n);
  }, [displayCount, poolRaw]);

  const cells = useMemo(() => {
    if (!mask) return null;
    return buildCells(mask, pool, gridCols, gridRows);
  }, [gridCols, gridRows, mask, pool]);

  return (
    <div className="flex w-full justify-center px-1 py-2 sm:px-2">
      <div
        className="relative w-full max-w-[min(100vw,2200px)] overflow-hidden rounded-md border border-[#2a2f3f] bg-[#0b1020] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ aspectRatio: `${gridCols} / ${gridRows}` }}
      >
        <div
          className="grid h-full w-full gap-0"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
          }}
        >
          {(cells ?? Array.from({ length: gridCols * gridRows })).map((cell, i) => {
            const isText = Boolean(cell?.isText);
            const textOrdinal = cell?.textOrdinal ?? 0;
            const textTint = TEXT_OVERLAY_COLORS[textOrdinal % TEXT_OVERLAY_COLORS.length];
            return (
              <div key={cell?.key ?? `loading-${i}`} className="relative min-h-0 min-w-0 overflow-hidden bg-[#0c1226]">
                {cell ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cell.src}
                      alt=""
                      draggable={false}
                      className={`h-full w-full object-cover transition-[filter] ease-linear ${
                        isText
                          ? "brightness-[1.12] contrast-[1.22] saturate-[1.12]"
                          : "brightness-[0.48] contrast-[0.95] saturate-[0.62]"
                      }`}
                      style={{ transitionDuration: `${crossfadeMs}ms` }}
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 transition-[opacity,background-color] ease-in-out"
                      style={{
                        transitionDuration: `${crossfadeMs}ms`,
                        backgroundColor: isText ? textTint : "#0a1229",
                        mixBlendMode: isText ? "screen" : "multiply",
                        opacity: isText ? 0.5 : 0.58,
                      }}
                    />
                    {isText ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "radial-gradient(120% 120% at 50% 45%, rgba(255,227,170,0.42) 0%, rgba(255,198,112,0.2) 45%, rgba(0,0,0,0) 85%)",
                        }}
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
