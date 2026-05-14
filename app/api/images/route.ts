import { NextResponse } from "next/server";

import { readImages } from "@/lib/imageStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readImages();
  return NextResponse.json(data);
}
