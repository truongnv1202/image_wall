import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-zinc-950 px-4 py-16 text-center text-zinc-100">
      <div>
        <p className="text-5xl font-semibold text-zinc-300">404</p>
        <h1 className="mt-2 text-lg font-medium text-white">Không tìm thấy trang</h1>
      </div>
      <div className="max-w-md space-y-3 text-sm text-zinc-400">
        <p>
          Nếu bạn đang mở <strong className="text-zinc-200">trang upload</strong>, địa chỉ phải có dạng{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-emerald-300">
            /upload/&lt;UPLOAD_PAGE_TOKEN&gt;
          </code>{" "}
          (một đoạn token duy nhất sau <code className="text-zinc-300">/upload/</code>), và biến môi
          trường <code className="text-zinc-300">UPLOAD_PAGE_TOKEN</code> trên server phải{" "}
          <strong className="text-zinc-200">trùng y hệt</strong> phần đó — sau đó cần deploy /
          restart container.
        </p>
        <p>
          Chỉ mở <code className="text-zinc-300">/upload</code> (thiếu token) cũng sẽ không có form
          upload.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/wall"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Về tường /wall
        </Link>
        <Link href="/" className="text-sm text-zinc-400 underline hover:text-white">
          Trang chủ
        </Link>
      </div>
    </div>
  );
}
