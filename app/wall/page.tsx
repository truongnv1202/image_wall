import type { Metadata } from "next";

import { PhotoWall } from "@/components/PhotoWall";
import { WallIntro } from "@/components/WallIntro";

export const metadata: Metadata = {
  title: "Tường ảnh — Triển lãm",
};

export default function WallPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-zinc-950 px-3 py-6 text-zinc-100">
      <WallIntro />
      <PhotoWall />
    </div>
  );
}
