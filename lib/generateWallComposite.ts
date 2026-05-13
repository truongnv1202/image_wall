import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import sharp, { type Blend } from "sharp";

import { readImages } from "@/lib/imageStore";
import { WALL_MASK_TEXT } from "@/lib/wallConstants";
import { cssBlendToSharp } from "@/lib/wallCompositeBlendMap";
import { composeMosaicWithTextMask } from "@/lib/wallCompositeMosaicText";
import { readWallCompositeMeta, writeWallCompositeMeta } from "@/lib/wallCompositeMeta";
import { readWallText } from "@/lib/wallTextStore";
import { STRIP_GAP_PX } from "@/lib/wallStripConstants";

const OUT_REL = path.join("public", "generated", "wall-composite.jpg");
const OVERLAY_A = path.join(process.cwd(), "public", "wall-overlays", "wall-composite-A.png");

const FETCH_TIMEOUT_MS = 20_000;

let genLock: Promise<void> = Promise.resolve();

async function fetchBuffer(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

/** Ảnh local `/uploads/...` hoặc URL tuyệt đối. */
async function loadImageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("/")) {
    const rel = url.replace(/^\/+/, "");
    const abs = path.join(process.cwd(), "public", rel);
    return fs.readFile(abs);
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return fetchBuffer(url);
  }
  throw new Error(`URL không hỗ trợ: ${url.slice(0, 80)}`);
}

async function applyAlphaScale(png: Buffer, opacity: number): Promise<Buffer> {
  const o = Math.min(1, Math.max(0, opacity));
  if (o >= 0.999) return png;
  const img = sharp(png).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return png;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * o);
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export async function regenerateWallComposite(): Promise<void> {
  const prev = genLock;
  let done!: () => void;
  genLock = new Promise<void>((r) => {
    done = r;
  });
  await prev.catch(() => {});

  try {
    const wall = await readWallText();
    const { images } = await readImages();
    const pool = images.length > 0 ? images : [];
    if (pool.length === 0) {
      const meta = await readWallCompositeMeta();
      await writeWallCompositeMeta({
        ...meta,
        lastError: "Không có ảnh trong images.json",
      });
      return;
    }

    const cols = wall.gridCols;
    const rows = wall.gridRows;
    const outW = wall.compositeOutWidth;
    const outH = wall.compositeOutHeight;
    const gap = STRIP_GAP_PX;
    /* Kích thước ô lưới từ `data/wall-text.json` (cùng cấu hình trang upload / PhotoWall). */
    const cellW = wall.gridTileWidthPx;
    const cellH = wall.gridTileHeightPx;

    const gridW = cols * cellW + Math.max(0, cols - 1) * gap;
    const gridH = rows * cellH + Math.max(0, rows - 1) * gap;

    const composites: { input: Buffer; left: number; top: number }[] = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const url = pool[idx % pool.length]!;
        idx++;
        let raw: Buffer;
        try {
          raw = await loadImageBytes(url);
        } catch (e) {
          console.warn("[wallComposite] bỏ qua ô, không đọc được:", url, e);
          continue;
        }
        const tile = await sharp(raw)
          .rotate()
          .resize(cellW, cellH, { fit: "cover", position: "centre" })
          .jpeg({ quality: 82 })
          .toBuffer();
        composites.push({
          input: tile,
          left: c * (cellW + gap),
          top: r * (cellH + gap),
        });
      }
    }

    if (composites.length === 0) {
      const meta = await readWallCompositeMeta();
      await writeWallCompositeMeta({
        ...meta,
        lastError: "Không ghép được ô nào (ảnh lỗi)",
      });
      return;
    }

    let base = sharp({
      create: {
        width: gridW,
        height: gridH,
        channels: 3,
        background: { r: 11, g: 16, b: 32 },
      },
    });
    let merged = await base.composite(composites).jpeg({ quality: 88 }).toBuffer();

    merged = await sharp(merged)
      .resize(outW, outH, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90 })
      .toBuffer();

    const meta = await readWallCompositeMeta();

    /* Mosaic + mask chữ (câu đầu trong `phrases`): trong chữ lưới rõ, ngoài chữ lưới mờ trên nền tối. */
    const phraseForMask = wall.phrases[0] ?? WALL_MASK_TEXT;
    let mergedFinal: Buffer;
    try {
      mergedFinal = await composeMosaicWithTextMask(
        merged,
        outW,
        outH,
        phraseForMask,
        wall.graphicOverlayOpacity,
        wall.compositeBgMosaicOpacity,
      );
    } catch (e) {
      console.warn("[wallComposite] mosaic + mask chữ lỗi, dùng overlay PNG (fallback):", e);
      mergedFinal = merged;
      const overlayOpacity = Math.min(1, Math.max(0, wall.graphicOverlayOpacity));
      const overlayBlend = cssBlendToSharp(wall.graphicBlendMode) as Blend;
      if (overlayOpacity > 0.001) {
        const overlayPath = OVERLAY_A;
        let overlayBuf: Buffer;
        try {
          overlayBuf = await fs.readFile(overlayPath);
        } catch (e2) {
          await writeWallCompositeMeta({
            ...meta,
            lastError: `Thiếu file overlay: ${overlayPath}`,
          });
          throw e2;
        }
        let overlay = await sharp(overlayBuf)
          .resize(outW, outH, { fit: "cover", position: "centre" })
          .ensureAlpha()
          .png()
          .toBuffer();
        overlay = await applyAlphaScale(overlay, overlayOpacity);
        mergedFinal = await sharp(mergedFinal)
          .composite([{ input: overlay, left: 0, top: 0, blend: overlayBlend }])
          .jpeg({ quality: 90 })
          .toBuffer();
      }
    }

    merged = mergedFinal;

    const outAbs = path.join(process.cwd(), OUT_REL);
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    const tmp = path.join(
      path.dirname(outAbs),
      `.tmp-${randomBytes(8).toString("hex")}.jpg`,
    );
    await fs.writeFile(tmp, merged);
    try {
      await fs.unlink(outAbs);
    } catch {
      /* chưa có file cũ */
    }
    await fs.rename(tmp, outAbs);

    await writeWallCompositeMeta({
      version: meta.version + 1,
      updatedAt: new Date().toISOString(),
      useOverlayBNext: false,
      lastError: undefined,
    });
  } catch (err) {
    console.error("[wallComposite]", err);
    const meta = await readWallCompositeMeta();
    await writeWallCompositeMeta({
      ...meta,
      lastError: err instanceof Error ? err.message : String(err),
    });
  } finally {
    done();
  }
}
