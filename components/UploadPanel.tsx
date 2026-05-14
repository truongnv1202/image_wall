"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useSWRConfig } from "swr";

import type { ImagesPayload } from "@/lib/types";

type UploadPanelProps = {
  /** Gửi kèm header `x-upload-token` — bắt buộc khi server có `UPLOAD_PAGE_TOKEN` (hoặc dev). */
  apiUploadToken?: string;
};

/**
 * Trang upload: chỉ wallpaper + gợi ý API.
 * Ảnh ô lưới dùng `POST /api/upload` (curl / tích hợp) — tường `/wall` vẫn polling + hero ảnh mới.
 */
export function UploadPanel({ apiUploadToken }: UploadPanelProps) {
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wallpaperFileRef = useRef<HTMLInputElement>(null);

  async function onWallpaperChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (apiUploadToken) {
        fd.set("uploadToken", apiUploadToken);
        fd.set("token", apiUploadToken);
      }
      const headers: HeadersInit = {};
      if (apiUploadToken) headers["x-upload-token"] = apiUploadToken;
      const wpPath =
        apiUploadToken != null && apiUploadToken.length > 0
          ? `/api/wallpaper?token=${encodeURIComponent(apiUploadToken)}`
          : "/api/wallpaper";
      const res = await fetch(wpPath, {
        method: "POST",
        body: fd,
        headers,
        cache: "no-store",
      });
      const raw = await res.text();
      let data = {} as {
        error?: string;
        images?: string[];
        wallpaperUrl?: string | null;
      };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : `Upload wallpaper lỗi (${res.status})`,
        );
        return;
      }
      if (Array.isArray(data.images)) {
        await mutate(
          "/api/images",
          {
            images: data.images,
            wallpaperUrl: data.wallpaperUrl ?? null,
          } satisfies ImagesPayload,
          { revalidate: false },
        );
        void mutate("/api/images");
      } else {
        await mutate("/api/images");
      }
      void mutate("/api/wall-composite");
      setStatus("Đã đặt wallpaper — /wall ưu tiên hiển thị ảnh này.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function clearWallpaper() {
    setBusy(true);
    setStatus(null);
    try {
      const headers: HeadersInit = {};
      if (apiUploadToken) headers["x-upload-token"] = apiUploadToken;
      const wpPath =
        apiUploadToken != null && apiUploadToken.length > 0
          ? `/api/wallpaper?token=${encodeURIComponent(apiUploadToken)}`
          : "/api/wallpaper";
      const res = await fetch(wpPath, { method: "DELETE", headers, cache: "no-store" });
      const raw = await res.text();
      let data = {} as { error?: string; images?: string[]; wallpaperUrl?: string | null };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : `Lỗi ${res.status}`);
        return;
      }
      if (Array.isArray(data.images)) {
        await mutate(
          "/api/images",
          {
            images: data.images,
            wallpaperUrl: data.wallpaperUrl ?? null,
          } satisfies ImagesPayload,
          { revalidate: false },
        );
      }
      void mutate("/api/images");
      void mutate("/api/wall-composite");
      setStatus("Đã gỡ wallpaper.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-[min(100vw,calc((100vh-10rem)*100/60))] flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Ảnh ô lưới tường</div>
      <p className="text-xs text-zinc-500">
        Không còn nút chọn file ở đây. Gửi ảnh qua <code className="text-zinc-400">POST /api/upload</code> (multipart{" "}
        <code className="text-zinc-400">file</code>, cùng token như trang này) — <code className="text-zinc-400">/wall</code>{" "}
        vẫn polling <code className="text-zinc-400">GET /api/images</code>, ảnh mới vẫn hiệu ứng giữa màn rồi thu về góc.
      </p>

      <div className="border-t border-zinc-800 pt-3">
        <div className="font-medium text-zinc-100">Wallpaper (nền /wall)</div>
        <p className="mt-1 text-xs text-zinc-500">
          <code className="text-zinc-400">POST /api/wallpaper</code> hoặc nút bên dưới.{" "}
          <code className="text-zinc-400">DELETE /api/wallpaper</code> để gỡ.
        </p>
        <input
          ref={wallpaperFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(ev) => void onWallpaperChange(ev)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            onClick={() => wallpaperFileRef.current?.click()}
          >
            {busy ? "Đang tải…" : "Upload wallpaper"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            onClick={() => void clearWallpaper()}
          >
            Gỡ wallpaper
          </button>
        </div>
      </div>

      {status ? <p className="text-zinc-400">{status}</p> : null}
    </div>
  );
}
