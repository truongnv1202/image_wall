import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { prependImageUrl } from "@/lib/imageStore";
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
    const data = await prependImageUrl(publicUrl);

    return NextResponse.json({ url: publicUrl, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    const hint =
      code === "EACCES" || code === "EPERM"
        ? "Không ghi được trên đĩa (quyền thư mục /app/data hoặc /app/public/uploads)."
        : message;
    console.error("[upload]", code || message, err);
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
