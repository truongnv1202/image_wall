import { NextResponse } from "next/server";

import { rejectWithoutUploadToken } from "@/lib/uploadAuth";
import {
  createWallOverlaySet,
  deleteWallOverlaySet,
  readWallOverlaySets,
  selectWallOverlaySet,
} from "@/lib/wallOverlayStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const raw = (await request.json()) as unknown;
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const denied = rejectWithoutUploadToken(request);
  if (denied) return denied;

  const data = await readWallOverlaySets();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function POST(request: Request) {
  try {
    const denied = rejectWithoutUploadToken(request);
    if (denied) return denied;

    const body = await readJsonBody(request);
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "create";
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const label = typeof body.label === "string" ? body.label : undefined;

    const data =
      action === "select"
        ? await selectWallOverlaySet(id)
        : await createWallOverlaySet(label);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    console.error("[wall-overlay-sets] POST", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = rejectWithoutUploadToken(request);
    if (denied) return denied;

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const data = await deleteWallOverlaySet(id);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    console.error("[wall-overlay-sets] DELETE", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

