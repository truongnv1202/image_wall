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
  opts: {
    fillStyle: string;
    shadowBlur: number;
    shadowColor: string;
    globalAlpha?: number;
  },
) {
  ctx.save();
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = opts.fillStyle;
  ctx.shadowBlur = opts.shadowBlur;
  ctx.shadowColor = opts.shadowColor;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  if (opts.globalAlpha != null) ctx.globalAlpha = opts.globalAlpha;
  for (let i = 0; i < lineBlocks.length; i++) {
    ctx.fillText(lineBlocks[i], cx, startY + i * lineGap);
  }
  ctx.restore();
}

/**
 * Sinh mask: nền trắng → lớp chữ **mờ** (màu xám + shadow blur) → lớp chữ **đen sắc nét** đè lên
 * (“đục” nét trên lớp mờ). Lấy mẫu theo ô; đa số pixel tối trong ô = ô thuộc chữ.
 */
export async function buildTextMask({
  text,
  cols,
  rows,
  fontFamily,
}: BuildTextMaskOptions): Promise<boolean[][]> {
  await document.fonts.ready;

  const scale = 8;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D context unavailable");
  }

  canvas.width = cols * scale;
  canvas.height = rows * scale;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const lineBlocks = lines.length ? lines : [" "];

  let fontSize = Math.floor(canvas.height * 0.3);
  while (fontSize >= 8) {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    const maxLineWidth = Math.max(
      ...lineBlocks.map((line) => ctx.measureText(line).width),
      1,
    );
    const blockHeight = fontSize * (lineBlocks.length * 1.1 - 0.1);
    const fitsWidth = maxLineWidth <= canvas.width * 0.92;
    const fitsHeight = blockHeight <= canvas.height * 0.88;
    if (fitsWidth && fitsHeight) break;
    fontSize -= 2;
  }

  const lineGap = fontSize * 1.1;
  const totalH = lineGap * (lineBlocks.length - 1) + fontSize;
  const startY = (canvas.height - totalH) / 2 + fontSize / 2;
  const cx = canvas.width / 2;

  const blurWide = scale * 3.4;
  const blurMid = scale * 2;

  // 1) Lớp mờ rộng — tạo “thân” chữ loang nhẹ
  drawMultilineText(ctx, lineBlocks, cx, startY, lineGap, fontSize, fontFamily, {
    fillStyle: "rgba(155, 165, 180, 0.42)",
    shadowBlur: blurWide,
    shadowColor: "rgba(110, 125, 145, 0.5)",
    globalAlpha: 1,
  });

  // 2) Lớp mờ hẹp hơn — đậm dần vào lõi chữ
  drawMultilineText(ctx, lineBlocks, cx, startY, lineGap, fontSize, fontFamily, {
    fillStyle: "rgba(120, 130, 148, 0.38)",
    shadowBlur: blurMid,
    shadowColor: "rgba(90, 102, 120, 0.45)",
  });

  // 3) Chữ đen sắc nét — đục nét lên trên lớp mờ (không shadow)
  drawMultilineText(ctx, lineBlocks, cx, startY, lineGap, fontSize, fontFamily, {
    fillStyle: "#000000",
    shadowBlur: 0,
    shadowColor: "transparent",
  });

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;

  const mask: boolean[][] = [];
  /** Sau lớp mờ + đen: lõi chữ rất tốt; viền loang hơi sáng hơn — ngưỡng cân bằng. */
  const threshold = 196;

  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      let dark = 0;
      let count = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = c * scale + dx;
          const y = r * scale + dy;
          const i = (y * canvas.width + x) * 4;
          const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          count++;
          if (lum < threshold) dark++;
        }
      }
      row.push(dark * 2 > count);
    }
    mask.push(row);
  }

  return mask;
}
