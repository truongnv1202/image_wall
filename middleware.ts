import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function loggingDisabled(): boolean {
  const v = process.env.REQUEST_ACCESS_LOG?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off";
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (loggingDisabled()) {
    return NextResponse.next();
  }

  const ua = request.headers.get("user-agent");
  const body = JSON.stringify({
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search ?? "",
    uaSnippet: ua ? ua.slice(0, 200) : null,
  });

  const logUrl = new URL("/api/_request-log", request.url);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      await fetch(logUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  } catch {
    /* không chặn request nếu ghi log lỗi */
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/_request-log|favicon.ico).*)"],
};
