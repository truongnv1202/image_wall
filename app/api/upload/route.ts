import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

import { prependImageUrl } from "@/lib/imageStore";
import { rejectWithoutUploadToken } from "@/lib/uploadAuth";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const denied = rejectWithoutUploadToken(request);
    if (denied) return denied;

    const form = await request.formData();
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
    let out: Buffer;
    try {
      out = await sharp(input).rotate().jpeg({ quality: 88 }).toBuffer();
    } catch {
      return NextResponse.json(
        {
          error:
            "Không đọc được ảnh. Hãy dùng JPG, PNG, WebP, GIF hoặc định dạng mà trình duyệt thường mở được (một số máy gửi HEIC cần đổi sang JPG trước).",
        },
        { status: 400 },
      );
    }

    const name = `${randomUUID()}.jpg`;
    await writeFile(path.join(uploadDir, name), out);

    const publicUrl = `/uploads/${name}`;
    const data = await prependImageUrl(publicUrl);

    return NextResponse.json({ url: publicUrl, images: data.images });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    const hint =
      code === "EACCES" || code === "EPERM"
        ? "Không ghi được trên đĩa (quyền thư mục data/uploads)."
        : message;
    console.error("[upload]", code || message, err);
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
