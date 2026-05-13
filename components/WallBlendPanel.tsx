"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import type { WallTextPayload } from "@/lib/wallTextStore";
import {
  WALL_GRAPHIC_BLEND_MODE_CHOICES,
  WALL_GRAPHIC_DEFAULT_BLEND,
  isWallGraphicBlendMode,
  type WallGraphicBlendMode,
} from "@/lib/wallGraphicUrls";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<WallTextPayload>;
  });

type Props = { apiUploadToken: string };

/**
 * Chỉnh `mix-blend-mode` cho ảnh overlay trên /wall; lưu qua POST /api/wall-text (cùng token upload).
 */
export function WallBlendPanel({ apiUploadToken }: Props) {
  const { data, error, isLoading, mutate } = useSWR<WallTextPayload>("/api/wall-text", fetcher);
  const [blend, setBlend] = useState<WallGraphicBlendMode>(WALL_GRAPHIC_DEFAULT_BLEND);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBlend(data.graphicBlendMode ?? WALL_GRAPHIC_DEFAULT_BLEND);
  }, [data]);

  async function saveBlend() {
    if (!data) {
      setStatus("Chưa tải được cấu hình — thử lại sau.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const wallTextUrl = `/api/wall-text?token=${encodeURIComponent(apiUploadToken)}`;
      const res = await fetch(wallTextUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-upload-token": apiUploadToken,
        },
        body: JSON.stringify({
          ...data,
          graphicBlendMode: blend,
        } satisfies WallTextPayload),
      });
      const body = (await res.json().catch(() => ({}))) as WallTextPayload & { error?: string };
      if (!res.ok) {
        setStatus(typeof body.error === "string" ? body.error : `Lỗi ${res.status}`);
        return;
      }
      await mutate(body, { revalidate: false });
      setStatus("Đã lưu blend; tường /wall cập nhật trong vài giây.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <p className="max-w-xl text-center text-sm text-red-400">Không tải được cấu hình ({String(error)}).</p>
    );
  }

  if (isLoading && !data) {
    return <p className="text-sm text-zinc-500">Đang tải cấu hình blend…</p>;
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Blend ảnh overlay (tường /wall)</div>
      <p className="text-xs text-zinc-500">
        CSS <code className="text-zinc-400">mix-blend-mode</code> cho lớp ảnh phủ giữa tường. Bấm lưu
        riêng — không cần mở khối cấu hình chữ bên dưới.
      </p>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        <span>Chế độ blend</span>
        <select
          value={blend}
          onChange={(e) => {
            const v = e.target.value;
            if (isWallGraphicBlendMode(v)) setBlend(v);
          }}
          className="max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        >
          {WALL_GRAPHIC_BLEND_MODE_CHOICES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={saving || !data}
        className="self-start rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        onClick={() => void saveBlend()}
      >
        {saving ? "Đang lưu…" : "Lưu blend"}
      </button>
      {status ? <p className="text-xs text-zinc-400">{status}</p> : null}
    </div>
  );
}
