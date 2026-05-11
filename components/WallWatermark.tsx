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
  /** Cỡ nền (nhỏ); `transform: scale(16)` trong CSS → kích thước vẽ = gấp 16 lần cỡ nền. */
  const fontSizeClass =
    lineCount >= 3
      ? "text-[clamp(0.65rem,min(2vmin,1.9vh),1rem)]"
      : lineCount === 2
        ? "text-[clamp(0.85rem,min(2.6vmin,2.4vh),1.25rem)]"
        : "text-[clamp(1rem,min(3vmin,2.75vh),1.5rem)]";

  return (
    <div
      aria-hidden
      className={`wall-watermark pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-visible ${fontClassName}`}
    >
      <div className="wall-watermark-stage">
        <div
          className="wall-watermark-copy wall-watermark-copy-scaled flex flex-col items-center justify-center gap-[0.2em] text-center uppercase leading-[0.92] tracking-[0.02em]"
          style={{
            opacity,
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
    </div>
  );
}
