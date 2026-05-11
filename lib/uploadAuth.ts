import { NextResponse } from "next/server";

import { getExpectedUploadToken } from "@/lib/uploadPageToken";

/**
 * Trả 401 nếu cần token mà không khớp.
 * Thứ tự ưu tiên: header `x-upload-token` | query `?token=` | field form (truyền qua `bodyToken`).
 * Một số CDN/proxy chặn header lạ — query + form vẫn qua được.
 */
export function rejectWithoutUploadToken(
  request: Request,
  bodyToken?: string | null,
): NextResponse | null {
  const expected = getExpectedUploadToken();
  if (expected === null) return null;
  const header = request.headers.get("x-upload-token")?.trim() ?? "";
  const body = (bodyToken ?? "").trim();
  let query = "";
  try {
    query = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  } catch {
    query = "";
  }
  if (header === expected || body === expected || query === expected) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
