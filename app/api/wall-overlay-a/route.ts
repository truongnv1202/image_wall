import { promises as fs } from "fs";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { resolveWallCompositeOverlayAFile } from "@/lib/wallOverlayPaths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const abs = await resolveWallCompositeOverlayAFile();
  if (!abs) {
    return NextResponse.json(
      { exists: false, version: 0, width: null, height: null },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const st = await fs.stat(abs);
  const meta = await sharp(abs).metadata();
  const w = meta.width ?? null;
  const h = meta.height ?? null;

  return NextResponse.json(
    {
      exists: true,
      version: Math.floor(st.mtimeMs),
      width: w,
      height: h,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
