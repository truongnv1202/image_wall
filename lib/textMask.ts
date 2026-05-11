export type BuildTextMaskOptions = {
  text: string;
  cols: number;
  rows: number;
  /** Resolved canvas font family, e.g. from next/font — phải khớp weight với font đã nạp (700). */
  fontFamily: string;
};

function drawMultilineText(
  ctx: CanvasRenderingContext2D,
  lineBlocks: string[],
  cx: number,
  startY: number,
  lineGap: number,
  fontSize: number,
  fontFamily: string,
  fillStyle: string,
) {
  ctx.save();
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fillStyle;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.globalAlpha = 1;
  for (let i = 0; i < lineBlocks.length; i++) {
    ctx.fillText(lineBlocks[i], cx, startY + i * lineGap);
  }
  ctx.restore();
}

/**
 * Sinh mask boolean kiểu ảnh mẫu: mỗi ô lưới hoặc là chữ hoặc là nền (không “nửa nạc”).
 * Pipeline: raster đen trên trắng → **nhị phân hóa** từng pixel (bỏ xám AA) → đếm trong ô → đa số đơn giản (>50%).
 */
export async function buildTextMask({
  text,
  cols,
  rows,
  fontFamily,
}: BuildTextMaskOptions): Promise<boolean[][]> {
  await document.fonts.ready;

  const scale = 22;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D context unavailable");
  }

  const w = cols * scale;
  const h = rows * scale;
  canvas.width = w;
  canvas.height = h;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const lineBlocks = lines.length ? lines : [" "];

  let fontSize = Math.floor(h * 0.3);
  while (fontSize >= 8) {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const maxLineWidth = Math.max(
      ...lineBlocks.map((line) => ctx.measureText(line).width),
      1,
    );
    const blockHeight = fontSize * (lineBlocks.length * 1.1 - 0.1);
    const fitsWidth = maxLineWidth <= w * 0.92;
    const fitsHeight = blockHeight <= h * 0.88;
    if (fitsWidth && fitsHeight) break;
    fontSize -= 2;
  }

  const lineGap = fontSize * 1.1;
  const totalH = lineGap * (lineBlocks.length - 1) + fontSize;
  const startY = (h - totalH) / 2 + fontSize / 2;
  const cx = w / 2;

  drawMultilineText(ctx, lineBlocks, cx, startY, lineGap, fontSize, fontFamily, "#000000");

  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  /**
   * Ngưỡng nhị phân: mọi pixel < T → “mực”, ≥ T → nền trắng.
   * ~188 tách rõ vùng AA (~120–210) của canvas so với nền 255, giữ thân chữ đậm như mẫu in hoa đậm.
   */
  const binaryInkThreshold = 188;

  /** Gần full ô; bỏ 1px viền để tránh nhiễu sát ranh giới ô lưới. */
  const margin = 1;
  const mask: boolean[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      let ink = 0;
      let count = 0;
      for (let dy = margin; dy < scale - margin; dy++) {
        for (let dx = margin; dx < scale - margin; dx++) {
          const x = c * scale + dx;
          const y = r * scale + dy;
          const i = (y * w + x) * 4;
          const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          count++;
          if (lum < binaryInkThreshold) ink++;
        }
      }
      if (count === 0) {
        row.push(false);
        continue;
      }
      row.push(ink * 2 > count);
    }
    mask.push(row);
  }

  return mask;
}
