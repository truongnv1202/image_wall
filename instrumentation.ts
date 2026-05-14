export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  const { logWallOverlayChuNenExists } = await import("@/lib/wallOverlayDiag");
  await logWallOverlayChuNenExists();
}
