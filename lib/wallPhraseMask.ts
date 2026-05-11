/** SVG mask: nền trắng (lớp phủ hiện) + chữ đen (lỗ xuyên thấy ảnh). */

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Giá trị CSS `mask-image` / `-webkit-mask-image` (data URL SVG), `preserveAspectRatio` giữ chữ cân tường.
 */
export function wallPhraseMaskDataUrl(text: string, fontFamily: string): string {
  const font = fontFamily.replace(/["<>]/g, "").trim() || "sans-serif";
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const blocks = (lines.length ? lines : [" "]).map(escapeXml);
  const n = blocks.length;
  const fontSize = n <= 1 ? 19 : n === 2 ? 14 : Math.max(9, Math.floor(56 / (n + 1)));
  const lineStep = fontSize * 1.12;
  const y0 = 50 - ((n - 1) * lineStep) / 2;
  let tspans = "";
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tspans += `<tspan x="50" y="${y0.toFixed(2)}">${blocks[i]}</tspan>`;
    } else {
      tspans += `<tspan x="50" dy="${lineStep.toFixed(2)}">${blocks[i]}</tspan>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"><rect width="100" height="100" fill="white"/><text text-anchor="middle" fill="black" font-family="${escapeXml(font)}" font-weight="700" font-size="${fontSize}">${tspans}</text></svg>`;

  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
