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

type OverlayUploadJson = {
  error?: string;
  ok?: boolean;
  width?: number;
  height?: number;
  file?: string;
};

export function UploadPanel({ apiUploadToken }: UploadPanelProps) {
  const tileInputId = useId();
  const overlayInputId = useId();
  const tileInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [overlayFileName, setOverlayFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overlayBusy, setOverlayBusy] = useState(false);
  const [hint, setHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [overlayHint, setOverlayHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    const token = apiUploadToken?.trim();
    if (!token) {
      setHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    const file = tileInputRef.current?.files?.[0];
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
      if (tileInputRef.current) tileInputRef.current.value = "";
      setFileName(null);
    } catch (e) {
      setHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setBusy(false);
    }
  }

  async function submitOverlay() {
    const token = apiUploadToken?.trim();
    if (!token) {
      setOverlayHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    const file = overlayInputRef.current?.files?.[0];
    if (!file) {
      setOverlayHint({ kind: "err", text: "Chọn file lớp phủ (PNG/JPG/WebP/GIF)." });
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);

    setOverlayBusy(true);
    setOverlayHint(null);
    try {
      const res = await fetch("/api/upload-wall-overlay", { method: "POST", body: fd });
      let data: OverlayUploadJson;
      try {
        data = (await res.json()) as OverlayUploadJson;
      } catch {
        setOverlayHint({ kind: "err", text: `HTTP ${res.status} — phản hồi không phải JSON.` });
        return;
      }
      if (!res.ok) {
        setOverlayHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      const w = data.width ?? "?";
      const h = data.height ?? "?";
      setOverlayHint({
        kind: "ok",
        text: `Đã ghi data/wall-overlays/wall-composite-A.png (${w}×${h}px). Blend theo wall-text; độ mờ theo alpha file.`,
      });
      if (overlayInputRef.current) overlayInputRef.current.value = "";
      setOverlayFileName(null);
    } catch (e) {
      setOverlayHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setOverlayBusy(false);
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
        <span className="text-xs font-medium text-zinc-400">Lớp phủ ghép tường (`wall-composite-A.png`)</span>
        <p className="text-xs text-zinc-600">
          <code className="text-zinc-500">POST /api/upload-wall-overlay</code> — ghi{" "}
          <code className="text-zinc-500">data/wall-overlays/wall-composite-A.png</code> (tránh volume{" "}
          <code className="text-zinc-500">public/wall-overlays</code> chỉ đọc trong Docker). Ghép tường đọc file này{" "}
          <strong className="text-zinc-400">trước</strong> bản trong thư mục overlay image. File giữ nguyên width×height pixel khi lưu.{" "}
          <strong className="text-zinc-400">Không</strong> sửa kích thước khung ghép trong{" "}
          <code className="text-zinc-500">wall-text.json</code>. Độ mờ lớp phủ chỉ do{" "}
          <strong>alpha ảnh upload</strong> — không chỉnh qua cấu hình.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={overlayInputRef}
            id={overlayInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            className="sr-only"
            onChange={() => {
              const f = overlayInputRef.current?.files?.[0];
              setOverlayFileName(f ? f.name : null);
              setOverlayHint(null);
            }}
          />
          <label
            htmlFor={overlayInputId}
            className="cursor-pointer rounded-lg border border-dashed border-amber-800/60 px-3 py-2 text-xs text-amber-100/90 hover:bg-zinc-800"
          >
            {overlayFileName ? `Lớp phủ: ${overlayFileName}` : "Chọn file lớp phủ…"}
          </label>
          <button
            type="button"
            disabled={overlayBusy}
            className="rounded-lg border border-amber-700/80 bg-amber-950/50 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
            onClick={() => void submitOverlay()}
          >
            {overlayBusy ? "Đang gửi…" : "Upload lớp phủ"}
          </button>
        </div>
        {overlayHint ? (
          <p
            className={
              overlayHint.kind === "ok"
                ? "text-xs text-emerald-400/95"
                : "text-xs text-rose-400/95"
            }
          >
            {overlayHint.text}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <span className="text-xs font-medium text-zinc-400">Test API ô lưới</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={tileInputRef}
            id={tileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            className="sr-only"
            onChange={() => {
              const f = tileInputRef.current?.files?.[0];
              setFileName(f ? f.name : null);
              setHint(null);
            }}
          />
          <label
            htmlFor={tileInputId}
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
