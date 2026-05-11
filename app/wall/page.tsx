import type { Metadata } from "next";

import { PhotoWall } from "@/components/PhotoWall";
import { STAGE_HEIGHT_PX, STAGE_WIDTH_PX } from "@/lib/stageConstants";

export const metadata: Metadata = {
  title: "Triển lãm",
};

export default function WallPage() {
  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-zinc-950">
      <div
        className="absolute left-1/2 top-1/2 bg-zinc-950"
        style={{
          width: STAGE_WIDTH_PX,
          height: STAGE_HEIGHT_PX,
          transform: `translate(-50%, -50%) scale(min(calc(100dvw / ${STAGE_WIDTH_PX}), calc(100dvh / ${STAGE_HEIGHT_PX})))`,
          transformOrigin: "center center",
        }}
      >
        <div className="flex h-full w-full min-h-0 flex-col items-stretch justify-center px-4 py-3">
          <PhotoWall />
        </div>
      </div>
    </div>
  );
}
