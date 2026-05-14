"use client";

type UploadPanelProps = {
  /** Giữ prop cho trang `/upload/[token]` (token gửi kèm `POST /api/upload`). */
  apiUploadToken?: string;
};

/**
 * Trang upload: gợi ý API — ảnh ô lưới qua `POST /api/upload` (curl / tích hợp).
 */
export function UploadPanel({ apiUploadToken: _apiUploadToken }: UploadPanelProps) {
  return (
    <div className="flex w-full max-w-[min(100vw,calc((100vh-10rem)*100/60))] flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-sm text-zinc-200">
      <div className="font-medium text-zinc-100">Ảnh ô lưới tường</div>
      <p className="text-xs text-zinc-500">
        Gửi ảnh qua <code className="text-zinc-400">POST /api/upload</code> (multipart{" "}
        <code className="text-zinc-400">file</code>, cùng token như trang này) —{" "}
        <code className="text-zinc-400">/wall</code> polling <code className="text-zinc-400">GET /api/images</code>, ảnh
        mới hiệu ứng giữa màn rồi thu về góc.
      </p>
    </div>
  );
}
