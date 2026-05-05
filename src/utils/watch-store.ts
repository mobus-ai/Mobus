import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { WatchEntry, Source } from "../types.js";

// ─── Storage interface ──────────────────────────────────────────────────────

export interface WatchStorage {
  add(query: string, sources?: Source[], userSub?: string): Promise<WatchEntry>;
  remove(watchId: string, userSub?: string): Promise<boolean>;
  list(userSub?: string): Promise<WatchEntry[]>;
  get(watchId: string, userSub?: string): Promise<WatchEntry | undefined>;
  update(watchId: string, data: Partial<WatchEntry>, userSub?: string): Promise<boolean>;
}

// ─── File-based storage (local / stdio mode) ────────────────────────────────

const STORE_DIR = join(homedir(), ".mobus");
const STORE_FILE = join(STORE_DIR, "watches.json");

async function ensureDir(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
}

async function readAll(): Promise<WatchEntry[]> {
  try {
    const raw = await readFile(STORE_FILE, "utf-8");
    return JSON.parse(raw) as WatchEntry[];
  } catch {
    return [];
  }
}

async function writeAll(entries: WatchEntry[]): Promise<void> {
  await ensureDir();
  await writeFile(STORE_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

class FileWatchStorage implements WatchStorage {
  async add(query: string, sources?: Source[]): Promise<WatchEntry> {
    const entries = await readAll();
    const entry: WatchEntry = {
      id: randomUUID().slice(0, 8),
      query,
      sources,
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    await writeAll(entries);
    return entry;
  }

  async remove(watchId: string): Promise<boolean> {
    const entries = await readAll();
    const idx = entries.findIndex((e) => e.id === watchId);
    if (idx < 0) return false;
    entries.splice(idx, 1);
    await writeAll(entries);
    return true;
  }

  async list(): Promise<WatchEntry[]> {
    return readAll();
  }

  async get(watchId: string): Promise<WatchEntry | undefined> {
    const entries = await readAll();
    return entries.find((e) => e.id === watchId);
  }

  async update(watchId: string, data: Partial<WatchEntry>): Promise<boolean> {
    const entries = await readAll();
    const idx = entries.findIndex((e) => e.id === watchId);
    if (idx < 0) return false;
    entries[idx] = { ...entries[idx], ...data };
    await writeAll(entries);
    return true;
  }
}

// ─── Postgres-based storage (remote / HTTP mode) ────────────────────────────

class PgWatchStorage implements WatchStorage {
  private getPool: () => import("pg").Pool;

  constructor(getPool: () => import("pg").Pool) {
    this.getPool = getPool;
  }

  async add(query: string, sources?: Source[], userSub?: string): Promise<WatchEntry> {
    const db = this.getPool();
    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    await db.query(
      `INSERT INTO watch_entries (id, user_sub, query, sources, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, userSub ?? "local", query, sources ?? null, now],
    );
    return { id, query, sources, createdAt: now };
  }

  async remove(watchId: string, userSub?: string): Promise<boolean> {
    const db = this.getPool();
    const res = await db.query(
      `DELETE FROM watch_entries WHERE id = $1 AND user_sub = $2`,
      [watchId, userSub ?? "local"],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async list(userSub?: string): Promise<WatchEntry[]> {
    const db = this.getPool();
    const res = await db.query<{
      id: string;
      query: string;
      sources: string[] | null;
      created_at: string;
      last_checked_at: string | null;
      last_result_ids: string[] | null;
    }>(
      `SELECT id, query, sources, created_at, last_checked_at, last_result_ids FROM watch_entries WHERE user_sub = $1 ORDER BY created_at DESC`,
      [userSub ?? "local"],
    );
    return res.rows.map((r) => ({
      id: r.id,
      query: r.query,
      sources: (r.sources as Source[]) ?? undefined,
      createdAt: r.created_at,
      lastCheckedAt: r.last_checked_at ?? undefined,
      lastResultIds: r.last_result_ids ?? undefined,
    }));
  }

  async get(watchId: string, userSub?: string): Promise<WatchEntry | undefined> {
    const db = this.getPool();
    const res = await db.query<{
      id: string;
      query: string;
      sources: string[] | null;
      created_at: string;
      last_checked_at: string | null;
      last_result_ids: string[] | null;
    }>(
      `SELECT id, query, sources, created_at, last_checked_at, last_result_ids FROM watch_entries WHERE id = $1 AND user_sub = $2`,
      [watchId, userSub ?? "local"],
    );
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id,
      query: r.query,
      sources: (r.sources as Source[]) ?? undefined,
      createdAt: r.created_at,
      lastCheckedAt: r.last_checked_at ?? undefined,
      lastResultIds: r.last_result_ids ?? undefined,
    };
  }

  async update(watchId: string, data: Partial<WatchEntry>, userSub?: string): Promise<boolean> {
    const db = this.getPool();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (data.lastCheckedAt !== undefined) {
      sets.push(`last_checked_at = $${i++}`);
      vals.push(data.lastCheckedAt);
    }
    if (data.lastResultIds !== undefined) {
      sets.push(`last_result_ids = $${i++}`);
      vals.push(data.lastResultIds);
    }
    if (sets.length === 0) return false;

    vals.push(watchId, userSub ?? "local");
    const res = await db.query(
      `UPDATE watch_entries SET ${sets.join(", ")} WHERE id = $${i++} AND user_sub = $${i}`,
      vals,
    );
    return (res.rowCount ?? 0) > 0;
  }
}

// ─── Singleton + backward-compatible exports ────────────────────────────────

let storage: WatchStorage = new FileWatchStorage();

export function setWatchStorage(s: WatchStorage): void {
  storage = s;
}

export function createPgWatchStorage(getPool: () => import("pg").Pool): WatchStorage {
  return new PgWatchStorage(getPool);
}

export async function addWatch(query: string, sources?: Source[]): Promise<WatchEntry> {
  return storage.add(query, sources);
}

export async function removeWatch(watchId: string): Promise<boolean> {
  return storage.remove(watchId);
}

export async function listWatches(): Promise<WatchEntry[]> {
  return storage.list();
}

export async function getWatch(watchId: string): Promise<WatchEntry | undefined> {
  return storage.get(watchId);
}

export async function updateWatch(watchId: string, update: Partial<WatchEntry>): Promise<boolean> {
  return storage.update(watchId, update);
}
