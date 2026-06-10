import { promises as fs } from "fs";
import path from "path";

import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import type { ImagesPayload } from "@/lib/types";

const DATA_PATH = path.join(process.cwd(), "data", "images.json");

function uploadsAbsFromPublicUrl(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const rel = url.replace(/^\/+/, "");
  if (rel.includes("..") || rel.includes("\\")) return null;
  return path.join(process.cwd(), "public", rel);
}

/** Chỉ để migrate JSON cũ có `wallpaperUrl` trỏ uploads. */
function legacyWallpaperUploadUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const t = raw.trim();
  if (!t.startsWith("/uploads/")) return null;
  if (t.includes("..")) return null;
  return t;
}

function normalizeImagesPayload(parsed: unknown): ImagesPayload {
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const rawImages = Array.isArray(o.images) ? o.images.filter((x): x is string => typeof x === "string") : [];
  const images = rawImages.length > 0 ? rawImages : [...DEFAULT_IMAGE_URLS];
  return { images, wallpaperUrl: null };
}

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    const initial: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS], wallpaperUrl: null };
    await writePayload(initial);
  }
}

async function writePayload(payload: ImagesPayload): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  const tmpPath = `${DATA_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    await fs.rename(tmpPath, DATA_PATH);
  } catch (e) {
    await fs.unlink(tmpPath).catch(() => {});
    throw e;
  }
}

export async function readImages(): Promise<ImagesPayload> {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[imageStore] images.json không parse được, ghi lại mặc định:", e);
    const fallback: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS], wallpaperUrl: null };
    await writePayload(fallback);
    return fallback;
  }

  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const legacy = legacyWallpaperUploadUrl(o.wallpaperUrl);
  const normalized = normalizeImagesPayload(parsed);

  if (legacy) {
    await unlinkUploadsFileIfAny(legacy);
    await writePayload(normalized);
  }

  return normalized;
}

/** Chuỗi Promise để không đọc/ghi `images.json` chồng chéo (upload nhanh / song song). */
let prependChain: Promise<void> = Promise.resolve();

/** Xóa file trên đĩa nếu URL trỏ tới `public/uploads/`. */
async function unlinkUploadsFileIfAny(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return;
  const abs = uploadsAbsFromPublicUrl(publicUrl);
  if (!abs) return;
  const popupAbs = abs.replace(/(\.[^.\\/]+)$/i, "-popup$1");
  try {
    await fs.unlink(abs);
  } catch {
    /* đã xóa hoặc không tồn tại */
  }
  try {
    await fs.unlink(popupAbs);
  } catch {
    /* đã xóa hoặc không tồn tại */
  }
}

export type ResetImagesResult = ImagesPayload & {
  deletedFiles: number;
  failedFiles: number;
};

/** Xóa mọi file trong `public/uploads/`, ghi lại `images.json` chỉ còn URL mẫu (Picsum). */
export async function resetImagesToDefaultsAndRemoveUploads(): Promise<ResetImagesResult> {
  const prev = prependChain;
  let done!: () => void;
  prependChain = new Promise<void>((resolve) => {
    done = resolve;
  });
  await prev.catch((e) => {
    console.error("[imageStore] prepend queue hỏng trước reset:", e);
  });
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    let deletedFiles = 0;
    let failedFiles = 0;
    try {
      const names = await fs.readdir(uploadDir);
      await Promise.all(
        names.map(async (n) => {
          try {
            await fs.unlink(path.join(uploadDir, n));
            deletedFiles += 1;
          } catch {
            failedFiles += 1;
          }
        }),
      );
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const next: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS], wallpaperUrl: null };
    await writePayload(next);
    return { ...next, deletedFiles, failedFiles };
  } finally {
    done();
  }
}

/** unshift URL — ảnh mới lên đầu mảng (bỏ trùng URL nếu có). */
export async function prependImageUrl(url: string): Promise<ImagesPayload> {
  const prev = prependChain;
  let done!: () => void;
  prependChain = new Promise<void>((resolve) => {
    done = resolve;
  });
  await prev.catch((e) => {
    console.error("[imageStore] prepend queue hỏng, bỏ qua lỗi trước:", e);
  });
  try {
    const current = await readImages();
    const deduped = current.images.filter((u) => u !== url);
    const next: ImagesPayload = {
      images: [url, ...deduped],
      wallpaperUrl: null,
    };
    await writePayload(next);
    return next;
  } finally {
    done();
  }
}
