/**
 * Trang upload bí mật: `/upload/<token>`. Token = biến môi trường `UPLOAD_PAGE_TOKEN`
 * (production). Dev không cần .env: mặc định `dev-upload`.
 */
export function getExpectedUploadToken(): string | null {
  const fromEnv = process.env.UPLOAD_PAGE_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") return "dev-upload";
  return null;
}

export function uploadTokenMatches(segment: string): boolean {
  const expected = getExpectedUploadToken();
  return expected !== null && segment === expected;
}
