import { NextResponse } from "next/server";

import { appendRequestAccessLog, requestAccessLogDisabled } from "@/lib/requestAccessLog";

export const runtime = "nodejs";

type Body = {
  method?: string;
  pathname?: string;
  search?: string;
  uaSnippet?: string | null;
};

export async function POST(req: Request): Promise<Response> {
  if (requestAccessLogDisabled()) {
    return new NextResponse(null, { status: 204 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const method = typeof body.method === "string" ? body.method.slice(0, 16) : "UNKNOWN";
  const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 2048) : "/";
  const search =
    typeof body.search === "string" ? body.search.slice(0, 4096) : "";
  const uaSnippet =
    typeof body.uaSnippet === "string" ? body.uaSnippet.slice(0, 200) : null;

  await appendRequestAccessLog({ method, pathname, search, uaSnippet });

  return new NextResponse(null, { status: 204 });
}
