"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  version: number;
  fadeMs: number;
};

/**
 * Ảnh tường ghép full màn: crossfade khi `version` tăng (ảnh cũ mờ dần → ảnh mới).
 */
export function WallCompositeBackground({ url, version, fadeMs }: Props) {
  const [bottom, setBottom] = useState(() => `${url}?v=${Math.max(1, version)}`);
  const [top, setTop] = useState<string | null>(null);
  const [topOpacity, setTopOpacity] = useState(0);
  /** Phiên bản đã “commit” xuống lớp dưới (chỉ cập nhật sau khi fade xong, tránh kẹt nếu effect bị cleanup giữa chừng). */
  const lastCommittedVersion = useRef(0);

  useEffect(() => {
    if (version < 1) return;
    if (version === lastCommittedVersion.current) return;
    const next = `${url}?v=${version}`;
    setTop(next);
    setTopOpacity(0);
    const raf = requestAnimationFrame(() => setTopOpacity(1));
    const t = window.setTimeout(() => {
      setBottom(next);
      setTop(null);
      setTopOpacity(0);
      lastCommittedVersion.current = version;
    }, fadeMs + 80);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [version, url, fadeMs]);

  return (
    <div className="absolute inset-0 z-0 min-h-0 min-w-0 bg-[#0b1020]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bottom}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        decoding="async"
      />
      {top ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={top}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          decoding="async"
          style={{
            opacity: topOpacity,
            transition: `opacity ${fadeMs}ms ease-in-out`,
          }}
        />
      ) : null}
    </div>
  );
}
