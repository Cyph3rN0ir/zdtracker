import { onlineManager } from "@tanstack/react-query";

export type OfflineEntry = {
  id: string;
  fnKey: string;
  data: unknown;
  ts: number;
  userId: string | null;
  attempts: number;
  lastError?: string;
  coalesceKey?: string;
};

export type QueueResult<T = unknown> = {
  queued: boolean;
  result?: T;
  entryId?: string;
};

type Runner = (data: unknown) => Promise<unknown>;
type QueueOptions = { coalesceKey?: string };

const KEY = "zs:offline-queue:v2";
const LEGACY_KEY = "zs:offline-queue:v1";
const ME_CACHE_KEY = "zs:me:v1";
const runners = new Map<string, Runner>();
const listeners = new Set<() => void>();
let flushing: Promise<FlushResult> | null = null;

export type FlushResult = {
  ok: number;
  left: number;
  failed: boolean;
  failedCount: number;
};

function currentUserId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(ME_CACHE_KEY) || "null") as {
      userId?: string;
    } | null;
    return parsed?.userId ?? null;
  } catch {
    return null;
  }
}

function normalizeEntry(entry: Partial<OfflineEntry>): OfflineEntry | null {
  if (!entry.id || !entry.fnKey || typeof entry.ts !== "number") return null;
  return {
    id: entry.id,
    fnKey: entry.fnKey,
    data: entry.data,
    ts: entry.ts,
    userId: entry.userId ?? currentUserId(),
    attempts: entry.attempts ?? 0,
    lastError: entry.lastError,
    coalesceKey: entry.coalesceKey,
  };
}

function read(): OfflineEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<OfflineEntry>>;
    return parsed.map(normalizeEntry).filter((entry): entry is OfflineEntry => !!entry);
  } catch {
    return [];
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function write(entries: OfflineEntry[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
  localStorage.removeItem(LEGACY_KEY);
  notify();
}

function enqueue(fnKey: string, data: unknown, options?: QueueOptions): OfflineEntry {
  const entry: OfflineEntry = {
    id: createOfflineId(),
    fnKey,
    data,
    ts: Date.now(),
    userId: currentUserId(),
    attempts: 0,
    coalesceKey: options?.coalesceKey,
  };
  const queue = read();
  const next = entry.coalesceKey
    ? queue.filter(
        (queued) =>
          queued.userId !== entry.userId ||
          queued.fnKey !== entry.fnKey ||
          queued.coalesceKey !== entry.coalesceKey,
      )
    : queue;
  write([...next, entry]);
  return entry;
}

export function createOfflineId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isOfflineLikeError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : (error ?? "")).toLowerCase();
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("load failed") ||
    message.includes("failed to connect") ||
    message.includes("internet disconnected")
  );
}

export function registerOfflineRunner(fnKey: string, runner: Runner) {
  runners.set(fnKey, runner);
  return () => {
    if (runners.get(fnKey) === runner) runners.delete(fnKey);
  };
}

export async function runOrQueue<T = unknown>(
  fnKey: string,
  data: unknown,
  runner?: Runner,
  options?: QueueOptions,
): Promise<QueueResult<T>> {
  const resolvedRunner = runner ?? runners.get(fnKey);
  const online =
    typeof navigator === "undefined"
      ? true
      : navigator.onLine !== false && onlineManager.isOnline() !== false;

  if (online && resolvedRunner) {
    try {
      const result = await resolvedRunner(data);
      return { queued: false, result: result as T };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
      onlineManager.setOnline(false);
    }
  }

  const entry = enqueue(fnKey, data, options);
  return { queued: true, entryId: entry.id };
}

async function doFlush(): Promise<FlushResult> {
  if (
    typeof navigator !== "undefined" &&
    (navigator.onLine === false || onlineManager.isOnline() === false)
  ) {
    return { ok: 0, left: getQueueSize(), failed: false, failedCount: 0 };
  }

  const userId = currentUserId();
  let queue = read();
  let ok = 0;
  let failedCount = 0;

  for (const entry of [...queue]) {
    if (entry.userId && userId && entry.userId !== userId) continue;
    const runner = runners.get(entry.fnKey);
    if (!runner) {
      failedCount += 1;
      continue;
    }

    try {
      await runner(entry.data);
      queue = queue.filter((queued) => queued.id !== entry.id);
      write(queue);
      ok += 1;
    } catch (error) {
      if (isOfflineLikeError(error)) {
        onlineManager.setOnline(false);
        break;
      }
      failedCount += 1;
      queue = queue.map((queued) =>
        queued.id === entry.id
          ? {
              ...queued,
              attempts: queued.attempts + 1,
              lastError: String(error instanceof Error ? error.message : error),
            }
          : queued,
      );
      write(queue);
    }
  }

  return {
    ok,
    left: queue.filter((entry) => !entry.userId || !userId || entry.userId === userId).length,
    failed: failedCount > 0,
    failedCount,
  };
}

export function flushQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function getQueueSize(): number {
  const userId = currentUserId();
  return read().filter((entry) => !entry.userId || !userId || entry.userId === userId).length;
}

export function getFailedQueueSize(): number {
  const userId = currentUserId();
  return read().filter(
    (entry) => (!entry.userId || !userId || entry.userId === userId) && !!entry.lastError,
  ).length;
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearOfflineQueue(userId?: string) {
  if (typeof localStorage === "undefined") return;
  if (!userId) {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
    notify();
    return;
  }
  write(read().filter((entry) => entry.userId !== userId));
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === LEGACY_KEY || event.key === ME_CACHE_KEY) {
      notify();
    }
  });
}
