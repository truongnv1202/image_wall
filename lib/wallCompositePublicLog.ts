import { promises as fs } from "fs";
import path from "path";

/** File log trong `public` — xem qua HTTP: `/logs/wall-composite-step.log` (static) hoặc đọc trên đĩa. */
export const WALL_COMPOSITE_PUBLIC_LOG_REL = path.join("public", "logs", "wall-composite-step.log");

export type WallCompositeLogDetail = Record<string, string | number | boolean | null | undefined>;

/**
 * Ghi một dòng JSON (append) để theo dõi từng bước ghép tường / scheduler.
 * Không throw — lỗi ghi log chỉ in ra console.
 */
export async function logWallCompositePublic(step: string, detail?: WallCompositeLogDetail): Promise<void> {
  const abs = path.join(process.cwd(), WALL_COMPOSITE_PUBLIC_LOG_REL);
  const line =
    JSON.stringify({
      iso: new Date().toISOString(),
      step,
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV ?? null,
      wallOverlaysDir: process.env.WALL_OVERLAYS_DIR?.trim() || null,
      ...detail,
    }) + "\n";
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.appendFile(abs, line, "utf8");
  } catch (e) {
    console.error("[logWallCompositePublic]", step, e);
  }
}
