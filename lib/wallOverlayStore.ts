import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import {
  DEFAULT_WALL_OVERLAY_SET_ID,
  isValidWallOverlaySetId,
  wallCompositeOverlayDataPath,
  wallCompositeOverlayFilename,
  wallOverlaysDir,
  wallOverlaySetsRoot,
  type WallOverlayLayer,
} from "@/lib/wallOverlayPaths";

const STORE_PATH = path.join(process.cwd(), "data", "wall-overlay-sets.json");
const WALL_OVERLAY_RANDOM_ROTATE_MS = 60_000;

export type WallOverlaySet = {
  id: string;
  label: string;
  createdAt: string;
};

export type WallOverlaySetWithStatus = WallOverlaySet & {
  active: boolean;
  aExists: boolean;
  bExists: boolean;
  aVersion: number;
  bVersion: number;
};

export type WallOverlaySetsPayload = {
  activeSetId: string;
  sets: WallOverlaySetWithStatus[];
};

type WallOverlayStore = {
  activeSetId: string;
  activeRotatedAt: number;
  sets: WallOverlaySet[];
};

const DEFAULT_SET: WallOverlaySet = {
  id: DEFAULT_WALL_OVERLAY_SET_ID,
  label: "Bộ mặc định",
  createdAt: "1970-01-01T00:00:00.000Z",
};

function normalizeLabel(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const s = raw.trim().replace(/\s+/g, " ");
  return s.length > 0 ? s.slice(0, 80) : fallback;
}

function normalizeStore(raw: unknown): WallOverlayStore {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawSets = Array.isArray(o.sets) ? o.sets : [];
  const seen = new Set<string>();
  const sets: WallOverlaySet[] = [DEFAULT_SET];

  for (const item of rawSets) {
    const s = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const id = typeof s.id === "string" ? s.id.trim() : "";
    if (!isValidWallOverlaySetId(id) || seen.has(id) || id === DEFAULT_WALL_OVERLAY_SET_ID) {
      continue;
    }
    seen.add(id);
    sets.push({
      id,
      label: normalizeLabel(s.label, `Bộ phủ ${sets.length + 1}`),
      createdAt: typeof s.createdAt === "string" && s.createdAt.length > 0
        ? s.createdAt
        : new Date().toISOString(),
    });
  }

  const activeRaw = typeof o.activeSetId === "string" ? o.activeSetId.trim() : "";
  const activeSetId = sets.some((s) => s.id === activeRaw) ? activeRaw : DEFAULT_WALL_OVERLAY_SET_ID;
  const activeRotatedAt =
    typeof o.activeRotatedAt === "number" && Number.isFinite(o.activeRotatedAt)
      ? Math.max(0, Math.floor(o.activeRotatedAt))
      : 0;
  return { activeSetId, activeRotatedAt, sets };
}

async function writeStore(store: WallOverlayStore): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tmpPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(tmpPath, STORE_PATH);
  } catch (e) {
    await fs.unlink(tmpPath).catch(() => {});
    throw e;
  }
}

async function readStore(): Promise<WallOverlayStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw) as unknown);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
    if (code !== "ENOENT") {
      console.error("[wallOverlayStore] không đọc được store:", e);
    }
    return normalizeStore(null);
  }
}

async function layerStat(setId: string, layer: WallOverlayLayer): Promise<{ exists: boolean; version: number }> {
  const abs = await resolveWallOverlayLayerFile(layer, setId);
  if (!abs) return { exists: false, version: 0 };
  const st = await fs.stat(abs);
  return { exists: true, version: Math.floor(st.mtimeMs) };
}

async function completeOverlaySetIds(store: WallOverlayStore): Promise<string[]> {
  const statuses = await Promise.all(
    store.sets.map(async (set) => {
      const [a, b] = await Promise.all([layerStat(set.id, "a"), layerStat(set.id, "b")]);
      return a.exists && b.exists ? set.id : null;
    }),
  );
  return statuses.filter((id): id is string => typeof id === "string");
}

function pickRandomSetId(ids: readonly string[], currentId: string): string | null {
  if (ids.length === 0) return null;
  const pool = ids.length > 1 ? ids.filter((id) => id !== currentId) : ids;
  if (pool.length === 0) return ids[0] ?? null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export async function readWallOverlaySets(): Promise<WallOverlaySetsPayload> {
  const store = await readStore();
  const sets = await Promise.all(
    store.sets.map(async (set) => {
      const [a, b] = await Promise.all([layerStat(set.id, "a"), layerStat(set.id, "b")]);
      return {
        ...set,
        active: set.id === store.activeSetId,
        aExists: a.exists,
        bExists: b.exists,
        aVersion: a.version,
        bVersion: b.version,
      };
    }),
  );
  return { activeSetId: store.activeSetId, sets };
}

export async function createWallOverlaySet(label?: string): Promise<WallOverlaySetsPayload> {
  const store = await readStore();
  const id = `set-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const nextSet: WallOverlaySet = {
    id,
    label: normalizeLabel(label, `Bộ phủ ${store.sets.length + 1}`),
    createdAt: new Date().toISOString(),
  };
  const next = { activeSetId: id, activeRotatedAt: Date.now(), sets: [...store.sets, nextSet] };
  await fs.mkdir(path.join(wallOverlaySetsRoot(), id), { recursive: true });
  await writeStore(next);
  return readWallOverlaySets();
}

export async function selectWallOverlaySet(id: string): Promise<WallOverlaySetsPayload> {
  const store = await readStore();
  if (!store.sets.some((s) => s.id === id)) {
    throw new Error("Không tìm thấy bộ lớp phủ.");
  }
  await writeStore({ ...store, activeSetId: id, activeRotatedAt: Date.now() });
  return readWallOverlaySets();
}

export async function deleteWallOverlaySet(id: string): Promise<WallOverlaySetsPayload & { deletedFiles: number }> {
  const store = await readStore();
  if (!store.sets.some((s) => s.id === id)) {
    throw new Error("Không tìm thấy bộ lớp phủ.");
  }

  let deletedFiles = 0;
  for (const layer of ["a", "b"] as const) {
    try {
      await fs.unlink(wallCompositeOverlayDataPath(layer, id));
      deletedFiles += 1;
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String((e as NodeJS.ErrnoException).code) : "";
      if (code !== "ENOENT") throw e;
    }
  }

  if (id !== DEFAULT_WALL_OVERLAY_SET_ID) {
    await fs.rm(path.join(wallOverlaySetsRoot(), id), { recursive: true, force: true });
  }

  const sets =
    id === DEFAULT_WALL_OVERLAY_SET_ID
      ? store.sets
      : store.sets.filter((s) => s.id !== id);
  const activeSetId = store.activeSetId === id ? DEFAULT_WALL_OVERLAY_SET_ID : store.activeSetId;
  await writeStore({ activeSetId, activeRotatedAt: Date.now(), sets });
  return { ...(await readWallOverlaySets()), deletedFiles };
}

export async function resolveWallOverlayLayerFile(
  layer: WallOverlayLayer,
  setId?: string | null,
): Promise<string | null> {
  const store = await readStore();
  let requestedId = store.activeSetId;
  if (typeof setId === "string" && setId.length > 0) {
    if (!store.sets.some((s) => s.id === setId)) {
      return null;
    }
    requestedId = setId;
  }
  const id = store.sets.some((s) => s.id === requestedId) ? requestedId : DEFAULT_WALL_OVERLAY_SET_ID;
  const filename = wallCompositeOverlayFilename(layer);
  const candidates =
    id === DEFAULT_WALL_OVERLAY_SET_ID
      ? [wallCompositeOverlayDataPath(layer, id), path.join(wallOverlaysDir(), filename)]
      : [wallCompositeOverlayDataPath(layer, id)];

  for (const p of candidates) {
    try {
      const st = await fs.stat(p);
      if (st.isFile() && st.size > 0) return p;
    } catch {
      continue;
    }
  }
  return null;
}

export async function activeWallOverlaySetId(): Promise<string> {
  return (await readStore()).activeSetId;
}

/** Queue nhẹ để 2 request meta A/B không đổi sang 2 bộ khác nhau cùng lúc. */
let rotationChain: Promise<void> = Promise.resolve();

export async function activeWallOverlaySetIdForWall(): Promise<string> {
  const prev = rotationChain;
  let done!: () => void;
  rotationChain = new Promise<void>((resolve) => {
    done = resolve;
  });
  await prev.catch((e) => {
    console.error("[wallOverlayStore] rotation queue lỗi trước đó:", e);
  });

  try {
    const store = await readStore();
    const now = Date.now();
    if (now - store.activeRotatedAt < WALL_OVERLAY_RANDOM_ROTATE_MS) {
      return store.activeSetId;
    }

    const completeIds = await completeOverlaySetIds(store);
    const nextId = pickRandomSetId(completeIds, store.activeSetId);
    if (!nextId) {
      await writeStore({ ...store, activeRotatedAt: now });
      return store.activeSetId;
    }

    await writeStore({ ...store, activeSetId: nextId, activeRotatedAt: now });
    return nextId;
  } finally {
    done();
  }
}

