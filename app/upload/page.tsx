import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Upload — thiếu token trong URL",
  robots: { index: false, follow: false },
};

export default function UploadIndexPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="max-w-lg space-y-4 text-center text-sm text-zinc-300">
        <p className="text-base font-medium text-white">Đường dẫn chưa đủ</p>
        <p>
          Trang upload cần <strong>token</strong> trong URL, ví dụ:{" "}
          <code className="break-all rounded bg-zinc-800 px-2 py-1 text-emerald-300">
            /upload/&lt;giá-trị-UPLOAD_PAGE_TOKEN&gt;
          </code>
        </p>
        <p className="text-zinc-500">
          Token phải trùng biến môi trường <code className="text-zinc-400">UPLOAD_PAGE_TOKEN</code>{" "}
          trên container (Docker Compose / .env), rồi khởi động lại dịch vụ web.
        </p>
      </div>
      <Link
        href="/wall"
        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Về /wall
      </Link>
    </div>
  );
}
