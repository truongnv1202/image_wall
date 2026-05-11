import { NextResponse } from "next/server";

import { readImages } from "@/lib/imageStore";

export async function GET() {
  const data = await readImages();
  return NextResponse.json(data);
}
