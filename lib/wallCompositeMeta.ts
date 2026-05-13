import { promises as fs } from "fs";
import path from "path";

export type WallCompositeMeta = {
  /** Tăng mỗi lần ghép xong — client dùng cache-bust. */
  version: number;
  updatedAt: string;
  /** Dự phòng (luân phiên B); hiện luôn dùng overlay A. */
  useOverlayBNext: boolean;
  lastError?: string;
};

const META_PATH = path.join(process.cwd(), "data", "wall-composite-meta.json");

const DEFAULT: WallCompositeMeta = {
  version: 0,
  updatedAt: new Date(0).toISOString(),
  useOverlayBNext: false,
};

export async function readWallCompositeMeta(): Promise<WallCompositeMeta> {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    const o = JSON.parse(raw) as Partial<WallCompositeMeta>;
    return {
      version: typeof o.version === "number" && Number.isFinite(o.version) ? Math.max(0, o.version) : 0,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : DEFAULT.updatedAt,
      useOverlayBNext: Boolean(o.useOverlayBNext),
      lastError: typeof o.lastError === "string" ? o.lastError : undefined,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function writeWallCompositeMeta(next: WallCompositeMeta): Promise<void> {
  await fs.mkdir(path.dirname(META_PATH), { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(next, null, 2), "utf8");
}
