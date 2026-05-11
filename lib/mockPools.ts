import type { ImagePools } from "@/lib/types";

/** Seed-based placeholders so pools stay stable until uploads replace them. */
export const DEFAULT_POOLS: ImagePools = {
  textImagesColor1: [
    "https://picsum.photos/seed/hb-c1a/400/400",
    "https://picsum.photos/seed/hb-c1b/400/400",
    "https://picsum.photos/seed/hb-c1c/400/400",
  ],
  textImagesColor2: [
    "https://picsum.photos/seed/hb-c2a/400/400",
    "https://picsum.photos/seed/hb-c2b/400/400",
    "https://picsum.photos/seed/hb-c2c/400/400",
  ],
  textImagesColor3: [
    "https://picsum.photos/seed/hb-c3a/400/400",
    "https://picsum.photos/seed/hb-c3b/400/400",
    "https://picsum.photos/seed/hb-c3c/400/400",
  ],
  bgImages: [
    "https://picsum.photos/seed/hb-bga/400/400",
    "https://picsum.photos/seed/hb-bgb/400/400",
    "https://picsum.photos/seed/hb-bgc/400/400",
    "https://picsum.photos/seed/hb-bgd/400/400",
  ],
};

export const PLACEHOLDER_TILE =
  "https://picsum.photos/seed/hb-empty/400/400";
