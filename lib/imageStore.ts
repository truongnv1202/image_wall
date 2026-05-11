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
  const parsed = JSON.parse(raw) as ImagesPayload;
  if (!Array.isArray(parsed.images) || parsed.images.length === 0) {
    return { images: [...DEFAULT_IMAGE_URLS] };
  }
  return parsed;
}

/** unshift URL — ảnh mới lên đầu mảng. */
export async function prependImageUrl(url: string): Promise<ImagesPayload> {
  const { images } = await readImages();
  const next: ImagesPayload = { images: [url, ...images] };
  await fs.writeFile(DATA_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
