import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import type { ColorType } from "@/lib/types";
import { prependImage } from "@/lib/imageStore";

const ALLOWED: ColorType[] = ["color1", "color2", "color3", "bg"];

function isColorType(v: unknown): v is ColorType {
  return typeof v === "string" && (ALLOWED as string[]).includes(v);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const colorRaw = form.get("colorType");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!isColorType(colorRaw)) {
    return NextResponse.json({ error: "Invalid colorType" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".jpg";
  const safeExt = ext.match(/^\.[a-zA-Z0-9]+$/) ? ext : ".jpg";
  const name = `${randomUUID()}${safeExt}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, name), buffer);

  const publicUrl = `/uploads/${name}`;
  const pools = await prependImage(publicUrl, colorRaw);

  return NextResponse.json({ url: publicUrl, pools });
}
