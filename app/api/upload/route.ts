import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { prependImageUrl } from "@/lib/imageStore";
import { getExpectedUploadToken } from "@/lib/uploadPageToken";

export async function POST(request: Request) {
  const expected = getExpectedUploadToken();
  if (expected !== null) {
    const sent = request.headers.get("x-upload-token");
    if (sent !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".jpg";
  const safeExt = ext.match(/^\.[a-zA-Z0-9]+$/) ? ext : ".jpg";
  const name = `${randomUUID()}${safeExt}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, name), buffer);

  const publicUrl = `/uploads/${name}`;
  const data = await prependImageUrl(publicUrl);

  return NextResponse.json({ url: publicUrl, images: data.images });
}
