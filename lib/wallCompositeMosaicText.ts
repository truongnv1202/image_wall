import { promises as fs } from "fs";
import path from "path";

import sharp from "sharp";

/** Nền tối giống tường / mẫu (#0b1020). */
const BG = { r: 11, g: 16, b: 32 } as const;

/** Noto Sans Bold (OFL) — vẽ mask chữ khi máy chủ không có DejaVu/Liberation (Windows/Docker). */
const MASK_FONT_TTF = path.join(process.cwd(), "lib", "fonts", "NotoSans-Bold.ttf");

/** `null` = chưa đọc; `""` = thiếu file / lỗi đọc. */
let cachedMaskFontFaceCss: string | null | undefined;

async function maskFontFaceCss(): Promise<string | null> {
  if (cachedMaskFontFaceCss !== undefined) {
    return cachedMaskFontFaceCss === "" ? null : cachedMaskFontFaceCss;
  }
  try {
    const buf = await fs.readFile(MASK_FONT_TTF);
    const b64 = buf.toString("base64");
    cachedMaskFontFaceCss =
      `@font-face{font-family:'WallCompositeMask';src:url('data:font/ttf;charset=utf-8;base64,${b64}') format('truetype');font-weight:700;font-style:normal;}`;
    return cachedMaskFontFaceCss;
  } catch {
    cachedMaskFontFaceCss = "";
    return null;
  }
}

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
  return Math.floor(Math.max(32, Math.min(byW, byH, outH * 0.26)));
}

function buildTextMaskSvg(
  outW: number,
  outH: number,
  lines: string[],
  fontSize: number,
  fontFaceCss: string | null,
): string {
  const lineHeight = fontSize * 1.12;
  const totalH = lines.length * lineHeight;
  const startY = (outH - totalH) / 2 + fontSize * 0.78;
  const cx = outW / 2;
  const fontStack =
    "'WallCompositeMask', 'DejaVu Sans', 'Liberation Sans', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
  const texts = lines.map((line, i) => {
    const y = startY + i * lineHeight;
    const sw = Math.max(2, Math.round(fontSize * 0.028));
    return `<text x="${cx}" y="${y}" fill="rgb(255,255,255)" text-anchor="middle" font-size="${fontSize}" font-weight="700" stroke="rgb(252,252,255)" stroke-width="${sw}" stroke-opacity="0.92" paint-order="stroke fill" font-family="${fontStack}">${escapeXml(
      line.toUpperCase(),
    )}</text>`;
  });
  const defs = fontFaceCss
    ? `<defs><style type="text/css"><![CDATA[${fontFaceCss}]]></style></defs>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}">
${defs}
<rect width="100%" height="100%" fill="black"/>
${texts.join("\n")}
</svg>`;
}

/**
 * Ảnh mẫu: lưới ảnh phủ toàn khung; trong chữ hiện rõ (insideOpacity), ngoài chữ chỉ lờ mờ (outsideOpacity) trên nền tối.
 * `insideOpacity` ≈ `graphicOverlayOpacity` (0–1). `outsideOpacity` ≈ ghost nền (0–0.5).
 * `textBrighten`: sau khi trộn, đẩy RGB về phía trắng trong vùng mask (0 = tắt).
 */
export async function composeMosaicWithTextMask(
  mosaicJpeg: Buffer,
  outW: number,
  outH: number,
  phraseFirst: string,
  insideOpacity: number,
  outsideOpacity: number,
  textBrighten: number,
): Promise<Buffer> {
  const lines = phraseFirst
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (lines.length === 0) {
    throw new Error("Không có dòng chữ cho mask");
  }

  const fontSize = estimateFontSize(outW, outH, lines);
  const embedded = await maskFontFaceCss();
  const svg = buildTextMaskSvg(outW, outH, lines, fontSize, embedded);

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

  const n = outW * outH;
  let maxMask = 0;
  for (let i = 0; i < n; i++) {
    const v = maskData[i] ?? 0;
    if (v > maxMask) maxMask = v;
  }
  if (maxMask < 20) {
    throw new Error(
      "Mask chữ gần như toàn đen (chữ SVG không vẽ được — thường do thiếu font trên máy chủ; cần file lib/fonts/NotoSans-Bold.ttf).",
    );
  }

  const bIn = Math.min(1, Math.max(0.02, insideOpacity));
  const bOut = Math.min(0.5, Math.max(0, outsideOpacity));
  const liftAmt = Math.min(0.55, Math.max(0, textBrighten));
  const out = Buffer.alloc(n * 3);
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const m = (maskData[i] ?? 0) / 255;
    const bf = bOut + m * (bIn - bOut);
    let r = Math.round(BG.r * (1 - bf) + (mosaicData[p] ?? 0) * bf);
    let g = Math.round(BG.g * (1 - bf) + (mosaicData[p + 1] ?? 0) * bf);
    let b = Math.round(BG.b * (1 - bf) + (mosaicData[p + 2] ?? 0) * bf);
    if (liftAmt > 0 && m > 0) {
      const lift = liftAmt * m;
      r = Math.min(255, Math.round(r + (255 - r) * lift));
      g = Math.min(255, Math.round(g + (255 - g) * lift));
      b = Math.min(255, Math.round(b + (255 - b) * lift));
    }
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
  }

  return sharp(out, {
    raw: { width: outW, height: outH, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
}
