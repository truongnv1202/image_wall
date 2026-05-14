/**
 * Khi không có `chu.png` trên đĩa — raster SVG chữ từ câu đầu trong wall-text
 * để STEP 2 (mask + CHUMOI) vẫn chạy và có lớp chữ đè lên.
 */

import sharp from "sharp";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * PNG RGBA, nền sáng + chữ tối (phù hợp mask độ lệch màu viền).
 */
export async function rasterSvgChuPlaceholder(
  phrase: string,
  outW: number,
  outH: number,
): Promise<Buffer> {
  const line = phrase.split(/\r?\n/)[0] ?? phrase;
  const safe = escapeXml(line.trim().slice(0, 48) || "HÒA BÌNH");
  const fontPx = Math.min(
    140,
    Math.max(28, Math.floor((outW * 0.85) / Math.max(6, safe.length * 0.55))),
  );
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#f4f4f7" width="100%" height="100%"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui,Segoe UI,sans-serif" font-weight="700" font-size="${fontPx}px" fill="#141820">${safe}</text>
</svg>`;
  return sharp(Buffer.from(svg, "utf8")).ensureAlpha().png().toBuffer();
}
