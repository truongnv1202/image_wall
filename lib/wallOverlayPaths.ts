import path from "path";

/**
 * Thư mục chứa `chu.png`, `nen.png`, `wall-composite-A.png`.
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

/** Trong image/volume Docker thường chỉ đọc — dùng cho `chu`/`nen` bake sẵn. */
export function wallCompositeOverlayAPath(): string {
  return path.join(wallOverlaysDir(), OVERLAY_A_FILENAME);
}

/**
 * Bản upload API ghi tại đây (thư mục `data/` luôn ghi được trong entrypoint Docker).
 * Không phụ thuộc volume RO của `public/wall-overlays`.
 */
export function wallCompositeOverlayADataPath(): string {
  return path.join(process.cwd(), "data", "wall-overlays", OVERLAY_A_FILENAME);
}

/** Đọc overlay A: ưu tiên file upload (`data/…`), sau đó thư mục overlay (image/volume). */
export function wallCompositeOverlayASearchPaths(): readonly [string, string] {
  return [wallCompositeOverlayADataPath(), wallCompositeOverlayAPath()];
}
