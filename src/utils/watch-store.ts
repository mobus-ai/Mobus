import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type { WatchEntry, Source } from "../types.js";

export interface WatchStorage {
  add(query: string, sources?: Source[], userSub?: string): Promise<WatchEntry>;
  remove(watchId: string, userSub?: string): Promise<boolean>;
  list(userSub?: string): Promise<WatchEntry[]>;
  get(watchId: string, userSub?: string): Promise<WatchEntry | undefined>;
  update(watchId: string, data: Partial<WatchEntry>, userSub?: string): Promise<boolean>;
}

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

const storage: WatchStorage = new FileWatchStorage();

export function setWatchStorage(_s: WatchStorage): void {}

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
