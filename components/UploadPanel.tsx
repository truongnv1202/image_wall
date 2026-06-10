"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type UploadPanelProps = {
  /** Token gửi kèm `POST /api/upload` (field `token` / `uploadToken`). */
  apiUploadToken?: string;
};

type UploadJson = {
  error?: string;
  ok?: boolean;
  url?: string;
  popupUrl?: string;
  images?: string[];
  deletedFiles?: number;
  failedFiles?: number;
};

type OverlayUploadJson = {
  error?: string;
  ok?: boolean;
  setId?: string;
  activeSetId?: string;
  sets?: OverlaySet[];
  layer?: string;
  width?: number;
  height?: number;
  file?: string;
  deleted?: boolean;
  deletedFiles?: number;
};

type OverlaySet = {
  id: string;
  label: string;
  active: boolean;
  aExists: boolean;
  bExists: boolean;
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
  const [overlaySets, setOverlaySets] = useState<OverlaySet[]>([]);
  const [activeOverlaySetId, setActiveOverlaySetId] = useState("default");
  const [busy, setBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [overlaySetBusy, setOverlaySetBusy] = useState(false);
  const [overlayABusy, setOverlayABusy] = useState(false);
  const [overlayBBusy, setOverlayBBusy] = useState(false);
  const [overlayADeleteBusy, setOverlayADeleteBusy] = useState(false);
  const [overlayBDeleteBusy, setOverlayBDeleteBusy] = useState(false);
  const [hint, setHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [overlaySetHint, setOverlaySetHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [overlayAHint, setOverlayAHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [overlayBHint, setOverlayBHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function applyOverlaySets(data: OverlayUploadJson) {
    if (!Array.isArray(data.sets)) return;
    setOverlaySets(data.sets);
    if (typeof data.activeSetId === "string" && data.activeSetId.length > 0) {
      setActiveOverlaySetId(data.activeSetId);
    }
  }

  async function refreshOverlaySets() {
    const token = apiUploadToken?.trim();
    if (!token) return;
    try {
      const q = new URLSearchParams({ token });
      const res = await fetch(`/api/wall-overlay-sets?${q}`, {
        headers: { "x-upload-token": token },
      });
      if (!res.ok) return;
      applyOverlaySets((await res.json()) as OverlayUploadJson);
    } catch {
      /* Không chặn form upload nếu endpoint quản lý bộ phủ tạm lỗi. */
    }
  }

  useEffect(() => {
    void refreshOverlaySets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUploadToken]);

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

  async function deleteOldUploads() {
    const token = apiUploadToken?.trim();
    if (!token) {
      setHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    const confirmed = window.confirm(
      "Xóa toàn bộ ảnh đã upload khỏi tường? Thao tác này không thể hoàn tác.",
    );
    if (!confirmed) return;

    setCleanupBusy(true);
    setHint(null);
    try {
      const q = new URLSearchParams({ token });
      const res = await fetch(`/api/images?${q}`, {
        method: "DELETE",
        headers: { "x-upload-token": token },
      });
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
      const deleted = data.deletedFiles ?? 0;
      const failed = data.failedFiles ?? 0;
      const n = Array.isArray(data.images) ? data.images.length : null;
      setHint({
        kind: failed > 0 ? "err" : "ok",
        text:
          failed > 0
            ? `Đã xóa ${deleted} file, ${failed} file lỗi. Pool hiện còn ${n ?? "?"} URL.`
            : `Đã xóa ${deleted} file upload cũ. Pool đã reset${n != null ? ` về ${n} URL mẫu` : ""}.`,
      });
    } catch (e) {
      setHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setCleanupBusy(false);
    }
  }

  async function createOverlaySet() {
    const token = apiUploadToken?.trim();
    if (!token) {
      setOverlaySetHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    setOverlaySetBusy(true);
    setOverlaySetHint(null);
    try {
      const q = new URLSearchParams({ token });
      const label = `Bộ phủ ${overlaySets.length + 1}`;
      const res = await fetch(`/api/wall-overlay-sets?${q}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-upload-token": token,
        },
        body: JSON.stringify({ action: "create", label }),
      });
      const data = (await res.json()) as OverlayUploadJson;
      if (!res.ok) {
        setOverlaySetHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      applyOverlaySets(data);
      setOverlaySetHint({ kind: "ok", text: "Đã tạo bộ lớp phủ mới. Hãy upload lớp A và lớp B cho bộ này." });
      setOverlayAHint(null);
      setOverlayBHint(null);
    } catch (e) {
      setOverlaySetHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setOverlaySetBusy(false);
    }
  }

  async function selectOverlaySet(id: string) {
    const token = apiUploadToken?.trim();
    if (!token) {
      setOverlaySetHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    setOverlaySetBusy(true);
    setOverlaySetHint(null);
    try {
      const q = new URLSearchParams({ token });
      const res = await fetch(`/api/wall-overlay-sets?${q}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-upload-token": token,
        },
        body: JSON.stringify({ action: "select", id }),
      });
      const data = (await res.json()) as OverlayUploadJson;
      if (!res.ok) {
        setOverlaySetHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      applyOverlaySets(data);
      setOverlaySetHint({ kind: "ok", text: "Đã chuyển bộ lớp phủ đang hiển thị trên /wall." });
      setOverlayAHint(null);
      setOverlayBHint(null);
    } catch (e) {
      setOverlaySetHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setOverlaySetBusy(false);
    }
  }

  async function deleteActiveOverlaySet() {
    const token = apiUploadToken?.trim();
    if (!token) {
      setOverlaySetHint({ kind: "err", text: "Thiếu token — chỉ dùng trang /upload/<token>." });
      return;
    }
    const current = overlaySets.find((s) => s.id === activeOverlaySetId);
    const label = current?.label ?? activeOverlaySetId;
    const confirmed = window.confirm(
      `Xóa bộ lớp phủ "${label}"? Thao tác này sẽ xóa cả lớp A và lớp B của bộ này.`,
    );
    if (!confirmed) return;

    setOverlaySetBusy(true);
    setOverlaySetHint(null);
    try {
      const q = new URLSearchParams({ token, id: activeOverlaySetId });
      const res = await fetch(`/api/wall-overlay-sets?${q}`, {
        method: "DELETE",
        headers: { "x-upload-token": token },
      });
      const data = (await res.json()) as OverlayUploadJson;
      if (!res.ok) {
        setOverlaySetHint({ kind: "err", text: data.error || `HTTP ${res.status}` });
        return;
      }
      applyOverlaySets(data);
      setOverlaySetHint({
        kind: "ok",
        text: `Đã xóa bộ lớp phủ "${label}" (${data.deletedFiles ?? 0} file).`,
      });
      setOverlayAHint(null);
      setOverlayBHint(null);
    } catch (e) {
      setOverlaySetHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setOverlaySetBusy(false);
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
    fd.append("setId", activeOverlaySetId);

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
        text: `Đã ghi ${name} vào bộ phủ đang chọn (${w}×${h}px). Alpha giữ nguyên trong file.`,
      });
      await refreshOverlaySets();
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
      const q = new URLSearchParams({ token, layer, setId: activeOverlaySetId });
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
          ? `Đã xóa lớp ${layer.toUpperCase()} trong bộ phủ đang chọn.`
          : "Không còn file trên đĩa (đã coi như xóa xong).",
      });
      await refreshOverlaySets();
    } catch (e) {
      setHint({ kind: "err", text: e instanceof Error ? e.message : "Lỗi mạng" });
    } finally {
      setBusy(false);
    }
  }

  const activeOverlaySet = overlaySets.find((s) => s.id === activeOverlaySetId);

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
          <span className="text-xs font-medium text-zinc-400">Bộ lớp phủ đang dùng</span>
          <p className="text-xs text-zinc-600">
            Mỗi bộ lớp phủ gồm 2 lớp: <code className="text-zinc-500">A</code> (dưới) và{" "}
            <code className="text-zinc-500">B</code> (trên). Tạo bộ mới để thay overlay mà không ghi đè bộ cũ.
            Trên <code className="text-zinc-500">/wall</code>, các bộ đã đủ A+B sẽ được đổi ngẫu nhiên mỗi 60 giây.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeOverlaySetId}
              disabled={overlaySetBusy}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 disabled:opacity-50"
              onChange={(e) => void selectOverlaySet(e.currentTarget.value)}
            >
              {overlaySets.length > 0 ? (
                overlaySets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.label} ({set.aExists ? "A" : "chưa A"}/{set.bExists ? "B" : "chưa B"})
                  </option>
                ))
              ) : (
                <option value="default">Bộ mặc định</option>
              )}
            </select>
            <button
              type="button"
              disabled={overlaySetBusy}
              className="rounded-lg border border-emerald-700/80 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-900/40 disabled:opacity-50"
              onClick={() => void createOverlaySet()}
            >
              {overlaySetBusy ? "Đang xử lý…" : "Tạo bộ phủ mới"}
            </button>
            <button
              type="button"
              disabled={overlaySetBusy}
              className="rounded-lg border border-rose-800/70 px-3 py-2 text-xs text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
              onClick={() => void deleteActiveOverlaySet()}
            >
              Xóa bộ đang chọn (A+B)
            </button>
          </div>
          <p className="text-xs text-zinc-600">
            Đang chọn: <code className="text-zinc-400">{activeOverlaySet?.label ?? "Bộ mặc định"}</code>
          </p>
          {overlaySetHint ? (
            <p
              className={
                overlaySetHint.kind === "ok"
                  ? "text-xs text-emerald-400/95"
                  : "text-xs text-rose-400/95"
              }
            >
              {overlaySetHint.text}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-400">
            Lớp A — <code className="text-zinc-500">wall-composite-A.png</code> (dưới)
          </span>
          <p className="text-xs text-zinc-600">
            <code className="text-zinc-500">POST /api/upload-wall-overlay</code> với field{" "}
            <code className="text-zinc-500">layer=a</code> (mặc định). Trên <code className="text-zinc-500">/wall</code>{" "}
            hiển thị responsive, alpha từ file. Xóa lớp A chỉ gỡ file A trong bộ đang chọn.
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
              {overlayAFileName ? `Lớp A: ${overlayAFileName}` : "Chọn file lớp A…"}
            </label>
            <button
              type="button"
              disabled={overlayABusy}
              className="rounded-lg border border-amber-700/80 bg-amber-950/50 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
              onClick={() => void submitOverlayLayer("a")}
            >
              {overlayABusy ? "Đang gửi…" : "Upload lớp A"}
            </button>
            <button
              type="button"
              disabled={overlayADeleteBusy}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:border-rose-800/60 hover:bg-rose-950/30 hover:text-rose-200 disabled:opacity-50"
              onClick={() => void deleteOverlayLayer("a")}
            >
              {overlayADeleteBusy ? "Đang xóa…" : "Xóa lớp A"}
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
            Lớp B — <code className="text-zinc-500">wall-composite-B.png</code> (trên lớp A)
          </span>
          <p className="text-xs text-zinc-600">
            Cùng API với field <code className="text-zinc-500">layer=b</code>. Alpha giữ nguyên; trên tường nằm trên
            lớp A. Xóa lớp B chỉ gỡ file B trong bộ đang chọn.
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
              {overlayBFileName ? `Lớp B: ${overlayBFileName}` : "Chọn file lớp B…"}
            </label>
            <button
              type="button"
              disabled={overlayBBusy}
              className="rounded-lg border border-sky-700/80 bg-sky-950/50 px-4 py-2 text-xs font-medium text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
              onClick={() => void submitOverlayLayer("b")}
            >
              {overlayBBusy ? "Đang gửi…" : "Upload lớp B"}
            </button>
            <button
              type="button"
              disabled={overlayBDeleteBusy}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-400 hover:border-rose-800/60 hover:bg-rose-950/30 hover:text-rose-200 disabled:opacity-50"
              onClick={() => void deleteOverlayLayer("b")}
            >
              {overlayBDeleteBusy ? "Đang xóa…" : "Xóa lớp B"}
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
            disabled={busy || cleanupBusy}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => void submit()}
          >
            {busy ? "Đang upload…" : "Upload ảnh lên tường"}
          </button>
          <button
            type="button"
            disabled={cleanupBusy || busy}
            className="rounded-lg border border-rose-800/70 px-3 py-2 text-xs text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
            onClick={() => void deleteOldUploads()}
          >
            {cleanupBusy ? "Đang xóa…" : "Xóa ảnh cũ"}
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
