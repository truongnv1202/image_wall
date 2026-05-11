"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import type { ImagesPayload } from "@/lib/types";
import { WALL_MASK_TEXT } from "@/lib/wallConstants";
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

function buildSlotUrls(pool: string[], slotCount: number): string[] {
  const len = pool.length;
  if (len === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    out.push(pool[i % len]);
  }
  return out;
}

export function PhotoWall() {
  const [phraseIndex, setPhraseIndex] = useState(0);
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
  const displayCount = wallText?.displayImageCount ?? 1000;

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

  const pool = data?.images?.length ? data.images : DEFAULT_IMAGE_URLS;
  const slotUrls = useMemo(() => buildSlotUrls(pool, displayCount), [pool, displayCount]);

  return (
    <div className="flex w-full flex-col items-center gap-3 px-2 py-2">
      <div className="relative min-h-[4.5rem] w-full max-w-4xl px-2" aria-live="polite">
        {phrases.map((text, i) => (
          <p
            key={i}
            className="pointer-events-none absolute inset-x-2 top-0 whitespace-pre-line text-center text-sm leading-snug text-zinc-400 transition-opacity ease-in-out motion-reduce:transition-none"
            style={{
              opacity: i === phraseIndex ? 1 : 0,
              transitionDuration: `${crossfadeMs}ms`,
            }}
          >
            {text}
          </p>
        ))}
      </div>

      <div className="w-full max-w-[min(100vw,1920px)] rounded-sm border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl shadow-black/50 sm:p-2">
        <div
          className="grid gap-1 sm:gap-1.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          }}
        >
          {slotUrls.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="aspect-square overflow-hidden rounded-sm bg-black ring-1 ring-zinc-800/80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
