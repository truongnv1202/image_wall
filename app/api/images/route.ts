import { NextResponse } from "next/server";

import { readImages, resetImagesToDefaultsAndRemoveUploads } from "@/lib/imageStore";
import { rejectWithoutUploadToken } from "@/lib/uploadAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readImages();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function DELETE(request: Request) {
  try {
    const denied = rejectWithoutUploadToken(request);
    if (denied) return denied;

    const data = await resetImagesToDefaultsAndRemoveUploads();
    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    console.error("[images] DELETE", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
