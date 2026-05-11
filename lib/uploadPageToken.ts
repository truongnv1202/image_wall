/** Bỏ BOM / khoảng trắng đầu cuối (.env đôi khi lưu UTF-8 BOM). */
function normalizeToken(s: string): string {
  return s.replace(/^\uFEFF/, "").trim();
}

/**
 * Trang upload bí mật: `/upload/<token>`. Token = biến môi trường `UPLOAD_PAGE_TOKEN`
 * (production). Dev không cần .env: mặc định `dev-upload`.
 */
export function getExpectedUploadToken(): string | null {
  const raw = process.env.UPLOAD_PAGE_TOKEN;
  if (typeof raw === "string" && raw.length > 0) {
    const t = normalizeToken(raw);
    if (t.length > 0) return t;
  }
  if (process.env.NODE_ENV === "development") return "dev-upload";
  return null;
}

export function uploadTokenMatches(segment: string): boolean {
  const expected = getExpectedUploadToken();
  return expected !== null && normalizeToken(segment) === expected;
}
