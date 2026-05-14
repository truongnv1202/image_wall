export async function register() {
  /* `NEXT_RUNTIME` đôi khi không set; chỉ bỏ qua Edge — còn lại chạy scheduler Node. */
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  const { startWallCompositeScheduler } = await import("@/lib/wallCompositeScheduler");
  startWallCompositeScheduler();
}
