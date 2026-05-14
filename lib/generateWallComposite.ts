import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import sharp, { type Blend, type OverlayOptions } from "sharp";

import { readImages } from "@/lib/imageStore";
import { cssBlendToSharp } from "@/lib/wallCompositeBlendMap";
import { readWallCompositeMeta, writeWallCompositeMeta } from "@/lib/wallCompositeMeta";
import { readWallText } from "@/lib/wallTextStore";
import { STRIP_GAP_PX } from "@/lib/wallStripConstants";
import { ensureWallUploadTileOnDisk } from "@/lib/wallUploadTile";
import { logWallCompositePublic, logWallOverlayChuNenExists } from "@/lib/wallCompositePublicLog";
import { wallCompositeOverlayASearchPaths, wallOverlaysDir } from "@/lib/wallOverlayPaths";

const root = process.cwd();
const OUT_REL = path.join("public", "generated", "wall-composite.jpg");
const GENERATED_DIR = path.join(root, "public", "generated");

const overlaysBase = wallOverlaysDir();
const OVERLAY_A_SEARCH = wallCompositeOverlayASearchPaths();

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
    if (rel.startsWith("uploads/")) {
      await ensureWallUploadTileOnDisk(abs);
    }
    return fs.readFile(abs);
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return fetchBuffer(url);
  }
  throw new Error(`URL không hỗ trợ: ${url.slice(0, 80)}`);
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

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = a;
  }
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

/**
 * Ghép tường: **chỉ** lưới ảnh (config wall-text) + phủ `wall-composite-A.png` lên trên nếu có.
 * Alpha lớp phủ giữ từ file (không nhân thêm từ JSON). Blend từ `graphicBlendMode`.
 */
export async function regenerateWallComposite(): Promise<void> {
  const prev = genLock;
  let done!: () => void;
  genLock = new Promise<void>((r) => {
    done = r;
  });
  await prev.catch(() => {});

  await logWallCompositePublic("regenerate-lock-acquired", { pid: process.pid });
  await logWallOverlayChuNenExists();

  const lastStep2 = "grid-overlay-only";

  try {
    const wall = await readWallText();
    const { images } = await readImages();
    const pool = images.length > 0 ? images : [];
    await logWallCompositePublic("after-read-config", {
      overlaysBase,
      poolSize: pool.length,
      pipeline: "grid-plus-overlay-only",
      gridCols: wall.gridCols,
      gridRows: wall.gridRows,
      outW: wall.compositeOutWidth,
      outH: wall.compositeOutHeight,
    });
    if (pool.length === 0) {
      await logWallCompositePublic("abort-step0-no-images-in-pool", {});
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

    await logWallCompositePublic("step1-grid-start", {
      cols,
      rows,
      cells: rows * cols,
      gridW,
      gridH,
      gap,
      cellW,
      cellH,
      poolSize: pool.length,
      outW,
      outH,
    });

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
      await logWallCompositePublic("abort-step1-no-tiles-composited", { cells, tried: cellIdx });
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
    await logWallCompositePublic("step1-grid-jpeg-done", {
      composites: composites.length,
      cellsPlanned: cells,
      gridW,
      gridH,
    });

    const gridBasePng = await sharp(gridJpeg)
      .resize(outW, outH, { fit: "cover", position: "centre" })
      .ensureAlpha()
      .png()
      .toBuffer();

    await logWallCompositePublic("step1-grid-scaled-png", {
      outW,
      outH,
    });

    const meta = await readWallCompositeMeta();
    const stack: OverlayOptions[] = [];

    const overlayBlend = cssBlendToSharp(wall.graphicBlendMode) as Blend;
    const overlayBuf = await readOptionalFirstPath(OVERLAY_A_SEARCH);
    if (!overlayBuf) {
      console.warn(
        "[wallComposite] không có wall-composite-A.png — đã thử:",
        OVERLAY_A_SEARCH.join(" | "),
      );
      await logWallCompositePublic("overlay-skipped", {
        overlayPaths: OVERLAY_A_SEARCH.join(" | "),
      });
    } else {
      const overlay = await sharp(overlayBuf)
        .resize(outW, outH, { fit: "cover", position: "centre" })
        .ensureAlpha()
        .png()
        .toBuffer();
      stack.push({ input: overlay, left: 0, top: 0, blend: overlayBlend });
      await logWallCompositePublic("overlay-applied-top", {
        overlayBytes: overlay.length,
        overlayAlphaFromFileOnly: true,
        blend: wall.graphicBlendMode,
      });
    }

    await logWallCompositePublic("merge-start", { stackLen: stack.length });

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
    await logWallCompositePublic("regenerate-success", {
      lastStep2,
      version: meta.version + 1,
      stackLen: stack.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logWallCompositePublic("regenerate-error", { error: msg });
    console.error("[wallComposite]", err);
    const meta = await readWallCompositeMeta();
    await writeWallCompositeMeta({
      ...meta,
      lastError: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await logWallCompositePublic("regenerate-finally-lock-release", {});
    done();
  }
}
