/** Bỏ BOM, CR (Windows/.env), khoảng trắng đầu cuối. */
export function normalizeUploadTokenSegment(s: string): string {
  return s.replace(/^\uFEFF/, "").replace(/\r\n?/g, "").trim();
}

/**
 * Trang upload bí mật: `/upload/<token>`. Token = biến môi trường `UPLOAD_PAGE_TOKEN`
 * (production). Dev không cần .env: mặc định `dev-upload`.
 */
export function getExpectedUploadToken(): string | null {
  const raw = process.env.UPLOAD_PAGE_TOKEN;
  if (typeof raw === "string" && raw.length > 0) {
    const t = normalizeUploadTokenSegment(raw);
    if (t.length > 0) return t;
  }
  if (process.env.NODE_ENV === "development") return "dev-upload";
  return null;
}

export function uploadTokenMatches(segment: string): boolean {
  const expected = getExpectedUploadToken();
  return expected !== null && normalizeUploadTokenSegment(segment) === expected;
}
