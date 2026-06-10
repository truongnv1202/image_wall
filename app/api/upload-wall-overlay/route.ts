import { chmod, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";

import { rejectWithoutUploadToken } from "@/lib/uploadAuth";
import { looksLikeHeicOrHeif } from "@/lib/sniffImageFormat";
import { normalizeUploadTokenSegment } from "@/lib/uploadPageToken";
import {
  isValidWallOverlaySetId,
  wallCompositeOverlayDataPath,
  type WallOverlayLayer,
} from "@/lib/wallOverlayPaths";
import { activeWallOverlaySetId, readWallOverlaySets } from "@/lib/wallOverlayStore";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 8192;

/** Lớp B: quyền ghi đủ để upload lại đè file (Docker/volume thường gặp). */
const OVERLAY_B_FILE_MODE = 0o666;

async function chmodIfExists(abs: string, mode: number): Promise<void> {
  try {
    await chmod(abs, mode);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
    if (code !== "ENOENT") throw e;
  }
}

export const runtime = "nodejs";

function firstFormUploadToken(form: FormData): string | null {
  for (const key of ["uploadToken", "token"]) {
    const v = form.get(key);
    if (typeof v !== "string" || v.length === 0) continue;
    const t = normalizeUploadTokenSegment(v);
    if (t.length > 0) return t;
  }
  return null;
}

function parseLayer(raw: unknown): WallOverlayLayer {
  if (typeof raw !== "string") return "a";
  const s = raw.trim().toLowerCase();
  return s === "b" ? "b" : "a";
}

async function parseTargetSetId(raw: unknown): Promise<string> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return activeWallOverlaySetId();
  }
  const id = raw.trim();
  if (!isValidWallOverlaySetId(id)) {
    throw new Error("Mã bộ lớp phủ không hợp lệ.");
  }
  const payload = await readWallOverlaySets();
  if (!payload.sets.some((s) => s.id === id)) {
    throw new Error("Không tìm thấy bộ lớp phủ.");
  }
  return id;
}

function publicNameForLayer(layer: WallOverlayLayer): string {
  return layer === "b" ? "wall-composite-B.png" : "wall-composite-A.png";
}

/**
 * Upload lớp phủ PNG: form `layer` = `a` | `b` (mặc định `a`) vào bộ phủ active hoặc `setId`.
 * Lớp B sau khi ghi được `chmod 0666` (và thử trước khi ghi nếu file cũ tồn tại) để upload sau có thể đè.
 * DELETE `?layer=a|b&setId=...&token=…` — xóa file tương ứng (idempotent nếu không còn file).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const denied = rejectWithoutUploadToken(request, firstFormUploadToken(form));
    if (denied) return denied;

    const layer = parseLayer(form.get("layer"));
    const setId = await parseTargetSetId(form.get("setId"));
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File quá lớn (tối đa ${Math.round(MAX_BYTES / (1024 * 1024))} MB).` },
        { status: 400 },
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    if (looksLikeHeicOrHeif(input)) {
      return NextResponse.json(
        {
          error:
            "Ảnh HEIC/HEIF không hỗ trợ. Hãy xuất JPG/PNG/WebP rồi upload lại.",
          code: "HEIC",
        },
        { status: 400 },
      );
    }

    const meta = await sharp(input).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 1 || h < 1 || w > MAX_EDGE || h > MAX_EDGE) {
      return NextResponse.json(
        { error: `Ảnh không đọc được hoặc kích thước không hợp lệ (1–${MAX_EDGE}px mỗi cạnh).` },
        { status: 400 },
      );
    }

    const outAbs = wallCompositeOverlayDataPath(layer, setId);
    await mkdir(path.dirname(outAbs), { recursive: true });
    const pngBuf = await sharp(input).png().toBuffer();
    if (layer === "b") {
      await chmodIfExists(outAbs, OVERLAY_B_FILE_MODE);
    }
    await writeFile(outAbs, pngBuf);
    if (layer === "b") {
      await chmod(outAbs, OVERLAY_B_FILE_MODE);
    }

    const name = publicNameForLayer(layer);
    return NextResponse.json({
      ok: true,
      setId,
      layer,
      file: name,
      storage: setId === "default" ? `data/wall-overlays/${name}` : `data/wall-overlay-sets/${setId}/${name}`,
      width: w,
      height: h,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Write failed";
    const status =
      message === "Mã bộ lớp phủ không hợp lệ." || message === "Không tìm thấy bộ lớp phủ." ? 400 : 500;
    console.error("[upload-wall-overlay]", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = rejectWithoutUploadToken(request);
    if (denied) return denied;

    const url = new URL(request.url);
    const layer = parseLayer(url.searchParams.get("layer"));
    const setId = await parseTargetSetId(url.searchParams.get("setId"));

    const abs = wallCompositeOverlayDataPath(layer, setId);
    try {
      await unlink(abs);
      return NextResponse.json({ ok: true, setId, layer, deleted: true });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
      if (code === "ENOENT") {
        return NextResponse.json({ ok: true, setId, layer, deleted: false });
      }
      throw e;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    const status =
      message === "Mã bộ lớp phủ không hợp lệ." || message === "Không tìm thấy bộ lớp phủ." ? 400 : 500;
    console.error("[upload-wall-overlay] DELETE", err);
    return NextResponse.json({ error: message }, { status });
  }
}
