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

function normalizeWallpaperUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const t = raw.trim();
  if (!t.startsWith("/uploads/")) return null;
  if (t.includes("..")) return null;
  return t;
}

function normalizeImagesPayload(parsed: unknown): ImagesPayload {
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const wallpaperUrl = normalizeWallpaperUrl(o.wallpaperUrl);
  const rawImages = Array.isArray(o.images) ? o.images.filter((x): x is string => typeof x === "string") : [];
  const images = rawImages.length > 0 ? rawImages : [...DEFAULT_IMAGE_URLS];
  return { images, wallpaperUrl };
}

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    const initial: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS], wallpaperUrl: null };
    await fs.writeFile(DATA_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function writePayload(payload: ImagesPayload): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(payload, null, 2), "utf8");
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
  return normalizeImagesPayload(parsed);
}

/** Chuỗi Promise để không đọc/ghi `images.json` chồng chéo (upload nhanh / song song). */
let prependChain: Promise<void> = Promise.resolve();

/** Xóa file trên đĩa nếu URL trỏ tới `public/uploads/`. */
async function unlinkUploadsFileIfAny(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return;
  const abs = uploadsAbsFromPublicUrl(publicUrl);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch {
    /* đã xóa hoặc không tồn tại */
  }
}

/** Xóa mọi file trong `public/uploads/`, ghi lại `images.json` chỉ còn URL mẫu (Picsum) + bỏ wallpaper. */
export async function resetImagesToDefaultsAndRemoveUploads(): Promise<ImagesPayload> {
  const prev = prependChain;
  let done!: () => void;
  prependChain = new Promise<void>((resolve) => {
    done = resolve;
  });
  await prev.catch((e) => {
    console.error("[imageStore] prepend queue hỏng trước reset:", e);
  });
  try {
    const current = await readImages();
    await unlinkUploadsFileIfAny(current.wallpaperUrl);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    try {
      const names = await fs.readdir(uploadDir);
      await Promise.all(names.map((n) => fs.unlink(path.join(uploadDir, n)).catch(() => {})));
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const next: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS], wallpaperUrl: null };
    await writePayload(next);
    return next;
  } finally {
    done();
  }
}

/** unshift URL — ảnh mới lên đầu mảng (bỏ trùng URL nếu có); giữ `wallpaperUrl`. */
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
      wallpaperUrl: current.wallpaperUrl,
    };
    await writePayload(next);
    return next;
  } finally {
    done();
  }
}

/** Đặt hoặc xóa wallpaper (URL `/uploads/...` hoặc `null`). Xóa file cũ trên đĩa nếu thay bằng URL khác / null. */
export async function setWallpaperUrl(nextUrl: string | null): Promise<ImagesPayload> {
  const prev = prependChain;
  let done!: () => void;
  prependChain = new Promise<void>((resolve) => {
    done = resolve;
  });
  await prev.catch((e) => {
    console.error("[imageStore] wallpaper queue:", e);
  });
  try {
    const current = await readImages();
    const old = current.wallpaperUrl;
    if (old && old !== nextUrl) {
      await unlinkUploadsFileIfAny(old);
    }
    const next: ImagesPayload = { ...current, wallpaperUrl: nextUrl };
    await writePayload(next);
    return next;
  } finally {
    done();
  }
}
