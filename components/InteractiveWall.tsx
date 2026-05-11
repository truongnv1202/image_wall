"use client";

import { useMemo, useState } from "react";

import { PhotoWall } from "@/components/PhotoWall";

const PRESETS = [
  "HÒA BÌNH ĐẸP LẮM",
  "GIỮ LẤY BÌNH YÊN",
  "VÌ NƯỚC QUÊN THÂN, VÌ DÂN PHỤC VỤ",
] as const;

export function InteractiveWall() {
  const [text, setText] = useState<string>(PRESETS[0]);

  const presetValue = useMemo(() => {
    const hit = PRESETS.find((p) => p === text);
    return hit ?? "";
  }, [text]);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      <div className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-left text-sm">
          <span className="text-zinc-400">Dòng chữ trên tường</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="resize-y rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
            placeholder="Nhập dòng chữ (tiếng Việt có dấu)"
          />
        </label>
        <label className="flex w-full flex-col gap-1 text-sm sm:w-56">
          <span className="text-zinc-400">Gợi ý nhanh</span>
          <select
            className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={presetValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setText(v);
            }}
          >
            <option value="">— Chọn câu có sẵn —</option>
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p.length > 42 ? `${p.slice(0, 40)}…` : p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PhotoWall text={text} />
    </div>
  );
}
