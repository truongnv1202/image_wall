/** Payload `GET /api/images` — mảng URL ô lưới + wallpaper full khung (tùy chọn). */
export type ImagesPayload = {
  images: string[];
  /** Ảnh nền toàn khung từ upload (`/uploads/...`). Có giá trị thì `/wall` ưu tiên hiển thị. */
  wallpaperUrl: string | null;
};
