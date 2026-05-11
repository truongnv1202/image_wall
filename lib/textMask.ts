export type BuildTextMaskOptions = {
  text: string;
  cols: number;
  rows: number;
  /** Resolved canvas font family, e.g. from next/font */
  fontFamily: string;
};

/**
 * Renders text on an offscreen canvas and samples a cols×rows boolean grid.
 * `true` means the cell is covered by glyph ink (text cell).
 */
export async function buildTextMask({
  text,
  cols,
  rows,
  fontFamily,
}: BuildTextMaskOptions): Promise<boolean[][]> {
  await document.fonts.ready;

  const scale = 4;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D context unavailable");
  }

  canvas.width = cols * scale;
  canvas.height = rows * scale;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const lineBlocks = lines.length ? lines : [" "];

  let fontSize = Math.floor(canvas.height * 0.28);
  while (fontSize >= 8) {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const maxLineWidth = Math.max(
      ...lineBlocks.map((line) => ctx.measureText(line).width),
      1
    );
    const blockHeight = fontSize * (lineBlocks.length * 1.15 - 0.15);
    const fitsWidth = maxLineWidth <= canvas.width * 0.92;
    const fitsHeight = blockHeight <= canvas.height * 0.88;
    if (fitsWidth && fitsHeight) break;
    fontSize -= 2;
  }

  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  const lineGap = fontSize * 1.15;
  const totalH = lineGap * (lineBlocks.length - 1) + fontSize;
  let startY = (canvas.height - totalH) / 2 + fontSize / 2;
  for (let i = 0; i < lineBlocks.length; i++) {
    ctx.fillText(lineBlocks[i], canvas.width / 2, startY + i * lineGap);
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;

  const mask: boolean[][] = [];
  const threshold = 200;

  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = c * scale + dx;
          const y = r * scale + dy;
          const i = (y * canvas.width + x) * 4;
          sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          count++;
        }
      }
      row.push(sum / count < threshold);
    }
    mask.push(row);
  }

  return mask;
}
