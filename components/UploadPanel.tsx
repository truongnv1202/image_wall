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

  async function clearAllUploads() {
    if (
      !window.confirm(
        "Xóa toàn bộ ảnh đã upload trên đĩa và reset danh sách về ảnh mẫu? Hành động này không hoàn tác.",
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const headers: HeadersInit = {};
      if (apiUploadToken) headers["x-upload-token"] = apiUploadToken;
      const path =
        apiUploadToken != null && apiUploadToken.length > 0
          ? `/api/images?token=${encodeURIComponent(apiUploadToken)}`
          : "/api/images";
      const res = await fetch(path, { method: "DELETE", headers, cache: "no-store" });
      const raw = await res.text();
      let data = {} as { error?: string; images?: string[] };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (res.status === 401) {
          setStatus(
            "Không được phép (401): cần token upload giống khi gửi ảnh (UPLOAD_PAGE_TOKEN trên server).",
          );
          return;
        }
        setStatus(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : `Lỗi ${res.status}`,
        );
        return;
      }
      if (Array.isArray(data.images)) {
        await mutate("/api/images", { images: data.images } satisfies ImagesPayload, {
          revalidate: false,
        });
      }
      void mutate("/api/images");
      void mutate("/api/wall-composite");
      setStatus("Đã xóa ảnh upload và reset danh sách.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
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

      const uploadPath =
        apiUploadToken != null && apiUploadToken.length > 0
          ? `/api/upload?token=${encodeURIComponent(apiUploadToken)}`
          : "/api/upload";

      const res = await fetch(uploadPath, {
        method: "POST",
        body: fd,
        headers,
        cache: "no-store",
      });
      const raw = await res.text();
      const looksLikeHtml =
        /^\s*</.test(raw) && /<(html|head|body|!DOCTYPE)\b/i.test(raw.slice(0, 400));
      let data = {} as { error?: string; images?: string[] };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (res.status === 401) {
          setStatus(
            "Không được phép (401): token không khớp UPLOAD_PAGE_TOKEN trên server (kiểm tra .env / Docker, không có BOM hay dấu ngoặc kép thừa).",
          );
          return;
        }
        if (res.status === 413) {
          setStatus("File quá lớn (413): tăng client_max_body_size trên Nginx hoặc giảm kích thước ảnh.");
          return;
        }
        if (looksLikeHtml) {
          setStatus(
            `Server trả HTML (${res.status}) thay vì JSON — thường là 404 proxy/CDN hoặc app chưa deploy đúng route /api/upload. Kiểm tra URL và Nginx location /api/.`,
          );
          return;
        }
        const msg =
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : raw.length > 0 && raw.length < 500
              ? raw
              : `Upload thất bại (HTTP ${res.status})`;
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
      void mutate("/api/wall-composite");
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
      <div className="border-t border-zinc-800 pt-3">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-red-800/80 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-900/50 disabled:opacity-50"
          onClick={() => void clearAllUploads()}
        >
          Xóa hết ảnh đã upload
        </button>
        <p className="mt-2 text-xs text-zinc-500">
          Xóa mọi file trong <code className="text-zinc-400">public/uploads/</code>, đặt lại danh sách về ảnh mẫu
          (Picsum). Cần xác nhận trong hộp thoại.
        </p>
      </div>
    </div>
  );
}
