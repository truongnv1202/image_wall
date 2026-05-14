let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

async function tickAndSchedule() {
  try {
    const { regenerateWallComposite } = await import("@/lib/generateWallComposite");
    await regenerateWallComposite();
  } catch (e) {
    console.error("[wallCompositeScheduler] tick:", e);
  }
  try {
    const { readWallText } = await import("@/lib/wallTextStore");
    const w = await readWallText();
    const ms = Math.max(60_000, w.compositeIntervalMs);
    timer = setTimeout(() => void tickAndSchedule(), ms);
  } catch {
    timer = setTimeout(() => void tickAndSchedule(), 60_000);
  }
}

/** Gọi một lần khi server Node khởi động (instrumentation). */
export function startWallCompositeScheduler(): void {
  if (started) return;
  started = true;
  clearTimer();
  /* Tick đầu nhanh; các lần sau tối thiểu 60s, theo compositeIntervalMs trên site upload. */
  timer = setTimeout(() => void tickAndSchedule(), 800);
}
