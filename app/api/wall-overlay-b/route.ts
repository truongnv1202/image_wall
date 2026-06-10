import { promises as fs } from "fs";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { activeWallOverlaySetIdForWall, resolveWallOverlayLayerFile } from "@/lib/wallOverlayStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const setId = await activeWallOverlaySetIdForWall();
  const abs = await resolveWallOverlayLayerFile("b", setId);
  if (!abs) {
    return NextResponse.json(
      { exists: false, setId, version: 0, width: null, height: null },
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
      setId,
      version: Math.floor(st.mtimeMs),
      width: w,
      height: h,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
