import type { Metadata } from "next";

import { PhotoWall } from "@/components/PhotoWall";

export const metadata: Metadata = {
  title: "Triển lãm",
};

export default function WallPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-3 py-4 text-zinc-100">
      <PhotoWall />
    </div>
  );
}
