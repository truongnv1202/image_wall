import { NextResponse } from "next/server";

import { rejectWithoutUploadToken } from "@/lib/uploadAuth";
import { normalizeWallTextPayload, readWallText, writeWallText } from "@/lib/wallTextStore";

export const runtime = "nodejs";

export async function GET() {
  const config = await readWallText();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const denied = rejectWithoutUploadToken(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const next = normalizeWallTextPayload(body);
  const saved = await writeWallText(next);
  void import("@/lib/generateWallComposite")
    .then((m) => m.regenerateWallComposite())
    .catch((e) => console.error("[wall-text POST] wall composite", e));
  return NextResponse.json(saved);
}
