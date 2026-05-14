/** Payload `GET /api/images` — mảng URL ô lưới. `wallpaperUrl` luôn null (tương thích JSON cũ). */
export type ImagesPayload = {
  images: string[];
  wallpaperUrl: null;
};
