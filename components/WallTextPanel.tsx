"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import type { WallTextPayload } from "@/lib/wallTextStore";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json() as Promise<WallTextPayload>;
  });

const MAX_PHRASES = 24;
const MAX_LEN = 400;

type Props = { apiUploadToken: string };

export function WallTextPanel({ apiUploadToken }: Props) {
  const { data, error, isLoading, mutate } = useSWR<WallTextPayload>("/api/wall-text", fetcher);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [rotateSec, setRotateSec] = useState(60);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPhrases([...data.phrases]);
    setRotateSec(Math.round(data.rotateIntervalMs / 1000));
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
      const res = await fetch("/api/wall-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-upload-token": apiUploadToken,
        },
        body: JSON.stringify({ phrases: trimmed, rotateIntervalMs } satisfies WallTextPayload),
      });
      const body = (await res.json().catch(() => ({}))) as WallTextPayload & { error?: string };
      if (!res.ok) {
        setStatus(typeof body.error === "string" ? body.error : `Lỗi ${res.status}`);
        return;
      }
      await mutate(body, { revalidate: false });
      setStatus("Đã lưu cấu hình chữ.");
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
      <div className="font-medium text-zinc-100">Câu chữ trên tường</div>
      <p className="text-xs text-zinc-500">
        Mỗi dòng hiển thị: xuống dòng trong ô = phím Enter trong câu. Nhiều câu sẽ xoay vòng trên tường theo thời gian bên dưới (0 = chỉ câu đầu, không tự đổi).
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
        <span>Thời gian đổi câu (giây) — áp khi có từ 2 câu trở lên</span>
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

      <button
        type="button"
        disabled={saving}
        className="rounded-lg bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        onClick={() => void save()}
      >
        {saving ? "Đang lưu…" : "Lưu cấu hình chữ"}
      </button>
      {status ? <p className="text-xs text-zinc-400">{status}</p> : null}
    </div>
  );
}
