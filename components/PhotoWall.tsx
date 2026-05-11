"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { notoSans } from "@/app/fonts";
import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import { buildTextMask } from "@/lib/textMask";
import type { ImagesPayload } from "@/lib/types";
import {
  GRID_COLS,
  GRID_ROWS,
  TEXT_OVERLAY_COLORS,
  WALL_MASK_TEXT,
} from "@/lib/wallConstants";

const POLL_MS = 4000;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<ImagesPayload>;
  });

export type WallCell = {
  key: string;
  flatIndex: number;
  isText: boolean;
  textOrdinal: number;
  src: string;
  overlayHex: string | null;
};

function buildCells(mask: boolean[][], images: string[]): WallCell[] {
  const safe = images.length > 0 ? images : DEFAULT_IMAGE_URLS;
  const flat: WallCell[] = [];
  let textOrdinal = 0;
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      const flatIndex = r * GRID_COLS + c;
      const isText = mask[r][c];
      const src = safe[flatIndex % safe.length];
      let overlayHex: string | null = null;
      let textIdx = -1;
      if (isText) {
        textIdx = textOrdinal;
        overlayHex = TEXT_OVERLAY_COLORS[textOrdinal % TEXT_OVERLAY_COLORS.length];
        textOrdinal += 1;
      }
      flat.push({
        key: `${r}-${c}`,
        flatIndex,
        isText,
        textOrdinal: textIdx,
        src,
        overlayHex,
      });
    }
  }
  return flat;
}

export function PhotoWall() {
  const [mask, setMask] = useState<boolean[][] | null>(null);
  const { data } = useSWR<ImagesPayload>("/api/images", fetcher, {
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
  });

  useEffect(() => {
    let cancelled = false;
    buildTextMask({
      text: WALL_MASK_TEXT,
      cols: GRID_COLS,
      rows: GRID_ROWS,
      fontFamily: notoSans.style.fontFamily,
    }).then((m) => {
      if (!cancelled) setMask(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cells = useMemo(() => {
    if (!mask || !data?.images) return null;
    return buildCells(mask, data.images);
  }, [mask, data]);

  if (!cells) {
    return (
      <div
        className="flex aspect-[100/60] w-full max-w-[min(100vw,calc((100vh-10rem)*100/60))] items-center justify-center bg-zinc-900 text-zinc-400"
        role="status"
      >
        Đang tính ma trận chữ…
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-1 px-2">
      <div
        className="relative w-full max-w-[min(100vw,calc((100vh-10rem)*100/60))] overflow-hidden rounded-sm border border-zinc-800 bg-black shadow-2xl shadow-black/60"
        style={{ aspectRatio: `${GRID_COLS} / ${GRID_ROWS}` }}
      >
        <div
          className="grid h-full w-full gap-0"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.key}
              className="relative min-h-0 min-w-0 overflow-hidden opacity-0 animate-[fadeIn_0.45s_ease-out_forwards]"
              style={{
                animationDelay: `${Math.min(cell.flatIndex * 0.0008, 0.35)}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cell.src}
                alt=""
                className={`h-full w-full object-cover ${cell.isText ? "" : "brightness-[0.52] saturate-[0.85]"}`}
                loading="lazy"
                decoding="async"
              />
              {cell.overlayHex ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                  style={{
                    backgroundColor: cell.overlayHex,
                    opacity: 0.38,
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-black/25"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
