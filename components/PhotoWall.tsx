"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { notoSans } from "@/app/fonts";
import { pickBgUrl, pickTextUrl } from "@/lib/placement";
import { buildTextMask } from "@/lib/textMask";
import type { ImagePools } from "@/lib/types";

/** Portrait-friendly grid (~3×4 wall); tweak cols/rows together if needed. */
export const GRID_COLS = 52;
export const GRID_ROWS = 70;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<ImagePools>;
  });

function buildCells(
  mask: boolean[][],
  pools: ImagePools
): { key: string; isText: boolean; src: string }[] {
  const flat: { key: string; isText: boolean; src: string }[] = [];
  let textOrd = 0;
  let bgOrd = 0;
  for (let r = 0; r < mask.length; r++) {
    for (let c = 0; c < mask[r].length; c++) {
      const isText = mask[r][c];
      const src = isText ? pickTextUrl(textOrd++, pools) : pickBgUrl(bgOrd++, pools);
      flat.push({
        key: `${r}-${c}`,
        isText,
        src,
      });
    }
  }
  return flat;
}

type PhotoWallProps = {
  text: string;
};

export function PhotoWall({ text }: PhotoWallProps) {
  const [mask, setMask] = useState<boolean[][] | null>(null);
  const { data: pools } = useSWR<ImagePools>("/api/images", fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true,
  });

  const normalized = text.trim() || " ";

  useEffect(() => {
    let cancelled = false;
    buildTextMask({
      text: normalized,
      cols: GRID_COLS,
      rows: GRID_ROWS,
      fontFamily: notoSans.style.fontFamily,
    }).then((m) => {
      if (!cancelled) setMask(m);
    });
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  const cells = useMemo(() => {
    if (!mask || !pools) return null;
    return buildCells(mask, pools);
  }, [mask, pools]);

  if (!cells) {
    return (
      <div
        className="flex h-[min(85vh,720px)] w-full max-w-3xl items-center justify-center rounded-2xl bg-zinc-900/40 text-zinc-300"
        role="status"
      >
        Đang tính ma trận chữ…
      </div>
    );
  }

  return (
    <div
      className="grid w-full max-w-3xl gap-0.5 bg-zinc-950 p-2 shadow-2xl shadow-black/50"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
      }}
    >
      {cells.map((cell) => (
        <motion.div
          key={cell.key}
          layout
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="relative aspect-square overflow-hidden rounded-sm"
        >
          <Image
            src={cell.src}
            alt=""
            fill
            className="object-cover brightness-[0.92] contrast-[1.02] saturate-[0.95]"
            sizes="(max-width: 768px) 2vw, 12px"
            unoptimized={
              cell.src.startsWith("https://picsum.photos") ||
              cell.src.startsWith("/uploads/")
            }
          />
          {/* Phủ màu: chữ = ấm/sáng, nền = lạnh/tối — phần “đọc” chữ đến từ overlay */}
          <div
            aria-hidden
            className={[
              "pointer-events-none absolute inset-0 transition-all duration-500 ease-out",
              cell.isText
                ? "bg-gradient-to-br from-amber-300/75 via-orange-400/60 to-amber-500/55 mix-blend-hard-light shadow-[inset_0_0_12px_rgba(255,220,150,0.35)]"
                : "bg-gradient-to-br from-slate-950/88 via-blue-950/78 to-slate-900/85 mix-blend-multiply",
            ].join(" ")}
          />
          <div
            aria-hidden
            className={[
              "pointer-events-none absolute inset-0 transition-opacity duration-500",
              cell.isText
                ? "opacity-100 ring-1 ring-inset ring-amber-200/25"
                : "opacity-0",
            ].join(" ")}
          />
        </motion.div>
      ))}
    </div>
  );
}
