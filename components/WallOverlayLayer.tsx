"use client";

import { useEffect, useState } from "react";

import type { WallGraphicBlendMode } from "@/lib/wallGraphicUrls";

type Props = {
  src: string;
  width?: number;
  height?: number;
  blendMode: WallGraphicBlendMode;
  /** 0–1 */
  opacity: number;
};

/** Ngưỡng alpha (0–1): từ đây trở lên coi là foreground (blend/opacity); dưới = nền + shadow giữ normal. */
const FOREGROUND_ALPHA_THRESHOLD = 0.72;

type SplitMasks = { shadow: string; foreground: string };

async function buildSplitMasks(imageUrl: string): Promise<SplitMasks | null> {
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";

  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("load failed"));
  });
  img.src = imageUrl;
  await loaded;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w < 1 || h < 1) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);

  const shadow = ctx.createImageData(w, h);
  const foreground = ctx.createImageData(w, h);
  const t = Math.round(FOREGROUND_ALPHA_THRESHOLD * 255);

  for (let i = 0; i < data.data.length; i += 4) {
    const a = data.data[i + 3]!;
    const isFg = a >= t;
    const shadowOn = !isFg && a > 0;
    const fgOn = isFg;

    shadow.data[i] = 255;
    shadow.data[i + 1] = 255;
    shadow.data[i + 2] = 255;
    shadow.data[i + 3] = shadowOn ? 255 : 0;

    foreground.data[i] = 255;
    foreground.data[i + 1] = 255;
    foreground.data[i + 2] = 255;
    foreground.data[i + 3] = fgOn ? 255 : 0;
  }

  const toUrl = (imgData: ImageData) => {
    ctx.clearRect(0, 0, w, h);
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  };

  return { shadow: toUrl(shadow), foreground: toUrl(foreground) };
}

function needsShadowSplit(blendMode: WallGraphicBlendMode, opacity: number): boolean {
  return blendMode !== "normal" || opacity < 0.999;
}

/**
 * Lớp phủ PNG: vùng nền/shadow (alpha thấp) luôn `normal` + opacity 1;
 * phần foreground mới dùng blend/opacity từ cấu hình.
 */
export function WallOverlayLayer({ src, width, height, blendMode, opacity }: Props) {
  const [masks, setMasks] = useState<SplitMasks | null>(null);
  const split = needsShadowSplit(blendMode, opacity);

  useEffect(() => {
    if (!split) {
      setMasks(null);
      return;
    }
    let cancelled = false;
    setMasks(null);
    void buildSplitMasks(src)
      .then((m) => {
        if (!cancelled) setMasks(m);
      })
      .catch(() => {
        if (!cancelled) setMasks(null);
      });
    return () => {
      cancelled = true;
    };
  }, [src, split]);

  const imgDims =
    width != null && height != null && width > 0 && height > 0
      ? { width, height }
      : {};

  if (!split || !masks) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        {...imgDims}
        className="h-full w-full object-contain object-center"
        style={{
          mixBlendMode: blendMode,
          opacity,
        }}
        decoding="async"
        draggable={false}
      />
    );
  }

  const maskSize = "contain";
  const maskPosition = "center";
  const maskRepeat = "no-repeat";

  return (
    <>
      {/* Nền + shadow: không blend, không giảm opacity */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        {...imgDims}
        className="absolute inset-0 h-full w-full object-contain object-center"
        style={{
          mixBlendMode: "normal",
          opacity: 1,
          maskImage: `url(${masks.shadow})`,
          WebkitMaskImage: `url(${masks.shadow})`,
          maskMode: "alpha",
          maskSize,
          WebkitMaskSize: maskSize,
          maskPosition,
          WebkitMaskPosition: maskPosition,
          maskRepeat,
          WebkitMaskRepeat: maskRepeat,
        }}
        decoding="async"
        draggable={false}
      />
      {/* Foreground: blend + opacity từ wall-text */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        {...imgDims}
        className="absolute inset-0 h-full w-full object-contain object-center"
        style={{
          mixBlendMode: blendMode,
          opacity,
          maskImage: `url(${masks.foreground})`,
          WebkitMaskImage: `url(${masks.foreground})`,
          maskMode: "alpha",
          maskSize,
          WebkitMaskSize: maskSize,
          maskPosition,
          WebkitMaskPosition: maskPosition,
          maskRepeat,
          WebkitMaskRepeat: maskRepeat,
        }}
        decoding="async"
        draggable={false}
      />
    </>
  );
}
