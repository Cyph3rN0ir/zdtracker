// Minimal offline mutation queue.
// - runOrQueue(fnKey, data, runner): runs immediately when online; otherwise
//   stores the call in localStorage and resolves with { queued: true }.
// - flushQueue(): replays queued calls sequentially using the runners
//   registered via registerOfflineRunner. Stops on first failure to
//   preserve order; remaining items stay in the queue.
//
// Conflict policy: last-write-wins. Each queued call is independent and
// idempotent at the row level via server-side INSERT/UPDATE semantics —
// duplicates from a double-flush are negligible vs. the data-loss risk of
// dropping a write while offline.

export type OfflineEntry = {
  id: string;
  fnKey: string;
  data: unknown;
  ts: number;
};
type Runner = (data: any) => Promise<any>;

const KEY = "zs:offline-queue:v1";
const runners = new Map<string, Runner>();
const listeners = new Set<() => void>();

function read(): OfflineEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}
function write(arr: OfflineEntry[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(arr));
  listeners.forEach((l) => l());
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
): Promise<{ queued: boolean; result?: T }> {
  const r = runner ?? runners.get(fnKey);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (online && r) {
    const result = await r(data);
    return { queued: false, result: result as T };
  }
  const entry: OfflineEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(36).slice(2),
    fnKey,
    data,
    ts: Date.now(),
  };
  write([...read(), entry]);
  return { queued: true };
}

export async function flushQueue(): Promise<{ ok: number; left: number; failed: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: 0, left: read().length, failed: false };
  }
  let ok = 0;
  let failed = false;
  let queue = read();
  for (const e of [...queue]) {
    const runner = runners.get(e.fnKey);
    if (!runner) continue; // no handler this session — leave it
    try {
      await runner(e.data);
      queue = queue.filter((x) => x.id !== e.id);
      write(queue);
      ok++;
    } catch {
      failed = true;
      break; // preserve order
    }
  }
  return { ok, left: queue.length, failed };
}

export function getQueueSize(): number {
  return read().length;
}

export function subscribeQueue(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
