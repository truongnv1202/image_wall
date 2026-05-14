/**
 * Ghép lại ảnh tường định kỳ: mỗi chu kỳ đọc `compositeIntervalMs` từ `wall-text.json`,
 * xáo trộn ô lưới rồi gọi `regenerateWallComposite` (lưới + overlay A nếu có).
 */
let started = false;

export function startWallCompositeScheduler(): void {
  if (started || typeof setTimeout === "undefined") return;
  started = true;
  console.info("[wallCompositeScheduler] đã bật — chu kỳ theo compositeIntervalMs (lưới + overlay)");
  void (async () => {
    const { logWallCompositePublic } = await import("@/lib/wallCompositePublicLog");
    await logWallCompositePublic("scheduler-started", {});
  })();

  const loop = async () => {
    let delayMs = 120_000;
    try {
      const { readWallText } = await import("@/lib/wallTextStore");
      const wall = await readWallText();
      delayMs = wall.compositeIntervalMs;

      const { logWallCompositePublic } = await import("@/lib/wallCompositePublicLog");
      await logWallCompositePublic("scheduler-tick-before-regenerate", { delayMs });

      const { regenerateWallComposite } = await import("@/lib/generateWallComposite");
      await regenerateWallComposite();

      await logWallCompositePublic("scheduler-tick-after-regenerate", { delayMs });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[wallCompositeScheduler]", e);
      const { logWallCompositePublic } = await import("@/lib/wallCompositePublicLog");
      await logWallCompositePublic("scheduler-tick-error", { error: msg });
    }
    setTimeout(loop, delayMs);
  };

  void loop();
}
