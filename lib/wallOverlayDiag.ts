import { promises as fs } from "fs";
import path from "path";

import { chuPngSearchPaths, nenPngSearchPaths, wallOverlaysDir } from "@/lib/wallOverlayPaths";

const DATA_LOG_REL = path.join("data", "wall-overlay-diag.log");

type LogDetail = Record<string, string | number | boolean | null | undefined>;

async function tryAppendLog(abs: string, line: string): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.appendFile(abs, line, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function appendDiag(step: string, detail?: LogDetail): Promise<void> {
  const cwd = process.cwd();
  const dataAbs = path.join(cwd, DATA_LOG_REL);
  const line =
    JSON.stringify({
      iso: new Date().toISOString(),
      step,
      cwd,
      nodeEnv: process.env.NODE_ENV ?? null,
      wallOverlaysDir: process.env.WALL_OVERLAYS_DIR?.trim() || null,
      ...detail,
    }) + "\n";

  const ok = await tryAppendLog(dataAbs, line);
  if (!ok) {
    console.error("[wallOverlayDiag] không ghi được:", dataAbs, { step });
  }
}

async function fileExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/** Ghi một dòng JSON: các path `chu.png` / `nen.png` có tồn tại hay không (khởi động server). */
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
  await appendDiag("overlay-chu-nen-files", {
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
