import { PhotoWall } from "@/components/PhotoWall";
import { UploadPanel } from "@/components/UploadPanel";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-950 px-3 py-6 text-zinc-100">
      <header className="max-w-4xl text-center">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Tường ảnh tương tác
        </h1>
        <p className="mt-2 text-pretty text-sm text-zinc-400">
          Lưới 100×60 ô — lặp ảnh theo modulo; chữ &quot;HÒA BÌNH / ĐẸP LẮM&quot; từ mask canvas; ba
          màu luân phiên trên ô chữ; nền tối để chữ nổi.
        </p>
      </header>
      <PhotoWall />
      <UploadPanel />
    </div>
  );
}
