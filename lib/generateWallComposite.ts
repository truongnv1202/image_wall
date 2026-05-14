import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import sharp, { type Blend, type OverlayOptions } from "sharp";

import { readImages } from "@/lib/imageStore";
import { cssBlendToSharp } from "@/lib/wallCompositeBlendMap";
import { readWallCompositeMeta, writeWallCompositeMeta } from "@/lib/wallCompositeMeta";
import {
  applyLetterMaskToGridRgba,
  buildLetterMaskFromChuRgba,
  maskMaxValue,
} from "@/lib/wallCompositeChuMask";
import { readWallText } from "@/lib/wallTextStore";
import { STRIP_GAP_PX } from "@/lib/wallStripConstants";

const root = process.cwd();
const OUT_REL = path.join("public", "generated", "wall-composite.jpg");
const OVERLAY_A = path.join(root, "public", "wall-overlays", "wall-composite-A.png");
const GENERATED_DIR = path.join(root, "public", "generated");

/**
 * Ưu tiên `public/wall-overlays/` (vd. `/opt/image_wall/public/wall-overlays/chu.png`),
 * không có thì thử `public/` gốc.
 */
const NEN_PNG_PATHS = [
  path.join(root, "public", "wall-overlays", "nen.png"),
  path.join(root, "public", "nen.png"),
] as const;
const CHU_PNG_PATHS = [
  path.join(root, "public", "wall-overlays", "chu.png"),
  path.join(root, "public", "chu.png"),
] as const;

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

async function readOptionalFirstPath(paths: readonly string[]): Promise<Buffer | null> {
  for (const p of paths) {
    const b = await readOptionalFile(p);
    if (b) return b;
  }
  return null;
}

async function anyPathExists(paths: readonly string[]): Promise<boolean> {
  for (const p of paths) {
    try {
      await fs.access(p);
      return true;
    } catch {
      /* thử path tiếp */
    }
  }
  return false;
}

/**
 * Dev: nếu thiếu `chu.png`, tạo placeholder (nền sáng + vệt tối) để STEP 2 chạy được.
 * Production không ghi file. Chỉ tạo dưới `public/wall-overlays/` khi không có file ở mọi vị trí tìm kiếm.
 */
async function ensureDevPlaceholderChuPngIfMissing(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  if (await anyPathExists(CHU_PNG_PATHS)) return false;
  const target = CHU_PNG_PATHS[0];
  await fs.mkdir(path.dirname(target), { recursive: true });
  const W = 960;
  const H = 420;
  const barH = 100;
  const bar = await sharp({
    create: {
      width: W,
      height: barH,
      channels: 3,
      background: { r: 28, g: 32, b: 40 },
    },
  })
    .png()
    .toBuffer();
  const png = await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 248, g: 248, b: 250 },
    },
  })
    .composite([{ input: bar, left: 0, top: Math.floor((H - barH) / 2) }])
    .png()
    .toBuffer();
  await fs.writeFile(target, png);
  console.info("[wallComposite] STEP2: đã tạo chu.png placeholder (dev):", target);
  return true;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = a;
  }
}

/** chu.png căn giữa canvas outW×outH — raw RGBA (để tạo mask). */
async function buildChuRgbaCanvasRaw(chuBuf: Buffer, outW: number, outH: number): Promise<Buffer> {
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
  return sharp({
    create: {
      width: outW,
      height: outH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left, top }])
    .ensureAlpha()
    .raw()
    .toBuffer();
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
    const devChuBootstrap = await ensureDevPlaceholderChuPngIfMissing();
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

    /** STEP 1: lưới cols×rows từ config; lặp pool; mỗi lần ghép xáo trộn vị trí ô ngẫu nhiên. */
    const cells = rows * cols;
    const cellUrls: string[] = [];
    for (let i = 0; i < cells; i++) {
      cellUrls.push(pool[i % pool.length]!);
    }
    shuffleInPlace(cellUrls);

    const composites: { input: Buffer; left: number; top: number }[] = [];
    let cellIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const url = cellUrls[cellIdx]!;
        cellIdx++;
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

    /* Lưới full khung xuất — RGBA raw + PNG nền (STEP 3: lớp dưới cùng). */
    const { data: gridRaw, info: gridInfo } = await sharp(gridJpeg)
      .resize(outW, outH, { fit: "cover", position: "centre" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const gridBasePng = await sharp(gridRaw, {
      raw: { width: gridInfo.width, height: gridInfo.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const meta = await readWallCompositeMeta();
    const stack: OverlayOptions[] = [];
    let lastStep2: string = "skipped-no-chu";

    const nenBuf = await readOptionalFirstPath(NEN_PNG_PATHS);
    if (nenBuf) {
      let nenLayer = await sharp(nenBuf)
        .resize(outW, outH, { fit: "cover", position: "centre" })
        .ensureAlpha()
        .png()
        .toBuffer();
      nenLayer = await applyAlphaScale(nenLayer, NEN_OPACITY);
      stack.push({ input: nenLayer, left: 0, top: 0 });
    } else {
      console.warn("[wallComposite] không có nen.png — đã thử:", NEN_PNG_PATHS.join(" | "));
    }

    const chuBuf = await readOptionalFirstPath(CHU_PNG_PATHS);
    if (chuBuf) {
      /**
       * STEP 2: mask từ chu (alpha × độ lệch màu viền khi không có alpha).
       * chu → mask × GRID → nhân chữ (multiply) → CHUMOI.
       * STEP 3: CHUMOI trên nen, nền dưới là lưới full (gridBasePng).
       */
      const chuCanvasRaw = await buildChuRgbaCanvasRaw(chuBuf, outW, outH);
      const mask = buildLetterMaskFromChuRgba(Buffer.from(chuCanvasRaw), outW, outH);
      const mMax = maskMaxValue(mask);
      if (mMax < 12) {
        console.warn("[wallComposite] STEP2: mask chữ quá yếu (max=", mMax, ") — lớp chữ mờ phủ cả khung");
        lastStep2 = "fallback-semi-chu";
        const chuLayer = await buildChuLayerCentered(chuBuf, outW, outH, CHU_OPACITY);
        stack.push({ input: chuLayer, left: 0, top: 0 });
      } else {
        lastStep2 = devChuBootstrap ? "chumoi-dev-placeholder-chu" : "chumoi";
        console.info("[wallComposite] STEP2:", lastStep2, "maskMax=", mMax);
        const chumoiRaw = applyLetterMaskToGridRgba(Buffer.from(gridRaw), mask, outW, outH);
        const chuForTone = await buildChuLayerCentered(chuBuf, outW, outH, CHU_OPACITY);
        const chumoiPng = await sharp(chumoiRaw, {
          raw: { width: outW, height: outH, channels: 4 },
        })
          .composite([{ input: chuForTone, blend: "multiply", left: 0, top: 0 }])
          .png()
          .toBuffer();
        stack.push({ input: chumoiPng, left: 0, top: 0 });
      }
    } else {
      console.warn("[wallComposite] STEP2 skipped — không có chu.png — đã thử:", CHU_PNG_PATHS.join(" | "));
    }

    const overlayOpacity = Math.min(1, Math.max(0, wall.graphicOverlayOpacity));
    const overlayBlend = cssBlendToSharp(wall.graphicBlendMode) as Blend;
    if (overlayOpacity > 0.001) {
      const overlayBuf = await readOptionalFile(OVERLAY_A);
      if (!overlayBuf) {
        console.warn("[wallComposite] không có overlay A — bỏ qua (trước đây sẽ lỗi):", OVERLAY_A);
      } else {
        let overlay = await sharp(overlayBuf)
          .resize(outW, outH, { fit: "cover", position: "centre" })
          .ensureAlpha()
          .png()
          .toBuffer();
        overlay = await applyAlphaScale(overlay, overlayOpacity);
        stack.push({ input: overlay, left: 0, top: 0, blend: overlayBlend });
      }
    }

    const merged =
      stack.length === 0
        ? await sharp(gridBasePng).jpeg({ quality: 92, mozjpeg: true }).toBuffer()
        : await sharp(gridBasePng)
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
      lastStep2,
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
