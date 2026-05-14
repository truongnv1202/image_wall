import { promises as fs } from "fs";
import path from "path";

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
