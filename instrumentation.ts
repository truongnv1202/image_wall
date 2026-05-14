export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWallCompositeScheduler } = await import("@/lib/wallCompositeScheduler");
    startWallCompositeScheduler();
  }
}
