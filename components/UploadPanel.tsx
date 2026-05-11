"use client";

import { useState, type ChangeEvent } from "react";

import type { ColorType } from "@/lib/types";

const OPTIONS: { value: ColorType; label: string }[] = [
  { value: "color1", label: "Chữ — tông 1 (đỏ/cam)" },
  { value: "color2", label: "Chữ — tông 2 (vàng)" },
  { value: "color3", label: "Chữ — tông 3 (sáng/trắng)" },
  { value: "bg", label: "Nền" },
];

export function UploadPanel() {
  const [colorType, setColorType] = useState<ColorType>("color1");
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
      fd.set("colorType", colorType);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(typeof data.error === "string" ? data.error : "Upload thất bại");
        return;
      }
      setStatus("Đã thêm ảnh — tường sẽ cập nhật khi polling lấy pools mới.");
    } catch {
      setStatus("Lỗi mạng");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Thử upload (API)</div>
      <label className="flex flex-col gap-1">
        <span className="text-zinc-400">Loại màu / pool</span>
        <select
          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2"
          value={colorType}
          onChange={(e) => setColorType(e.target.value as ColorType)}
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
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
