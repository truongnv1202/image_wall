import { promises as fs } from "fs";
import path from "path";

/**
 * Thư mục chứa `chu.png`, `nen.png`, `wall-composite-A.png`, `wall-composite-B.png`.
 * Production (Docker): `WALL_OVERLAYS_DIR` nếu `cwd` ≠ thư mục project.
 * Mặc định: `{cwd}/public/wall-overlays`.
 */
export function wallOverlaysDir(): string {
  const env = process.env.WALL_OVERLAYS_DIR?.trim();
  if (env && env.length > 0) {
    return path.resolve(env);
  }
  return path.join(process.cwd(), "public", "wall-overlays");
}

/** Ưu tiên overlay, sau đó `public/` gốc. */
export function chuPngSearchPaths(): [string, string] {
  const base = wallOverlaysDir();
  const root = process.cwd();
  return [path.join(base, "chu.png"), path.join(root, "public", "chu.png")];
}

export function nenPngSearchPaths(): [string, string] {
  const base = wallOverlaysDir();
  const root = process.cwd();
  return [path.join(base, "nen.png"), path.join(root, "public", "nen.png")];
}

const OVERLAY_A_FILENAME = "wall-composite-A.png";
const OVERLAY_B_FILENAME = "wall-composite-B.png";

export type WallOverlayLayer = "a" | "b";

/**
 * Bản upload API ghi tại đây (thư mục `data/` luôn ghi được trong entrypoint Docker).
 * Không phụ thuộc volume RO của `public/wall-overlays`.
 */
export function wallCompositeOverlayADataPath(): string {
  return path.join(process.cwd(), "data", "wall-overlays", OVERLAY_A_FILENAME);
}

export function wallCompositeOverlayBDataPath(): string {
  return path.join(process.cwd(), "data", "wall-overlays", OVERLAY_B_FILENAME);
}

/** Ưu tiên bản upload (`data/…`), sau đó `{wallOverlaysDir}/wall-composite-A.png`. */
export async function resolveWallCompositeOverlayAFile(): Promise<string | null> {
  const candidates = [wallCompositeOverlayADataPath(), path.join(wallOverlaysDir(), OVERLAY_A_FILENAME)];
  for (const p of candidates) {
    try {
      await fs.access(p);
      const st = await fs.stat(p);
      if (st.isFile() && st.size > 0) return p;
    } catch {
      continue;
    }
  }
  return null;
}

/** Ưu tiên `data/…`, sau đó `{wallOverlaysDir}/wall-composite-B.png`. */
export async function resolveWallCompositeOverlayBFile(): Promise<string | null> {
  const candidates = [wallCompositeOverlayBDataPath(), path.join(wallOverlaysDir(), OVERLAY_B_FILENAME)];
  for (const p of candidates) {
    try {
      await fs.access(p);
      const st = await fs.stat(p);
      if (st.isFile() && st.size > 0) return p;
    } catch {
      continue;
    }
  }
  return null;
}
