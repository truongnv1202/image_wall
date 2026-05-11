import { NextResponse } from "next/server";

import { getExpectedUploadToken } from "@/lib/uploadPageToken";

/** Trả 401 nếu cần token mà header không khớp; ngược lại `null` (được phép). */
export function rejectWithoutUploadToken(request: Request): NextResponse | null {
  const expected = getExpectedUploadToken();
  if (expected === null) return null;
  if (request.headers.get("x-upload-token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
