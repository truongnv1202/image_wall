import { readFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { ensureWallUploadTileOnDisk } from "@/lib/wallUploadTile";

export const runtime = "nodejs";
const UPLOAD_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:-popup)?\.(?:jpe?g|png|gif|webp)$/i;

function contentTypeForName(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/** Ưu tiên magic bytes (sau khi file có thể đã ghi đè JPEG nhưng đuôi .png). */
function contentTypeForBuffer(buf: Buffer, filename: string): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "image/gif";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return contentTypeForName(filename);
}

/**
 * Phục vụ ảnh upload từ đĩa. Trong production, file thêm vào `public/uploads` sau build
 * thường không được Next phục vụ như static — route này đọc trực tiếp từ filesystem.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await context.params;
  if (!filename || !UPLOAD_NAME.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const filePath = path.resolve(uploadsRoot, filename);
  const rel = path.relative(uploadsRoot, filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    if (!/-popup\./i.test(filename)) {
      await ensureWallUploadTileOnDisk(filePath);
    }
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForBuffer(buf, filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "ENOENT") return new NextResponse("Not found", { status: 404 });
    console.error("[uploads/serve]", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
