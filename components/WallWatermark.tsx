"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Câu hiển thị (thường đã upper); xuống dòng = dòng watermark tiếp theo. */
  phrase: string;
  crossfadeMs: number;
  fontClassName: string;
};

function linesFromPhrase(phrase: string): string[] {
  const raw = phrase.trim();
  if (!raw.length) return [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.length ? lines : [raw];
}

/** Vị trí tương đối trong khung tham chiếu 16:9 (giữa hai dòng chữ). */
const SPARKS: { left: string; top: string; delay: string; scale: number }[] = [
  { left: "46%", top: "44%", delay: "0s", scale: 1 },
  { left: "52%", top: "46%", delay: "0.4s", scale: 0.85 },
  { left: "48%", top: "52%", delay: "0.8s", scale: 1.1 },
  { left: "54%", top: "50%", delay: "1.1s", scale: 0.75 },
  { left: "44%", top: "48%", delay: "0.2s", scale: 0.9 },
  { left: "56%", top: "44%", delay: "1.4s", scale: 1 },
  { left: "50%", top: "42%", delay: "0.6s", scale: 0.8 },
  { left: "42%", top: "52%", delay: "1.7s", scale: 0.95 },
  { left: "58%", top: "52%", delay: "0.3s", scale: 0.7 },
];

export function WallWatermark({ phrase, crossfadeMs, fontClassName }: Props) {
  const [shownLines, setShownLines] = useState(() => linesFromPhrase(phrase));
  const [opacity, setOpacity] = useState(1);
  const lastPhraseRef = useRef<string | null>(null);

  useEffect(() => {
    const next = linesFromPhrase(phrase);
    if (lastPhraseRef.current === null) {
      lastPhraseRef.current = phrase;
      setShownLines(next);
      return;
    }
    if (lastPhraseRef.current === phrase) return;

    const half = Math.max(150, Math.min(2000, Math.floor(crossfadeMs / 2)));
    setOpacity(0);
    const swap = window.setTimeout(() => {
      lastPhraseRef.current = phrase;
      setShownLines(next);
      requestAnimationFrame(() => setOpacity(1));
    }, half);
    return () => window.clearTimeout(swap);
  }, [phrase, crossfadeMs]);

  const lineCount = shownLines.length;
  /** Cỡ nền ~1/16; .wall-watermark-copy-scaled scale(16) → kích thước hiển thị gấp 16. */
  const fontSizeClass =
    lineCount >= 3
      ? "text-[clamp(0.078rem,min(0.238vmin,0.225vh),0.203rem)]"
      : lineCount === 2
        ? "text-[clamp(0.109rem,min(0.325vmin,0.312vh),0.344rem)]"
        : "text-[clamp(0.125rem,min(0.375vmin,0.344vh),0.406rem)]";

  const copyOpacity = opacity * 0.9;

  return (
    <div
      aria-hidden
      className={`wall-watermark pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-visible ${fontClassName}`}
    >
      <div className="wall-watermark-glow" />

      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="wall-watermark-spark"
          style={{
            left: s.left,
            top: s.top,
            animationDelay: s.delay,
            transform: `translate(-50%, -50%) scale(${s.scale})`,
          }}
        />
      ))}

      <div className="wall-watermark-stage">
        <div
          className="wall-watermark-copy wall-watermark-copy-scaled flex flex-col items-center justify-center gap-[0.2em] text-center uppercase leading-[0.92] tracking-[0.02em]"
          style={{
            opacity: copyOpacity,
            transition: `opacity ${Math.max(150, Math.min(1200, crossfadeMs / 2))}ms ease-out`,
          }}
        >
          {shownLines.map((line, i) => (
            <span key={i} className={`wall-watermark-line ${fontSizeClass}`}>
              {line}
            </span>
          ))}
        </div>
      </div>

      <svg
        className="wall-watermark-corner-star"
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <filter id="wall-wm-star-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M14 2 L16.5 11.5 L26 14 L16.5 16.5 L14 26 L11.5 16.5 L2 14 L11.5 11.5 Z"
          fill="rgba(255, 214, 130, 0.82)"
          filter="url(#wall-wm-star-glow)"
        />
      </svg>
    </div>
  );
}
