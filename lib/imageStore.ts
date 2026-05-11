import { promises as fs } from "fs";
import path from "path";

import { DEFAULT_IMAGE_URLS } from "@/lib/mockImages";
import type { ImagesPayload } from "@/lib/types";

const DATA_PATH = path.join(process.cwd(), "data", "images.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    const initial: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS] };
    await fs.writeFile(DATA_PATH, JSON.stringify(initial, null, 2), "utf8");
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
    const fallback: ImagesPayload = { images: [...DEFAULT_IMAGE_URLS] };
    await fs.writeFile(DATA_PATH, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
  const payload = parsed as ImagesPayload;
  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    return { images: [...DEFAULT_IMAGE_URLS] };
  }
  return payload;
}

/** Chuỗi Promise để không đọc/ghi `images.json` chồng chéo (upload nhanh / song song). */
let prependChain: Promise<void> = Promise.resolve();

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
    const { images } = await readImages();
    const deduped = images.filter((u) => u !== url);
    const next: ImagesPayload = { images: [url, ...deduped] };
    await fs.writeFile(DATA_PATH, JSON.stringify(next, null, 2), "utf8");
    return next;
  } finally {
    done();
  }
}
