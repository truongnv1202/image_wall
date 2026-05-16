"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import type { WallTextPayload } from "@/lib/wallTextStore";
import {
  WALL_GRAPHIC_BLEND_MODE_CHOICES,
  WALL_GRAPHIC_DEFAULT_BLEND,
  type WallGraphicBlendMode,
} from "@/lib/wallGraphicUrls";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<WallTextPayload>;
  });

const MAX_PHRASES = 24;
const MAX_LEN = 400;

const OVERLAY_BLEND_UI_EXCLUDE = new Set([
  "inherit",
  "initial",
  "revert",
  "revert-layer",
  "unset",
]);
const OVERLAY_BLEND_OPTIONS = WALL_GRAPHIC_BLEND_MODE_CHOICES.filter(
  (m) => !OVERLAY_BLEND_UI_EXCLUDE.has(m),
) as readonly WallGraphicBlendMode[];

type Props = { apiUploadToken: string };

export function WallTextPanel({ apiUploadToken }: Props) {
  const { data, error, isLoading, mutate } = useSWR<WallTextPayload>("/api/wall-text", fetcher);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [rotateSec, setRotateSec] = useState(60);
  const [crossfadeMs, setCrossfadeMs] = useState(800);
  const [gridCols, setGridCols] = useState(100);
  const [gridRows, setGridRows] = useState(60);
  const [gridTileWidthPx, setGridTileWidthPx] = useState(54);
  const [gridTileHeightPx, setGridTileHeightPx] = useState(72);
  const [overlayABlendMode, setOverlayABlendMode] = useState<WallGraphicBlendMode>(WALL_GRAPHIC_DEFAULT_BLEND);
  const [overlayAOpacityPct, setOverlayAOpacityPct] = useState(100);
  const [overlayBBlendMode, setOverlayBBlendMode] = useState<WallGraphicBlendMode>("normal");
  const [overlayBOpacityPct, setOverlayBOpacityPct] = useState(100);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhrases([...data.phrases]);
    setRotateSec(Math.round(data.rotateIntervalMs / 1000));
    setCrossfadeMs(data.phraseCrossfadeMs ?? 800);
    setGridCols(data.gridCols ?? 100);
    setGridRows(data.gridRows ?? 60);
    setGridTileWidthPx(data.gridTileWidthPx ?? 54);
    setGridTileHeightPx(data.gridTileHeightPx ?? 72);
    setOverlayABlendMode(data.graphicBlendMode ?? WALL_GRAPHIC_DEFAULT_BLEND);
    setOverlayAOpacityPct(Math.round((data.graphicOverlayOpacity ?? 1) * 100));
    setOverlayBBlendMode(data.overlayBBlendMode ?? "normal");
    setOverlayBOpacityPct(Math.round((data.overlayBOpacity ?? 1) * 100));
  }, [data]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const trimmed = phrases.map((p) => p.trim()).filter((p) => p.length > 0);
      if (trimmed.length === 0) {
        setStatus("Cần ít nhất một câu chữ.");
        setSaving(false);
        return;
      }
      const rotateIntervalMs = Math.max(0, Math.round(rotateSec * 1000));
      const phraseCrossfadeMs = Math.min(4000, Math.max(150, Math.round(Number(crossfadeMs)) || 800));
      const nextGridCols = Math.min(240, Math.max(10, Math.floor(Number(gridCols)) || 100));
      const nextGridRows = Math.min(140, Math.max(6, Math.floor(Number(gridRows)) || 60));
      const nextTileW = Math.min(256, Math.max(6, Math.floor(Number(gridTileWidthPx)) || 54));
      const nextTileH = Math.min(384, Math.max(8, Math.floor(Number(gridTileHeightPx)) || 72));
      const graphicBlendMode = overlayABlendMode;
      const graphicOverlayOpacity = Math.min(
        1,
        Math.max(0, (Number(overlayAOpacityPct) || 0) / 100),
      );
      const nextOverlayBOpacity = Math.min(1, Math.max(0, (Number(overlayBOpacityPct) || 0) / 100));
      const wallTextUrl = `/api/wall-text?token=${encodeURIComponent(apiUploadToken)}`;
      const res = await fetch(wallTextUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-upload-token": apiUploadToken,
        },
        body: JSON.stringify({
          phrases: trimmed,
          rotateIntervalMs,
          phraseCrossfadeMs,
          gridCols: nextGridCols,
          gridRows: nextGridRows,
          gridTileWidthPx: nextTileW,
          gridTileHeightPx: nextTileH,
          graphicBlendMode,
          graphicOverlayOpacity,
          overlayBBlendMode,
          overlayBOpacity: nextOverlayBOpacity,
        } satisfies WallTextPayload),
      });
      const body = (await res.json().catch(() => ({}))) as WallTextPayload & { error?: string };
      if (!res.ok) {
        setStatus(typeof body.error === "string" ? body.error : `Lỗi ${res.status}`);
        return;
      }
      await mutate(body, { revalidate: false });
      setStatus("Đã lưu cấu hình tường.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <p className="max-w-xl text-center text-sm text-red-400">Không tải được cấu hình chữ ({String(error)}).</p>
    );
  }

  if (isLoading && !data) {
    return <p className="text-sm text-zinc-500">Đang tải cấu hình chữ…</p>;
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Cấu hình tường</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Số ảnh theo chiều ngang</span>
          <input
            type="number"
            min={10}
            max={240}
            step={1}
            value={Number.isFinite(gridCols) ? gridCols : 100}
            onChange={(e) => setGridCols(Number(e.target.value))}
            className="max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Số ảnh theo chiều dọc</span>
          <input
            type="number"
            min={6}
            max={140}
            step={1}
            value={Number.isFinite(gridRows) ? gridRows : 60}
            onChange={(e) => setGridRows(Number(e.target.value))}
            className="max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Kích thước ô lưới — rộng (px, 6–256)</span>
          <input
            type="number"
            min={6}
            max={256}
            step={1}
            value={Number.isFinite(gridTileWidthPx) ? gridTileWidthPx : 54}
            onChange={(e) => setGridTileWidthPx(Number(e.target.value))}
            className="max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Kích thước ô lưới — cao (px, 8–384)</span>
          <input
            type="number"
            min={8}
            max={384}
            step={1}
            value={Number.isFinite(gridTileHeightPx) ? gridTileHeightPx : 72}
            onChange={(e) => setGridTileHeightPx(Number(e.target.value))}
            className="max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Mỗi ô trên tường hiện tại là{" "}
        <strong>
          {Number.isFinite(gridTileWidthPx) ? gridTileWidthPx : 54}×{Number.isFinite(gridTileHeightPx) ? gridTileHeightPx : 72}px
        </strong>
        ; nên giữ tỷ lệ gần 3×4 (dọc). Ảnh vừa khung, không kéo méo (có thể có viền đen nếu ảnh không đúng tỷ lệ). Thiếu ảnh so với số ô thì lặp theo thứ tự, ảnh mới vẫn ở đầu danh sách.
      </p>

      <div className="border-t border-zinc-800 pt-3 text-xs font-medium text-zinc-400">
        Lớp phủ A trên <code className="text-zinc-500">/wall</code>
      </div>
      <p className="text-xs text-zinc-500">
        Blend và độ mờ áp dụng lên <code className="text-zinc-400">wall-composite-A.png</code> (trên lưới ảnh). Alpha trong PNG vẫn có hiệu lực; opacity chỉnh thêm hệ số toàn lớp.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Blend mode lớp A (CSS)</span>
          <select
            value={overlayABlendMode}
            onChange={(e) => setOverlayABlendMode(e.target.value as WallGraphicBlendMode)}
            className="max-w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          >
            {OVERLAY_BLEND_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Opacity lớp A (0–100%)</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(overlayAOpacityPct) ? overlayAOpacityPct : 100}
            onChange={(e) => setOverlayAOpacityPct(Number(e.target.value))}
            className="max-w-full accent-amber-500"
          />
          <span className="text-zinc-500">{Number.isFinite(overlayAOpacityPct) ? overlayAOpacityPct : 100}%</span>
        </label>
      </div>

      <div className="border-t border-zinc-800/80 pt-3 text-xs font-medium text-zinc-400">
        Lớp phủ B trên <code className="text-zinc-500">/wall</code>
      </div>
      <p className="text-xs text-zinc-500">
        Blend và độ mờ áp dụng lên <code className="text-zinc-400">wall-composite-B.png</code> (trên lớp A). Alpha trong PNG vẫn có hiệu lực; opacity chỉnh thêm hệ số toàn lớp.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Blend mode lớp B (CSS)</span>
          <select
            value={overlayBBlendMode}
            onChange={(e) => setOverlayBBlendMode(e.target.value as WallGraphicBlendMode)}
            className="max-w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          >
            {OVERLAY_BLEND_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>Opacity lớp B (0–100%)</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Number.isFinite(overlayBOpacityPct) ? overlayBOpacityPct : 100}
            onChange={(e) => setOverlayBOpacityPct(Number(e.target.value))}
            className="max-w-full accent-sky-500"
          />
          <span className="text-zinc-500">{Number.isFinite(overlayBOpacityPct) ? overlayBOpacityPct : 100}%</span>
        </label>
      </div>

      <div className="border-t border-zinc-800 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Câu chữ (watermark giữa tường ảnh)
      </div>
      <p className="text-xs text-zinc-500">
        Trong một ô: Enter để tách nhiều dòng (ví dụ hai dòng lớn như mẫu). Nhiều ô câu: xoay vòng theo giây cấu hình; độ mờ khi đổi câu chỉnh millisecond bên dưới.
      </p>

      <div className="flex flex-col gap-2">
        {phrases.map((line, i) => (
          <div key={i} className="flex gap-2">
            <textarea
              value={line}
              maxLength={MAX_LEN}
              rows={3}
              className="min-h-[4.5rem] flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
              placeholder="Ví dụ: HÒA BÌNH (Enter) ĐẸP LẮM"
              onChange={(e) => {
                const v = e.target.value;
                setPhrases((prev) => prev.map((p, j) => (j === i ? v : p)));
              }}
            />
            <button
              type="button"
              className="shrink-0 self-start rounded-lg border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              onClick={() => setPhrases((prev) => prev.filter((_, j) => j !== i))}
            >
              Xóa
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="self-start rounded-lg border border-dashed border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        disabled={phrases.length >= MAX_PHRASES}
        onClick={() => setPhrases((prev) => [...prev, "Câu mới"])}
      >
        Thêm câu
      </button>

      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Thời gian hiển thị mỗi câu trước khi chuyển (giây) — 0 = không tự đổi</span>
        <input
          type="number"
          min={0}
          max={86400}
          step={1}
          value={Number.isFinite(rotateSec) ? rotateSec : 0}
          onChange={(e) => setRotateSec(Number(e.target.value))}
          className="max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Hiệu ứng chuyển câu — độ dài mờ dần (ms, 150–4000)</span>
        <input
          type="number"
          min={150}
          max={4000}
          step={50}
          value={Number.isFinite(crossfadeMs) ? crossfadeMs : 800}
          onChange={(e) => setCrossfadeMs(Number(e.target.value))}
          className="max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </label>

      <button
        type="button"
        disabled={saving}
        className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        onClick={() => void save()}
      >
        {saving ? "Đang lưu…" : "Lưu cấu hình"}
      </button>
      {status ? <p className="text-xs text-zinc-400">{status}</p> : null}
    </div>
  );
}
