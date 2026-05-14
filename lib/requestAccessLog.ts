import { promises as fs } from "fs";
import path from "path";

const PUBLIC_REL = path.join("public", "logs", "request-access.log");
const DATA_FALLBACK_REL = path.join("data", "request-access.log");

export type RequestAccessLogPayload = {
  method: string;
  pathname: string;
  search?: string;
  /** User-Agent nếu có (rút gọn). */
  uaSnippet?: string | null;
};

async function tryAppend(abs: string, line: string): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.appendFile(abs, line, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Append một dòng JSON — thử `public/logs/` rồi `data/`. Không throw. */
export async function appendRequestAccessLog(payload: RequestAccessLogPayload): Promise<void> {
  const cwd = process.cwd();
  const line =
    JSON.stringify({
      iso: new Date().toISOString(),
      pid: process.pid,
      ...payload,
    }) + "\n";

  const pub = path.join(cwd, PUBLIC_REL);
  if (await tryAppend(pub, line)) return;

  const data = path.join(cwd, DATA_FALLBACK_REL);
  if (await tryAppend(data, line)) {
    console.warn("[requestAccessLog] fallback data/", DATA_FALLBACK_REL);
    return;
  }
  console.error("[requestAccessLog] không ghi được log request:", { pub, data });
}

export function requestAccessLogDisabled(): boolean {
  const v = process.env.REQUEST_ACCESS_LOG?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off";
}
