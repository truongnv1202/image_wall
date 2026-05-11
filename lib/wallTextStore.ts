import { promises as fs } from "fs";
import path from "path";

import { WALL_MASK_TEXT } from "@/lib/wallConstants";

export type WallTextPayload = {
  phrases: string[];
  /** 0 = không tự động xoay; &gt; 0 = thời gian mỗi câu hiển thị trước khi chuyển (ms). */
  rotateIntervalMs: number;
  /** Độ dài hiệu ứng mờ dần khi đổi câu (ms). */
  phraseCrossfadeMs: number;
  /** Số ảnh theo chiều ngang. */
  gridCols: number;
  /** Số ảnh theo chiều dọc. */
  gridRows: number;
};

const DATA_PATH = path.join(process.cwd(), "data", "wall-text.json");

const DEFAULT: WallTextPayload = {
  phrases: [WALL_MASK_TEXT],
  rotateIntervalMs: 60_000,
  phraseCrossfadeMs: 800,
  gridCols: 100,
  gridRows: 60,
};

export function normalizeWallTextPayload(raw: unknown): WallTextPayload {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let phrases = Array.isArray(o.phrases)
    ? o.phrases.filter((x): x is string => typeof x === "string")
    : [];
  phrases = phrases.map((p) => p.trim()).filter((p) => p.length > 0);
  if (phrases.length === 0) phrases = [...DEFAULT.phrases];

  let rotateIntervalMs =
    typeof o.rotateIntervalMs === "number" && Number.isFinite(o.rotateIntervalMs)
      ? Math.max(0, Math.floor(o.rotateIntervalMs))
      : DEFAULT.rotateIntervalMs;
  rotateIntervalMs = Math.min(rotateIntervalMs, 24 * 60 * 60 * 1000);

  let phraseCrossfadeMs =
    typeof o.phraseCrossfadeMs === "number" && Number.isFinite(o.phraseCrossfadeMs)
      ? Math.floor(o.phraseCrossfadeMs)
      : DEFAULT.phraseCrossfadeMs;
  phraseCrossfadeMs = Math.min(Math.max(150, phraseCrossfadeMs), 4000);

  let gridCols =
    typeof o.gridCols === "number" && Number.isFinite(o.gridCols)
      ? Math.floor(o.gridCols)
      : DEFAULT.gridCols;
  gridCols = Math.min(Math.max(10, gridCols), 240);

  let gridRows =
    typeof o.gridRows === "number" && Number.isFinite(o.gridRows)
      ? Math.floor(o.gridRows)
      : DEFAULT.gridRows;
  gridRows = Math.min(Math.max(6, gridRows), 140);

  return { phrases, rotateIntervalMs, phraseCrossfadeMs, gridCols, gridRows };
}

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT, null, 2), "utf8");
  }
}

export async function readWallText(): Promise<WallTextPayload> {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  try {
    return normalizeWallTextPayload(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT };
  }
}

export async function writeWallText(payload: WallTextPayload): Promise<WallTextPayload> {
  await ensureFile();
  const next = normalizeWallTextPayload(payload);
  await fs.writeFile(DATA_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}
