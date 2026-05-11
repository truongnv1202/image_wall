import { NextResponse } from "next/server";

import { readPools } from "@/lib/imageStore";

export async function GET() {
  const pools = await readPools();
  return NextResponse.json(pools);
}
