import { NextResponse } from "next/server";

import { getExpectedUploadToken } from "@/lib/uploadPageToken";

/**
 * Trả 401 nếu cần token mà không khớp.
 * Chấp nhận `x-upload-token` (header) hoặc `bodyToken` (field form / JSON) — một số proxy bỏ header lạ.
 */
export function rejectWithoutUploadToken(
  request: Request,
  bodyToken?: string | null,
): NextResponse | null {
  const expected = getExpectedUploadToken();
  if (expected === null) return null;
  const header = request.headers.get("x-upload-token")?.trim() ?? "";
  const body = (bodyToken ?? "").trim();
  if (header === expected || body === expected) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
