import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { readImages, setWallpaperUrl } from "@/lib/imageStore";
import { normalizeUploadImage } from "@/lib/normalizeUploadImage";
import { rejectWithoutUploadToken } from "@/lib/uploadAuth";
import { looksLikeHeicOrHeif } from "@/lib/sniffImageFormat";
import { normalizeUploadTokenSegment } from "@/lib/uploadPageToken";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

/** Upload ảnh wallpaper toàn khung (`/wall` ưu tiên hiển thị). */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const denied = rejectWithoutUploadToken(request, firstFormUploadToken(form));
    if (denied) return denied;

    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File quá lớn (tối đa ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB).` },
        { status: 400 },
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const input = Buffer.from(await file.arrayBuffer());
    const normalized = normalizeUploadImage(input);
    if (!normalized) {
      if (looksLikeHeicOrHeif(input)) {
        return NextResponse.json(
          {
            error:
              "Ảnh HEIC/HEIF (thường từ iPhone). Hãy đổi sang JPG/PNG trong Ảnh rồi upload lại, hoặc chụp/chọn định dạng tương thích.",
            code: "HEIC",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error:
            "Không đọc được ảnh. Hãy gửi JPG, PNG, WebP hoặc GIF (file hỏng hoặc không phải ảnh).",
          code: "BAD_FORMAT",
        },
        { status: 400 },
      );
    }

    const name = `${randomUUID()}${normalized.ext}`;
    await writeFile(path.join(uploadDir, name), normalized.buffer);

    const publicUrl = `/uploads/${name}`;
    const payload = await setWallpaperUrl(publicUrl);

    void import("@/lib/generateWallComposite")
      .then((m) => m.regenerateWallComposite())
      .catch((e) => console.error("[wallpaper] wall composite", e));

    return NextResponse.json({ url: publicUrl, ...payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    console.error("[wallpaper POST]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Bỏ wallpaper (xóa file trên đĩa nếu là `/uploads/...`). */
export async function DELETE(request: Request) {
  const denied = rejectWithoutUploadToken(request);
  if (denied) return denied;
  try {
    const before = await readImages();
    const payload = await setWallpaperUrl(null);
    void import("@/lib/generateWallComposite")
      .then((m) => m.regenerateWallComposite())
      .catch((e) => console.error("[wallpaper DELETE] wall composite", e));
    return NextResponse.json({ ...payload, removed: before.wallpaperUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    console.error("[wallpaper DELETE]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
