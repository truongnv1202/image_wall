import sharp from "sharp";

/** Nền tối giống tường / mẫu (#0b1020). */
const BG = { r: 11, g: 16, b: 32 } as const;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function estimateFontSize(outW: number, outH: number, lines: string[]): number {
  const n = Math.max(1, lines.length);
  const maxLen = Math.max(1, ...lines.map((l) => l.length));
  const byW = (outW * 0.88) / (maxLen * 0.58);
  const byH = (outH * 0.72) / (n * 1.12);
  return Math.floor(Math.max(28, Math.min(byW, byH, outH * 0.24)));
}

function buildTextMaskSvg(outW: number, outH: number, lines: string[], fontSize: number): string {
  const lineHeight = fontSize * 1.12;
  const totalH = lines.length * lineHeight;
  const startY = (outH - totalH) / 2 + fontSize * 0.78;
  const cx = outW / 2;
  const texts = lines.map((line, i) => {
    const y = startY + i * lineHeight;
    return `<text x="${cx}" y="${y}" fill="white" text-anchor="middle" font-size="${fontSize}" font-weight="700" font-family="DejaVu Sans, Liberation Sans, system-ui, -apple-system, Segoe UI, Arial, sans-serif">${escapeXml(
      line.toUpperCase(),
    )}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}">
<rect width="100%" height="100%" fill="black"/>
${texts.join("\n")}
</svg>`;
}

/**
 * Ảnh mẫu: lưới ảnh phủ toàn khung; trong chữ hiện rõ (insideOpacity), ngoài chữ chỉ lờ mờ (outsideOpacity) trên nền tối.
 * `insideOpacity` ≈ `graphicOverlayOpacity` (0–1). `outsideOpacity` ≈ “ghost” nền (0–0.5).
 */
export async function composeMosaicWithTextMask(
  mosaicJpeg: Buffer,
  outW: number,
  outH: number,
  phraseFirst: string,
  insideOpacity: number,
  outsideOpacity: number,
): Promise<Buffer> {
  const lines = phraseFirst
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) {
    throw new Error("Không có dòng chữ cho mask");
  }

  const fontSize = estimateFontSize(outW, outH, lines);
  const svg = buildTextMaskSvg(outW, outH, lines, fontSize);

  const { data: mosaicData, info: mosaicInfo } = await sharp(mosaicJpeg)
    .resize(outW, outH, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (mosaicInfo.channels !== 3 || mosaicInfo.width !== outW || mosaicInfo.height !== outH) {
    throw new Error("mosaic RGB size mismatch");
  }

  const { data: maskData, info: maskInfo } = await sharp(Buffer.from(svg, "utf8"), { density: 150 })
    .resize(outW, outH)
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (maskInfo.channels !== 1 || maskInfo.width !== outW || maskInfo.height !== outH) {
    throw new Error("mask grayscale size mismatch");
  }

  const bIn = Math.min(1, Math.max(0.02, insideOpacity));
  const bOut = Math.min(0.5, Math.max(0, outsideOpacity));

  const n = outW * outH;
  const out = Buffer.alloc(n * 3);
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const m = (maskData[i] ?? 0) / 255;
    const bf = bOut + m * (bIn - bOut);
    out[p] = Math.round(BG.r * (1 - bf) + (mosaicData[p] ?? 0) * bf);
    out[p + 1] = Math.round(BG.g * (1 - bf) + (mosaicData[p + 1] ?? 0) * bf);
    out[p + 2] = Math.round(BG.b * (1 - bf) + (mosaicData[p + 2] ?? 0) * bf);
  }

  return sharp(out, {
    raw: { width: outW, height: outH, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
}
