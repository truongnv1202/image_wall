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
  popupUrl?: string;
  images?: string[];
};

type OverlayUploadJson = {
  error?: string;
  ok?: boolean;
  layer?: string;
  width?: number;
  height?: number;
  file?: string;
  deleted?: boolean;
};

export function UploadPanel({ apiUploadToken }: UploadPanelProps) {
  const tileInputId = useId();
  const overlayAInputId = useId();
  const overlayBInputId = useId();
  const tileInputRef = useRef<HTMLInputElement>(null);
  const overlayAInputRef = useRef<HTMLInputElement>(null);
  const overlayBInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [overlayAFileName, setOverlayAFileName] = useState<string | null>(null);
  const [overlayBFileName, setOverlayBFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overlayABusy, setOverlayABusy] = useState(false);
  const [overlayBBusy, setOverlayBBusy] = useState(false);
  const [overlayADeleteBusy, setOverlayADeleteBusy] = useState(false);
  const [overlayBDeleteBusy, setOverlayBDeleteBusy] = useState(false);
  const [hint, setHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [overlayAHint, setOverlayAHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [overlayBHint, setOverlayBHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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
      const popupUrl = data.popupUrl ?? "";
      const n = Array.isArray(data.images) ? data.images.length : null;
      setHint({
        kind: "ok",
        text:
          url && popupUrl && n != null
            ? `Đã upload ${url} — popup 3:4 ${popupUrl} — ${n} URL trong pool.`
            : url && n != null
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

  async function submitOverlayLayer(layer: "a" | "b") {
    const token = apiUploadToken?.trim();
    const setHint = layer === "a" ? setOverlayAHint : setOverlayBHint;
    const setBusy = layer === "a" ? setOverlayABusy : setOverlayBBusy;
    const inputRef = layer === "a" ? overlayAInputRef : overlayBInputRef;
    const setFileLabel = layer === "a" ? setOverlayAFileName : setOverlayBFileName;

    if (!token) {
      setHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setHint({ kind: "err", text: "Chọn file lớp phủ (PNG/JPG/WebP/GIF)." });
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    fd.append("layer", layer);

    setBusy(true);
    setHint(null);
    try {
      const res = await fetch("/api/upload-wall-overlay", { method: "POST", body: fd });
      let data: OverlayUploadJson;
      try {
        data = (await res.json()) as OverlayUploadJson;
      } catch {
        setHint({ kind: "err", text: `HTTP ${res.status} — phản hồi không phải JSON.` });
        return;
      }
      if (!res.ok) {
        setHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      const w = data.width ?? "?";
      const h = data.height ?? "?";
      const name = data.file ?? (layer === "b" ? "wall-composite-B.png" : "wall-composite-A.png");
      setHint({
        kind: "ok",
        text: `Đã ghi data/wall-overlays/${name} (${w}×${h}px). Alpha giữ nguyên trong file.`,
      });
      if (inputRef.current) inputRef.current.value = "";
      setFileLabel(null);
    } catch (e) {
      setHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteOverlayLayer(layer: "a" | "b") {
    const token = apiUploadToken?.trim();
    const setHint = layer === "a" ? setOverlayAHint : setOverlayBHint;
    const setBusy = layer === "a" ? setOverlayADeleteBusy : setOverlayBDeleteBusy;
    if (!token) {
      setHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      const q = new URLSearchParams({ token, layer });
      const res = await fetch(`/api/upload-wall-overlay?${q}`, {
        method: "DELETE",
        headers: { "x-upload-token": token },
      });
      let data: OverlayUploadJson;
      try {
        data = (await res.json()) as OverlayUploadJson;
      } catch {
        setHint({ kind: "err", text: `HTTP ${res.status} — phản hồi không phải JSON.` });
        return;
      }
      if (!res.ok) {
        setHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      const deleted = data.deleted === true;
      setHint({
        kind: "ok",
        text: deleted
          ? `Đã xóa lớp phủ ${layer.toUpperCase()} (data/wall-overlays/wall-composite-${layer.toUpperCase()}.png).`
          : "Không còn file trên đĩa (đã coi như xóa xong).",
      });
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

      <div className="flex flex-col gap-4 border-t border-zinc-800 pt-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-400">
            Lớp phủ 1 — <code className="text-zinc-500">wall-composite-A.png</code> (dưới)
          </span>
          <p className="text-xs text-zinc-600">
            <code className="text-zinc-500">POST /api/upload-wall-overlay</code> với field{" "}
            <code className="text-zinc-500">layer=a</code> (mặc định). Trên <code className="text-zinc-500">/wall</code>{" "}
            hiển thị responsive, alpha từ file. <code className="text-zinc-500">DELETE ?layer=a&amp;token=…</code> để xóa.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={overlayAInputRef}
              id={overlayAInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              className="sr-only"
              onChange={() => {
                const f = overlayAInputRef.current?.files?.[0];
                setOverlayAFileName(f ? f.name : null);
                setOverlayAHint(null);
              }}
            />
            <label
              htmlFor={overlayAInputId}
              className="cursor-pointer rounded-lg border border-dashed border-amber-800/60 px-3 py-2 text-xs text-amber-100/90 hover:bg-zinc-800"
            >
              {overlayAFileName ? `Phủ 1: ${overlayAFileName}` : "Chọn file lớp phủ 1…"}
            </label>
            <button
              type="button"
              disabled={overlayABusy}
              className="rounded-lg border border-amber-700/80 bg-amber-950/50 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
              onClick={() => void submitOverlayLayer("a")}
            >
              {overlayABusy ? "Đang gửi…" : "Upload phủ 1"}
            </button>
            <button
              type="button"
              disabled={overlayADeleteBusy}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:border-rose-800/60 hover:bg-rose-950/30 hover:text-rose-200 disabled:opacity-50"
              onClick={() => void deleteOverlayLayer("a")}
            >
              {overlayADeleteBusy ? "Đang xóa…" : "Xóa phủ 1"}
            </button>
          </div>
          {overlayAHint ? (
            <p
              className={
                overlayAHint.kind === "ok"
                  ? "text-xs text-emerald-400/95"
                  : "text-xs text-rose-400/95"
              }
            >
              {overlayAHint.text}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-800/80 pt-3">
          <span className="text-xs font-medium text-zinc-400">
            Lớp phủ 2 — <code className="text-zinc-500">wall-composite-B.png</code> (trên phủ 1)
          </span>
          <p className="text-xs text-zinc-600">
            Cùng API với field <code className="text-zinc-500">layer=b</code>. Alpha giữ nguyên; trên tường nằm trên
            lớp 1. <code className="text-zinc-500">DELETE ?layer=b&amp;token=…</code> để gỡ.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={overlayBInputRef}
              id={overlayBInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              className="sr-only"
              onChange={() => {
                const f = overlayBInputRef.current?.files?.[0];
                setOverlayBFileName(f ? f.name : null);
                setOverlayBHint(null);
              }}
            />
            <label
              htmlFor={overlayBInputId}
              className="cursor-pointer rounded-lg border border-dashed border-sky-800/60 px-3 py-2 text-xs text-sky-100/90 hover:bg-zinc-800"
            >
              {overlayBFileName ? `Phủ 2: ${overlayBFileName}` : "Chọn file lớp phủ 2…"}
            </label>
            <button
              type="button"
              disabled={overlayBBusy}
              className="rounded-lg border border-sky-700/80 bg-sky-950/50 px-4 py-2 text-xs font-medium text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
              onClick={() => void submitOverlayLayer("b")}
            >
              {overlayBBusy ? "Đang gửi…" : "Upload phủ 2"}
            </button>
            <button
              type="button"
              disabled={overlayBDeleteBusy}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:border-rose-800/60 hover:bg-rose-950/30 hover:text-rose-200 disabled:opacity-50"
              onClick={() => void deleteOverlayLayer("b")}
            >
              {overlayBDeleteBusy ? "Đang xóa…" : "Xóa phủ 2"}
            </button>
          </div>
          {overlayBHint ? (
            <p
              className={
                overlayBHint.kind === "ok"
                  ? "text-xs text-emerald-400/95"
                  : "text-xs text-rose-400/95"
              }
            >
              {overlayBHint.text}
            </p>
          ) : null}
        </div>
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
              hint.kind === "ok" ? "text-xs text-emerald-400/95" : "text-xs text-rose-400/95"
            }
          >
            {hint.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
