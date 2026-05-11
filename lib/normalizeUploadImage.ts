import { sniffImageExtension } from "@/lib/sniffImageFormat";

export type NormalizedUpload = { buffer: Buffer; ext: string };

/**
 * Ưu tiên sharp → JPEG (xoay EXIF). Nếu sharp lỗi / không load native → giữ buffer gốc
 * nếu nhận diện được JPEG/PNG/WebP/GIF.
 */
export async function normalizeUploadImage(input: Buffer): Promise<NormalizedUpload | null> {
  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const out = await sharp(input).rotate().jpeg({ quality: 88 }).toBuffer();
    return { buffer: out, ext: ".jpg" };
  } catch (e) {
    console.warn("[upload] sharp không dùng được, thử lưu nguyên buffer:", e);
  }

  const ext = sniffImageExtension(input);
  if (!ext) return null;
  return { buffer: input, ext };
}
