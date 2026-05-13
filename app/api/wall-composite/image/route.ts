import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { readWallCompositeMeta } from "@/lib/wallCompositeMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "public", "generated", "wall-composite.jpg");

/**
 * Trả về file JPEG đã ghép — đi qua `/api/` để proxy (Nginx) luôn forward được,
 * khác với `/generated/...` có thể không trỏ vào Next.
 */
export async function GET(request: Request) {
  try {
    const buf = await fs.readFile(FILE);
    if (buf.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
    const meta = await readWallCompositeMeta();
    const v = new URL(request.url).searchParams.get("v");
    const cacheBusted = v != null && /^\d+$/.test(v);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "X-Wall-Composite-Version": String(meta.version),
        ...(cacheBusted
          ? { "Cache-Control": "public, max-age=86400, immutable" }
          : { "Cache-Control": "no-store, max-age=0" }),
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
