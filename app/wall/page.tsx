import type { Metadata } from "next";

import { PhotoWall } from "@/components/PhotoWall";

export const metadata: Metadata = {
  title: "Triển lãm",
};

export default function WallPage() {
  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-zinc-950">
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
        <PhotoWall />
      </div>
    </div>
  );
}
