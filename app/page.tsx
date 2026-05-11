import { InteractiveWall } from "@/components/InteractiveWall";
import { UploadPanel } from "@/components/UploadPanel";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center gap-8 bg-gradient-to-b from-zinc-950 to-black px-4 py-10 text-zinc-100">
      <header className="max-w-3xl text-center">
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Tường ảnh tương tác
        </h1>
        <p className="mt-2 text-pretty text-sm text-zinc-400">
          Ảnh lấp lưới; chữ được tạo bằng phủ màu (ấm trên nền lạnh). Đổi dòng chữ
          bên dưới — ma trận mask được tính lại trên canvas.
        </p>
      </header>
      <InteractiveWall />
      <UploadPanel />
    </div>
  );
}
