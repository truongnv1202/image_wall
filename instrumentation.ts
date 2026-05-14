export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  const { logWallCompositePublic } = await import("@/lib/wallCompositePublicLog");
  await logWallCompositePublic("instrumentation-register", {
    nextRuntime: process.env.NEXT_RUNTIME ?? null,
  });
  const { startWallCompositeScheduler } = await import("@/lib/wallCompositeScheduler");
  startWallCompositeScheduler();
}
