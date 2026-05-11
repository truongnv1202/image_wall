import { promises as fs } from "fs";
import path from "path";

import type { ColorType, ImagePools } from "@/lib/types";
import { DEFAULT_POOLS } from "@/lib/mockPools";

const DATA_PATH = path.join(process.cwd(), "data", "pools.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_POOLS, null, 2), "utf8");
  }
}

export async function readPools(): Promise<ImagePools> {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as ImagePools;
}

export async function prependImage(url: string, colorType: ColorType): Promise<ImagePools> {
  const pools = await readPools();
  const key =
    colorType === "color1"
      ? "textImagesColor1"
      : colorType === "color2"
        ? "textImagesColor2"
        : colorType === "color3"
          ? "textImagesColor3"
          : "bgImages";
  const next: ImagePools = {
    ...pools,
    [key]: [url, ...pools[key]],
  };
  await fs.writeFile(DATA_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
