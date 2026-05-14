"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

type UploadPanelProps = {
  /** Token gửi kèm `POST /api/upload` (field `token` / `uploadToken`). */
  apiUploadToken?: string;
};

type UploadJson = {
  error?: string;
  url?: string;
  images?: string[];
};

export function UploadPanel({ apiUploadToken }: UploadPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    const token = apiUploadToken?.trim();
    if (!token) {
      setHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setHint({ kind: "err", text: "Chọn một file ảnh (JPG/PNG/WebP/GIF)." });
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);

    setBusy(true);
    setHint(null);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      let data: UploadJson;
      try {
        data = (await res.json()) as UploadJson;
      } catch {
        setHint({ kind: "err", text: `HTTP ${res.status} — phản hồi không phải JSON.` });
        return;
      }
      if (!res.ok) {
        setHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      const url = data.url ?? "";
      const n = Array.isArray(data.images) ? data.images.length : null;
      setHint({
        kind: "ok",
        text:
          url && n != null
            ? `Đã upload ${url} — ${n} URL trong pool.`
            : url
              ? `Đã upload ${url}.`
              : "Upload thành công.",
      });
      if (inputRef.current) inputRef.current.value = "";
      setFileName(null);
    } catch (e) {
      setHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-[min(100vw,calc((100vh-10rem)*100/60))] flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Ảnh ô lưới tường</div>
      <p className="text-xs text-zinc-500">
        Gửi ảnh qua <code className="text-zinc-400">POST /api/upload</code> (multipart{" "}
        <code className="text-zinc-400">file</code> + <code className="text-zinc-400">token</code>) —{" "}
        <code className="text-zinc-400">/wall</code> polling <code className="text-zinc-400">GET /api/images</code>, ảnh
        mới hiệu ứng giữa màn rồi thu về góc.
      </p>

      <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <span className="text-xs font-medium text-zinc-400">Test API ngay trên trang</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            className="sr-only"
            onChange={() => {
              const f = inputRef.current?.files?.[0];
              setFileName(f ? f.name : null);
              setHint(null);
            }}
          />
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-lg border border-dashed border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {fileName ? `Đã chọn: ${fileName}` : "Chọn ảnh…"}
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => void submit()}
          >
            {busy ? "Đang upload…" : "Upload ảnh lên tường"}
          </button>
          <Link
            href="/wall"
            className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Mở /wall
          </Link>
        </div>
        {hint ? (
          <p
            className={
              hint.kind === "ok"
                ? "text-xs text-emerald-400/95"
                : "text-xs text-rose-400/95"
            }
          >
            {hint.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
