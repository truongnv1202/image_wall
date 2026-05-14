/**
 * Ghép lại ảnh tường định kỳ: mỗi chu kỳ đọc `compositeIntervalMs` từ `wall-text.json`,
 * xáo trộn ô lưới ngẫu nhiên rồi chạy STEP 1–3 trong `regenerateWallComposite`.
 */
let started = false;

export function startWallCompositeScheduler(): void {
  if (started || typeof setTimeout === "undefined") return;
  started = true;

  const loop = async () => {
    let delayMs = 60_000;
    try {
      const { readWallText } = await import("@/lib/wallTextStore");
      const wall = await readWallText();
      delayMs = wall.compositeIntervalMs;

      const { regenerateWallComposite } = await import("@/lib/generateWallComposite");
      await regenerateWallComposite();
    } catch (e) {
      console.error("[wallCompositeScheduler]", e);
    }
    setTimeout(loop, delayMs);
  };

  void loop();
}
