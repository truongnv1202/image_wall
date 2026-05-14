import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import sharp from "sharp";

import { rejectWithoutUploadToken } from "@/lib/uploadAuth";
import { looksLikeHeicOrHeif } from "@/lib/sniffImageFormat";
import { normalizeUploadTokenSegment } from "@/lib/uploadPageToken";
import { wallCompositeOverlayAPath, wallOverlaysDir } from "@/lib/wallOverlayPaths";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 8192;

export const runtime = "nodejs";

function firstFormUploadToken(form: FormData): string | null {
  for (const key of ["uploadToken", "token"]) {
    const v = form.get(key);
    if (typeof v !== "string" || v.length === 0) continue;
    const t = normalizeUploadTokenSegment(v);
    if (t.length > 0) return t;
  }
  return null;
}

/**
 * Upload `wall-composite-A.png`: chỉ ghi đè file trong thư mục overlay, **không** resize,
 * **không** đổi `graphicOverlayOpacity` / kích thước ghép trong `wall-text.json` (độ mờ overlay chỉ từ alpha file).
 * Ảnh được chuẩn hoá sang PNG (cùng width×height pixel).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const denied = rejectWithoutUploadToken(request, firstFormUploadToken(form));
    if (denied) return denied;

    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File quá lớn (tối đa ${Math.round(MAX_BYTES / (1024 * 1024))} MB).` },
        { status: 400 },
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    if (looksLikeHeicOrHeif(input)) {
      return NextResponse.json(
        {
          error:
            "Ảnh HEIC/HEIF không hỗ trợ. Hãy xuất JPG/PNG/WebP rồi upload lại.",
          code: "HEIC",
        },
        { status: 400 },
      );
    }

    const meta = await sharp(input).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 1 || h < 1 || w > MAX_EDGE || h > MAX_EDGE) {
      return NextResponse.json(
        { error: `Ảnh không đọc được hoặc kích thước không hợp lệ (1–${MAX_EDGE}px mỗi cạnh).` },
        { status: 400 },
      );
    }

    const outAbs = wallCompositeOverlayAPath();
    await mkdir(wallOverlaysDir(), { recursive: true });
    const pngBuf = await sharp(input).png().toBuffer();
    await writeFile(outAbs, pngBuf);

    void import("@/lib/generateWallComposite")
      .then(({ regenerateWallComposite }) => regenerateWallComposite())
      .catch((e) => console.error("[upload-wall-overlay] regenerateWallComposite:", e));

    return NextResponse.json({
      ok: true,
      file: "wall-composite-A.png",
      width: w,
      height: h,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    console.error("[upload-wall-overlay]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
