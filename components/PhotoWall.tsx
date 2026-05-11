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

function countTextCells(mask: boolean[][]): number {
  let n = 0;
  for (const row of mask) {
    for (const cell of row) {
      if (cell) n++;
    }
  }
  return n;
}

/** Ô chữ: luân phiên từ đầu mảng (ảnh mới prepend nổi bật). Ô nền: phase lệch để ưu tiên ảnh “xa đầu mảng” hơn. */
function buildCells(mask: boolean[][], images: string[]): WallCell[] {
  const safe = images.length > 0 ? images : DEFAULT_IMAGE_URLS;
  const len = safe.length;
  const textCellCount = countTextCells(mask);
  const bgPhase = len > 1 ? Math.min(len - 1, Math.max(4, Math.floor(len * 0.12))) : 0;

  const flat: WallCell[] = [];
  let textOrdinal = 0;
  let bgOrdinal = 0;
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      const flatIndex = r * GRID_COLS + c;
      const isText = mask[r][c];
      let src: string;
      let overlayHex: string | null = null;
      let textIdx = -1;
      if (isText) {
        textIdx = textOrdinal;
        overlayHex = TEXT_OVERLAY_COLORS[textOrdinal % TEXT_OVERLAY_COLORS.length];
        src = safe[textOrdinal % len];
        textOrdinal += 1;
      } else {
        src = safe[(bgPhase + bgOrdinal + textCellCount) % len];
        bgOrdinal += 1;
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
          className="isolate grid h-full w-full gap-0"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.key}
              className={`relative min-h-0 min-w-0 overflow-hidden opacity-0 animate-[fadeIn_0.45s_ease-out_forwards] ${
                cell.isText
                  ? "z-[2] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]"
                  : "z-0"
              }`}
              style={{
                animationDelay: `${Math.min(cell.flatIndex * 0.0008, 0.35)}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cell.src}
                alt=""
                draggable={false}
                className={`h-full w-full object-cover ${
                  cell.isText
                    ? "brightness-[1.14] contrast-[1.22] saturate-[1.12]"
                    : "brightness-[0.62] saturate-[0.92]"
                }`}
                loading="lazy"
                decoding="async"
              />
              {cell.overlayHex ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mix-blend-overlay"
                  style={{
                    backgroundColor: cell.overlayHex,
                    opacity: 0.26,
                  }}
                />
              ) : (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-black/18"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
