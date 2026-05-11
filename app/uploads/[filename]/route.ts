import { readFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Tên file do `crypto.randomUUID()` (RFC 4122 v4) + đuôi — chặn path traversal. */
const UPLOAD_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|gif|webp)$/i;

function contentTypeForName(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
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
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForName(filename),
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
