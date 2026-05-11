import { looksLikeHeicOrHeif, sniffImageExtension } from "@/lib/sniffImageFormat";

export type NormalizedUpload = { buffer: Buffer; ext: string };

/**
 * Lưu buffer gốc theo magic bytes (JPEG/PNG/WebP/GIF). Không dùng sharp — tránh lỗi native
 * trên Docker/OS và giảm điểm hỏng khi chuyển đổi.
 */
export function normalizeUploadImage(input: Buffer): NormalizedUpload | null {
  if (looksLikeHeicOrHeif(input)) return null;
  const ext = sniffImageExtension(input);
  if (!ext) return null;
  return { buffer: input, ext };
}
