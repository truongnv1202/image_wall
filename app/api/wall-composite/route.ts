import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { readWallCompositeMeta } from "@/lib/wallCompositeMeta";

export const runtime = "nodejs";

const FILE = path.join(process.cwd(), "public", "generated", "wall-composite.jpg");

export async function GET() {
  const meta = await readWallCompositeMeta();
  let ready = false;
  try {
    const st = await fs.stat(FILE);
    ready = st.size > 0 && meta.version > 0;
  } catch {
    ready = false;
  }
  return NextResponse.json({
    url: "/generated/wall-composite.jpg",
    version: meta.version,
    updatedAt: meta.updatedAt,
    ready,
    lastError: meta.lastError ?? null,
  });
}
