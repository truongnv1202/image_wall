import { promises as fs } from "fs";

import { NextResponse } from "next/server";

import { resolveWallOverlayLayerFile } from "@/lib/wallOverlayStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const setId = url.searchParams.get("set");
  const abs = await resolveWallOverlayLayerFile("b", setId);
  if (!abs) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const buf = await fs.readFile(abs);
    if (buf.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
    const st = await fs.stat(abs);
    const v = url.searchParams.get("v");
    const cacheBusted = v != null && /^\d+$/.test(v);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "X-Wall-Overlay-B-Mtime": String(Math.floor(st.mtimeMs)),
        ...(cacheBusted
          ? { "Cache-Control": "public, max-age=86400, immutable" }
          : { "Cache-Control": "no-store, max-age=0" }),
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
