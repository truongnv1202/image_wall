import { promises as fs } from "fs";
import path from "path";

import { chuPngSearchPaths, nenPngSearchPaths, wallOverlaysDir } from "@/lib/wallOverlayPaths";

/** File log trong `public` — xem qua HTTP: `/logs/wall-composite-step.log` (nếu ghi được). */
export const WALL_COMPOSITE_PUBLIC_LOG_REL = path.join("public", "logs", "wall-composite-step.log");

/** Fallback khi `public/logs` không ghi được (Docker/standalone thường chỉ chắc chắn ghi `data/`). */
export const WALL_COMPOSITE_DATA_LOG_REL = path.join("data", "wall-composite-step.log");

export type WallCompositeLogDetail = Record<string, string | number | boolean | null | undefined>;

async function tryAppendLog(abs: string, line: string): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.appendFile(abs, line, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Ghi một dòng JSON (append). Thử `public/logs/` trước, thất bại thì ghi `data/` (cùng nội dung).
 * Không throw.
 */
export async function logWallCompositePublic(step: string, detail?: WallCompositeLogDetail): Promise<void> {
  const cwd = process.cwd();
  const publicAbs = path.join(cwd, WALL_COMPOSITE_PUBLIC_LOG_REL);
  const dataAbs = path.join(cwd, WALL_COMPOSITE_DATA_LOG_REL);
  const line =
    JSON.stringify({
      iso: new Date().toISOString(),
      step,
      cwd,
      nodeEnv: process.env.NODE_ENV ?? null,
      wallOverlaysDir: process.env.WALL_OVERLAYS_DIR?.trim() || null,
      ...detail,
    }) + "\n";

  const okPublic = await tryAppendLog(publicAbs, line);
  if (okPublic) return;

  const okData = await tryAppendLog(dataAbs, line);
  if (okData) {
    console.warn("[logWallCompositePublic] không ghi được public/logs — đã ghi fallback:", dataAbs);
    return;
  }

  const err = new Error("append failed");
  console.error("[logWallCompositePublic] không ghi được cả public/logs lẫn data/", {
    step,
    publicAbs,
    dataAbs,
    err,
  });
}

async function fileExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/** Một dòng log JSON: từng path `chu.png` / `nen.png` (overlay + public) có tồn tại hay không. */
export async function logWallOverlayChuNenExists(): Promise<void> {
  const base = wallOverlaysDir();
  const [chu0, chu1] = chuPngSearchPaths();
  const [nen0, nen1] = nenPngSearchPaths();
  const [chuWallEx, chuPubEx, nenWallEx, nenPubEx] = await Promise.all([
    fileExists(chu0),
    fileExists(chu1),
    fileExists(nen0),
    fileExists(nen1),
  ]);
  await logWallCompositePublic("overlay-chu-nen-files", {
    overlaysDirResolved: base,
    chuWallOverlaysPath: chu0,
    chuWallOverlaysExists: chuWallEx,
    chuPublicPath: chu1,
    chuPublicExists: chuPubEx,
    nenWallOverlaysPath: nen0,
    nenWallOverlaysExists: nenWallEx,
    nenPublicPath: nen1,
    nenPublicExists: nenPubEx,
    chuFound: chuWallEx || chuPubEx,
    nenFound: nenWallEx || nenPubEx,
  });
}
