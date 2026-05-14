import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import sharp, { type Blend, type OverlayOptions } from "sharp";

import { readImages } from "@/lib/imageStore";
import { cssBlendToSharp } from "@/lib/wallCompositeBlendMap";
import { readWallCompositeMeta, writeWallCompositeMeta } from "@/lib/wallCompositeMeta";
import { readWallText } from "@/lib/wallTextStore";
import { STRIP_GAP_PX } from "@/lib/wallStripConstants";

const OUT_REL = path.join("public", "generated", "wall-composite.jpg");
const OVERLAY_A = path.join(process.cwd(), "public", "wall-overlays", "wall-composite-A.png");
const NEN_PNG = path.join(process.cwd(), "public", "wall-overlays", "nen.png");
const CHU_PNG = path.join(process.cwd(), "public", "wall-overlays", "chu.png");
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

/** Đè nền thiết kế sau lưới ảnh (alpha lớp). */
const NEN_OPACITY = 0.65;
/** Lớp chữ căn giữa khung xuất (alpha lớp). */
const CHU_OPACITY = 0.5;

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

async function readOptionalFile(abs: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

/**
 * Chữ PNG/JPEG: scale theo tỷ lệ vừa khung (contain), đặt giữa canvas outW×outH
 * (không kéo méo; không ép full khung như resize contain trực tiếp).
 */
async function buildChuLayerCentered(
  chuBuf: Buffer,
  outW: number,
  outH: number,
  opacity: number,
): Promise<Buffer> {
  const m = await sharp(chuBuf).metadata();
  const iw = Math.max(1, m.width ?? 1);
  const ih = Math.max(1, m.height ?? 1);
  const scale = Math.min(outW / iw, outH / ih);
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const left = Math.floor((outW - w) / 2);
  const top = Math.floor((outH - h) / 2);
  const scaled = await sharp(chuBuf)
    .resize(w, h, { fit: "fill" })
    .ensureAlpha()
    .png()
    .toBuffer();
  const canvas = await sharp({
    create: {
      width: outW,
      height: outH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left, top }])
    .png()
    .toBuffer();
  return applyAlphaScale(canvas, opacity);
}

/** Xóa file tạm ghép dở dạng `.tmp-*.jpg` (chỉ giữ `wall-composite.jpg` mới nhất). */
async function cleanupStaleCompositeTemps(): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(GENERATED_DIR);
  } catch {
    return;
  }
  await Promise.all(
    names
      .filter((n) => n.startsWith(".tmp-") && n.endsWith(".jpg"))
      .map((n) => fs.unlink(path.join(GENERATED_DIR, n)).catch(() => {})),
  );
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
    const gridJpeg = await base.composite(composites).jpeg({ quality: 88 }).toBuffer();

    /* Một lần nén JPEG cuối; giữa chừng dùng RGBA để trộn alpha đúng (tránh chuỗi JPEG làm lệch màu). */
    let rgbaBase = await sharp(gridJpeg)
      .resize(outW, outH, { fit: "cover", position: "centre" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const meta = await readWallCompositeMeta();
    const stack: OverlayOptions[] = [];

    const nenBuf = await readOptionalFile(NEN_PNG);
    if (nenBuf) {
      let nenLayer = await sharp(nenBuf)
        .resize(outW, outH, { fit: "cover", position: "centre" })
        .ensureAlpha()
        .png()
        .toBuffer();
      nenLayer = await applyAlphaScale(nenLayer, NEN_OPACITY);
      stack.push({ input: nenLayer, left: 0, top: 0 });
    } else {
      console.warn("[wallComposite] không có nen.png — bỏ qua lớp nền:", NEN_PNG);
    }

    const chuBuf = await readOptionalFile(CHU_PNG);
    if (chuBuf) {
      const chuLayer = await buildChuLayerCentered(chuBuf, outW, outH, CHU_OPACITY);
      stack.push({ input: chuLayer, left: 0, top: 0 });
    } else {
      console.warn("[wallComposite] không có chu.png — bỏ qua lớp chữ:", CHU_PNG);
    }

    const overlayOpacity = Math.min(1, Math.max(0, wall.graphicOverlayOpacity));
    const overlayBlend = cssBlendToSharp(wall.graphicBlendMode) as Blend;
    if (overlayOpacity > 0.001) {
      let overlayBuf: Buffer;
      try {
        overlayBuf = await fs.readFile(OVERLAY_A);
      } catch (e2) {
        await writeWallCompositeMeta({
          ...meta,
          lastError: `Thiếu file overlay A: ${OVERLAY_A}`,
        });
        throw e2;
      }
      let overlay = await sharp(overlayBuf)
        .resize(outW, outH, { fit: "cover", position: "centre" })
        .ensureAlpha()
        .png()
        .toBuffer();
      overlay = await applyAlphaScale(overlay, overlayOpacity);
      stack.push({ input: overlay, left: 0, top: 0, blend: overlayBlend });
    }

    const merged =
      stack.length === 0
        ? await sharp(rgbaBase).jpeg({ quality: 92, mozjpeg: true }).toBuffer()
        : await sharp(rgbaBase)
            .composite(stack)
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer();

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

    await cleanupStaleCompositeTemps();

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
