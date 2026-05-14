import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { readWallCompositeMeta } from "@/lib/wallCompositeMeta";

export const runtime = "nodejs";
/** Tránh cache CDN/proxy khiến client tưởng `ready: false` mãi sau khi đã ghép xong. */
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "public", "generated", "wall-composite.jpg");
const IMAGES_JSON = path.join(process.cwd(), "data", "images.json");

export async function GET() {
  const meta = await readWallCompositeMeta();
  let ready = false;
  try {
    const st = await fs.stat(FILE);
    ready = st.size > 0 && meta.version > 0;
  } catch {
    ready = false;
  }

  /** `images.json` mới hơn file ghép ⇒ ảnh vừa upload chưa có trong composite — client hiện lưới ô tạm. */
  let compositeOutOfSync = false;
  if (ready) {
    try {
      const [imgSt, compSt] = await Promise.all([fs.stat(IMAGES_JSON), fs.stat(FILE)]);
      compositeOutOfSync = imgSt.mtimeMs > compSt.mtimeMs;
    } catch {
      compositeOutOfSync = false;
    }
  }

  return NextResponse.json(
    {
      url: "/api/wall-composite/image",
      version: meta.version,
      updatedAt: meta.updatedAt,
      ready,
      lastError: meta.lastError ?? null,
      lastStep2: meta.lastStep2 ?? null,
      compositeOutOfSync,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
