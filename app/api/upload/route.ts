import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { prependImageUrl } from "@/lib/imageStore";
import { rejectWithoutUploadToken } from "@/lib/uploadAuth";

export async function POST(request: Request) {
  try {
    const denied = rejectWithoutUploadToken(request);
    if (denied) return denied;

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const rawName = file instanceof File ? file.name : "upload";
    const ext = path.extname(rawName) || ".jpg";
    const safeExt = ext.match(/^\.[a-zA-Z0-9]+$/) ? ext : ".jpg";
    const name = `${randomUUID()}${safeExt}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, name), buffer);

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
