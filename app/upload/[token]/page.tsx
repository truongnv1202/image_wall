import type { Metadata } from "next";
import Link from "next/link";

import { UploadPanel } from "@/components/UploadPanel";
import { WallBlendPanel } from "@/components/WallBlendPanel";
import { WallTextPanel } from "@/components/WallTextPanel";
import {
  getExpectedUploadToken,
  normalizeUploadTokenSegment,
} from "@/lib/uploadPageToken";

export const metadata: Metadata = {
  title: "Upload test",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

function UploadTokenWrong() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-zinc-700 bg-zinc-900/80 px-5 py-6 text-sm text-zinc-200">
      <p className="font-medium text-zinc-100">Token trong URL không khớp server</p>
      <p className="text-zinc-400">
        Kiểm tra biến <code className="rounded bg-black/40 px-1.5 py-0.5">UPLOAD_PAGE_TOKEN</code>{" "}
        trên container có <strong>đúng y hệt</strong> chuỗi sau <code className="text-zinc-300">/upload/</code>{" "}
        (không có dấu nháy, không xuống dòng, không khoảng trắng thừa). Dev: không set env thì chỉ
        dùng <code className="rounded bg-black/40 px-1">/upload/dev-upload</code>.
      </p>
      <Link href="/wall" className="text-emerald-400 underline hover:text-emerald-300">
        Về /wall
      </Link>
    </div>
  );
}

function UploadTokenMissing() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-xl border border-amber-900/60 bg-amber-950/40 px-5 py-6 text-sm text-amber-100">
      <p className="font-medium text-amber-50">Chưa cấu hình token upload trên server</p>
      <p className="text-amber-100/90">
        Biến môi trường <code className="rounded bg-black/30 px-1.5 py-0.5">UPLOAD_PAGE_TOKEN</code>{" "}
        đang trống hoặc chỉ gồm khoảng trắng. Trang{" "}
        <code className="rounded bg-black/30 px-1">/upload/&lt;token&gt;</code> chỉ hoạt động khi
        token trong URL <strong>trùng khớp</strong> giá trị đó (Docker: thêm vào service{" "}
        <code className="rounded bg-black/30 px-1">web</code> trong{" "}
        <code className="rounded bg-black/30 px-1">docker-compose.yml</code> hoặc file{" "}
        <code className="rounded bg-black/30 px-1">.env</code> rồi khởi động lại container).
      </p>
      <Link href="/wall" className="text-amber-200 underline hover:text-white">
        Về tường ảnh /wall
      </Link>
    </div>
  );
}

export default async function SecretUploadPage({ params }: Props) {
  const { token } = await params;
  const expected = getExpectedUploadToken();
  const segment = normalizeUploadTokenSegment(token);

  if (expected === null) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-3 py-10 pb-16 text-zinc-100">
        <UploadTokenMissing />
      </div>
    );
  }

  if (segment !== expected) {
    return (
      <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-3 py-10 pb-16 text-zinc-100">
        <UploadTokenWrong />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-3 py-10 pb-16 text-zinc-100">
      <p className="max-w-md text-center text-xs text-zinc-500">
        Trang quản trị thử (không công khai). Upload ảnh, chỉnh blend overlay và cấu hình chữ/lưới — ghi
        vào cùng kho với tường <code className="text-zinc-400">/wall</code>.
      </p>
      <WallBlendPanel apiUploadToken={token} />
      <UploadPanel apiUploadToken={token} />
      <WallTextPanel apiUploadToken={token} />
    </div>
  );
}
