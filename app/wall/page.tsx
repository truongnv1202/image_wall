import type { Metadata } from "next";

import { PhotoWall } from "@/components/PhotoWall";
import { DISPLAY_REGION_STYLE } from "@/lib/stageConstants";

export const metadata: Metadata = {
  title: "Triển lãm",
};

export default function WallPage() {
  return (
    <div className="relative flex min-h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-zinc-950">
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-zinc-950"
        style={DISPLAY_REGION_STYLE}
      >
        <div className="flex h-full w-full min-h-0 flex-col px-3 py-2">
          <PhotoWall />
        </div>
      </div>
    </div>
  );
}
