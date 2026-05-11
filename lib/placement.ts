import type { ImagePools } from "@/lib/types";
import { PLACEHOLDER_TILE } from "@/lib/mockPools";

export function pickTextUrl(textOrdinal: number, pools: ImagePools): string {
  const keys: (keyof ImagePools)[] = [
    "textImagesColor1",
    "textImagesColor2",
    "textImagesColor3",
  ];
  const key = keys[textOrdinal % 3];
  const pool = pools[key];
  const safe = pool.length ? pool : [PLACEHOLDER_TILE];
  return safe[textOrdinal % safe.length];
}

export function pickBgUrl(bgOrdinal: number, pools: ImagePools): string {
  const pool = pools.bgImages.length ? pools.bgImages : [PLACEHOLDER_TILE];
  return pool[bgOrdinal % pool.length];
}
