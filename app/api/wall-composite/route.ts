import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { readWallCompositeMeta } from "@/lib/wallCompositeMeta";
import { startWallCompositeScheduler } from "@/lib/wallCompositeScheduler";

export const runtime = "nodejs";
/** Tránh cache CDN/proxy khiến client tưởng `ready: false` mãi sau khi đã ghép xong. */
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "public", "generated", "wall-composite.jpg");

export async function GET() {
  /* Mỗi lần client poll — đảm bảo job định kỳ đã bật (dev / worker không chạy instrumentation). */
  startWallCompositeScheduler();

  const meta = await readWallCompositeMeta();
  let ready = false;
  try {
    const st = await fs.stat(FILE);
    ready = st.size > 0 && meta.version > 0;
  } catch {
    ready = false;
  }
  return NextResponse.json(
    {
      url: "/api/wall-composite/image",
      version: meta.version,
      updatedAt: meta.updatedAt,
      ready,
      lastError: meta.lastError ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
