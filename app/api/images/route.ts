import { NextResponse } from "next/server";

import { readImages, resetImagesToDefaultsAndRemoveUploads } from "@/lib/imageStore";
import { rejectWithoutUploadToken } from "@/lib/uploadAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readImages();
  return NextResponse.json(data);
}

/** Xóa toàn bộ file trong `public/uploads/` và reset danh sách ảnh về URL mẫu — cần token upload (khi server bật). */
export async function DELETE(request: Request) {
  const denied = rejectWithoutUploadToken(request);
  if (denied) return denied;
  try {
    const next = await resetImagesToDefaultsAndRemoveUploads();
    void import("@/lib/generateWallComposite")
      .then((m) => m.regenerateWallComposite())
      .catch((e) => console.error("[images DELETE] wall composite", e));
    return NextResponse.json(next);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed";
    console.error("[images DELETE]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
