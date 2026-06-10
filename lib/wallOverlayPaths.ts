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
export const DEFAULT_WALL_OVERLAY_SET_ID = "default";

export type WallOverlayLayer = "a" | "b";

export function wallCompositeOverlayFilename(layer: WallOverlayLayer): string {
  return layer === "b" ? OVERLAY_B_FILENAME : OVERLAY_A_FILENAME;
}

export function wallOverlaySetsRoot(): string {
  return path.join(process.cwd(), "data", "wall-overlay-sets");
}

export function isValidWallOverlaySetId(id: string): boolean {
  return id === DEFAULT_WALL_OVERLAY_SET_ID || /^set-[a-z0-9-]{8,80}$/i.test(id);
}

/**
 * Bản upload API ghi tại đây (thư mục `data/` luôn ghi được trong entrypoint Docker).
 * Không phụ thuộc volume RO của `public/wall-overlays`.
 */
export function wallCompositeOverlayDataPath(
  layer: WallOverlayLayer,
  setId = DEFAULT_WALL_OVERLAY_SET_ID,
): string {
  if (!isValidWallOverlaySetId(setId)) {
    throw new Error(`Invalid wall overlay set id: ${setId}`);
  }
  const filename = wallCompositeOverlayFilename(layer);
  if (setId === DEFAULT_WALL_OVERLAY_SET_ID) {
    return path.join(process.cwd(), "data", "wall-overlays", filename);
  }
  return path.join(wallOverlaySetsRoot(), setId, filename);
}

export function wallCompositeOverlayADataPath(): string {
  return wallCompositeOverlayDataPath("a");
}

export function wallCompositeOverlayBDataPath(): string {
  return wallCompositeOverlayDataPath("b");
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
