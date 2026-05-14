import { promises as fs } from "fs";
import path from "path";

import { WALL_MASK_TEXT } from "@/lib/wallConstants";
import {
  WALL_GRAPHIC_DEFAULT_BLEND,
  WALL_GRAPHIC_OVERLAY_OPACITY,
  coerceGraphicOverlayOpacity,
  coerceWallGraphicBlendMode,
  resolveEnvWallGraphicBlendMode,
  type WallGraphicBlendMode,
} from "@/lib/wallGraphicUrls";

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
  /** Kích thước mỗi ô lưới trên tường (px) — mặc định 54×72 (3:4); tối thiểu 6×8. */
  gridTileWidthPx: number;
  gridTileHeightPx: number;
  /** `mix-blend-mode` cho lớp ảnh overlay giữa tường. */
  graphicBlendMode: WallGraphicBlendMode;
  /** Độ mờ overlay / watermark ảnh (0 = trong suốt, 1 = đục hoàn toàn). */
  graphicOverlayOpacity: number;
  /** Chu kỳ ghép lại ảnh tường server-side (ms), mặc định 60s. */
  compositeIntervalMs: number;
  /** Kích thước ảnh ghép xuất ra (pixel), ~16:9. */
  compositeOutWidth: number;
  compositeOutHeight: number;
  /** Thời gian crossfade khi tường đổi sang ảnh ghép mới (ms). */
  wallCompositeFadeMs: number;
  /** Độ hiện lưới ảnh ở nền ngoài vùng chữ (0–0.5) — ghost mosaic. */
  compositeBgMosaicOpacity: number;
  /** Đẩy sáng vùng chữ (0–0.55): khuếch đại hướng về trắng theo mask. */
  compositeTextBrighten: number;
};

const DATA_PATH = path.join(process.cwd(), "data", "wall-text.json");

const DEFAULT: WallTextPayload = {
  phrases: [WALL_MASK_TEXT],
  rotateIntervalMs: 60_000,
  phraseCrossfadeMs: 800,
  gridCols: 100,
  gridRows: 60,
  gridTileWidthPx: 54,
  gridTileHeightPx: 72,
  graphicBlendMode: WALL_GRAPHIC_DEFAULT_BLEND,
  graphicOverlayOpacity: WALL_GRAPHIC_OVERLAY_OPACITY,
  compositeIntervalMs: 60_000,
  compositeOutWidth: 1920,
  compositeOutHeight: 1080,
  wallCompositeFadeMs: 900,
  compositeBgMosaicOpacity: 0.08,
  compositeTextBrighten: 0.28,
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

  let gridTileWidthPx =
    typeof o.gridTileWidthPx === "number" && Number.isFinite(o.gridTileWidthPx)
      ? Math.floor(o.gridTileWidthPx)
      : DEFAULT.gridTileWidthPx;
  gridTileWidthPx = Math.min(Math.max(6, gridTileWidthPx), 256);

  let gridTileHeightPx =
    typeof o.gridTileHeightPx === "number" && Number.isFinite(o.gridTileHeightPx)
      ? Math.floor(o.gridTileHeightPx)
      : DEFAULT.gridTileHeightPx;
  gridTileHeightPx = Math.min(Math.max(8, gridTileHeightPx), 384);

  const blendFallback = resolveEnvWallGraphicBlendMode() ?? WALL_GRAPHIC_DEFAULT_BLEND;
  const graphicBlendMode = coerceWallGraphicBlendMode(o.graphicBlendMode, blendFallback);
  const graphicOverlayOpacity = coerceGraphicOverlayOpacity(
    o.graphicOverlayOpacity,
    WALL_GRAPHIC_OVERLAY_OPACITY,
  );

  let compositeIntervalMs =
    typeof o.compositeIntervalMs === "number" && Number.isFinite(o.compositeIntervalMs)
      ? Math.floor(o.compositeIntervalMs)
      : DEFAULT.compositeIntervalMs;
  compositeIntervalMs = Math.min(Math.max(60_000, compositeIntervalMs), 3_600_000);

  let compositeOutWidth =
    typeof o.compositeOutWidth === "number" && Number.isFinite(o.compositeOutWidth)
      ? Math.floor(o.compositeOutWidth)
      : DEFAULT.compositeOutWidth;
  compositeOutWidth = Math.min(Math.max(640, compositeOutWidth), 3840);

  let compositeOutHeight =
    typeof o.compositeOutHeight === "number" && Number.isFinite(o.compositeOutHeight)
      ? Math.floor(o.compositeOutHeight)
      : DEFAULT.compositeOutHeight;
  compositeOutHeight = Math.min(Math.max(360, compositeOutHeight), 2160);

  let wallCompositeFadeMs =
    typeof o.wallCompositeFadeMs === "number" && Number.isFinite(o.wallCompositeFadeMs)
      ? Math.floor(o.wallCompositeFadeMs)
      : DEFAULT.wallCompositeFadeMs;
  wallCompositeFadeMs = Math.min(Math.max(200, wallCompositeFadeMs), 5000);

  let compositeBgMosaicOpacity =
    typeof o.compositeBgMosaicOpacity === "number" && Number.isFinite(o.compositeBgMosaicOpacity)
      ? o.compositeBgMosaicOpacity
      : DEFAULT.compositeBgMosaicOpacity;
  compositeBgMosaicOpacity = Math.min(Math.max(0, compositeBgMosaicOpacity), 0.5);

  let compositeTextBrighten =
    typeof o.compositeTextBrighten === "number" && Number.isFinite(o.compositeTextBrighten)
      ? o.compositeTextBrighten
      : DEFAULT.compositeTextBrighten;
  compositeTextBrighten = Math.min(Math.max(0, compositeTextBrighten), 0.55);

  return {
    phrases,
    rotateIntervalMs,
    phraseCrossfadeMs,
    gridCols,
    gridRows,
    gridTileWidthPx,
    gridTileHeightPx,
    graphicBlendMode,
    graphicOverlayOpacity,
    compositeIntervalMs,
    compositeOutWidth,
    compositeOutHeight,
    wallCompositeFadeMs,
    compositeBgMosaicOpacity,
    compositeTextBrighten,
  };
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
