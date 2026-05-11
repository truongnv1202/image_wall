import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UploadPanel } from "@/components/UploadPanel";
import { uploadTokenMatches } from "@/lib/uploadPageToken";

export const metadata: Metadata = {
  title: "Upload test",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function SecretUploadPage({ params }: Props) {
  const { token } = await params;
  if (!uploadTokenMatches(token)) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-3 py-10 text-zinc-100">
      <p className="max-w-md text-center text-xs text-zinc-500">
        Trang upload thử nghiệm (không liên kết công khai). Ảnh vẫn ghi vào cùng kho với tường{" "}
        <code className="text-zinc-400">/wall</code>.
      </p>
      <UploadPanel apiUploadToken={token} />
    </div>
  );
}
