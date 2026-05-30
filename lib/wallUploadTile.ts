import { promises as fs } from "fs";

import sharp from "sharp";

/** Kích thước chuẩn ảnh tường sau upload / khi đưa vào lưới (3:4). */
export const WALL_UPLOAD_TILE_W = 300;
export const WALL_UPLOAD_TILE_H = 400;

/** Bản popup riêng: 9:16, đủ nét cho màn hình lớn/HiDPI. */
export const WALL_UPLOAD_POPUP_W = 2160;
export const WALL_UPLOAD_POPUP_H = 3840;

/**
 * Decode + EXIF rotate, crop cover căn giữa, xuất JPEG.
 */
export async function wallUploadBufferToJpeg300x400(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input)
      .rotate()
      .resize(WALL_UPLOAD_TILE_W, WALL_UPLOAD_TILE_H, { fit: "cover", position: "centre" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Bản hero popup: crop cover 9:16, JPEG quality tối đa để tránh vỡ ảnh khi phóng lớn.
 */
export async function wallUploadBufferToPopupJpeg9x16(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input)
      .rotate()
      .resize(WALL_UPLOAD_POPUP_W, WALL_UPLOAD_POPUP_H, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.8, m1: 1.2, m2: 0.8 })
      .jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Nếu file trên đĩa chưa đúng 300×400 JPEG, ghi đè bằng bản resize (cùng đường dẫn → URL trong JSON không đổi).
 * Ảnh lớn cũ bị thay thế nội dung, không giữ bản gốc.
 */
export async function ensureWallUploadTileOnDisk(absPath: string): Promise<void> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(absPath);
  } catch {
    return;
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return;
  }

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const fmt = meta.format;
  const already = fmt === "jpeg" && w === WALL_UPLOAD_TILE_W && h === WALL_UPLOAD_TILE_H;
  if (already) return;

  const out = await wallUploadBufferToJpeg300x400(buf);
  if (!out) {
    console.warn("[wallUploadTile] không resize được:", absPath);
    return;
  }

  await fs.writeFile(absPath, out);
  console.info("[wallUploadTile] đã chuẩn hóa 300×400 JPEG (ghi đè):", absPath);
}
