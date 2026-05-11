"use client";

import { useState, type ChangeEvent } from "react";
import { useSWRConfig } from "swr";

import type { ImagesPayload } from "@/lib/types";

type UploadPanelProps = {
  /** Gửi kèm header `x-upload-token` — bắt buộc khi server có `UPLOAD_PAGE_TOKEN` (hoặc dev). */
  apiUploadToken?: string;
};

export function UploadPanel({ apiUploadToken }: UploadPanelProps) {
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const headers: HeadersInit = {};
      if (apiUploadToken) headers["x-upload-token"] = apiUploadToken;
      const res = await fetch("/api/upload", { method: "POST", body: fd, headers });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        images?: string[];
      };
      if (!res.ok) {
        const msg =
          typeof data.error === "string" ? data.error : `Upload thất bại (HTTP ${res.status})`;
        setStatus(msg);
        return;
      }
      if (Array.isArray(data.images)) {
        await mutate("/api/images", { images: data.images } satisfies ImagesPayload, {
          revalidate: false,
        });
        /* Đồng bộ lại từ server — tránh cache lệch khiến tường không thấy ảnh mới. */
        void mutate("/api/images");
      } else {
        await mutate("/api/images");
      }
      setStatus("Đã thêm ảnh lên đầu tường.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex w-full max-w-[min(100vw,calc((100vh-10rem)*100/60))] flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Gửi ảnh lên tường</div>
      <p className="text-xs text-zinc-500">
        Ảnh được chèn vào đầu mảng; lưới cập nhật ngay và qua polling ~{4}s.
      </p>
      <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
        {busy ? "Đang tải…" : "Chọn ảnh"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={onChange}
        />
      </label>
      {status ? <p className="text-zinc-400">{status}</p> : null}
    </div>
  );
}
