export type CachedAppUser = {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "owner" | "investor" | "member";
};

const ME_CACHE_KEY = "zs:me:v1";
const ROLES = ["admin", "owner", "investor", "member"] as const;

export class ConnectionTimeoutError extends Error {
  constructor() {
    super("Connection timed out");
    this.name = "ConnectionTimeoutError";
  }
}

export function readCachedMe(): CachedAppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedAppUser>;
    if (!cached.userId || !cached.username || typeof cached.displayName !== "string") {
      return null;
    }
    const role = ROLES.includes(cached.role as CachedAppUser["role"])
      ? (cached.role as CachedAppUser["role"])
      : "member";
    return {
      userId: cached.userId,
      username: cached.username,
      displayName: cached.displayName,
      role,
    };
  } catch {
    return null;
  }
}

export function writeCachedMe(me: CachedAppUser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me));
  } catch {
    // Storage may be unavailable; the online session remains authoritative.
  }
}

export function clearCachedMe(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ME_CACHE_KEY);
  } catch {
    // Storage may be unavailable; there is then nothing local to clear.
  }
}

export function isOfflineLikeError(error: unknown): boolean {
  if (error instanceof ConnectionTimeoutError) return true;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("offline") ||
    msg.includes("load failed") ||
    msg.includes("timed out")
  );
}

export async function withConnectionTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ConnectionTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Verify real origin connectivity without accepting a service-worker cache hit. */
export async function probeAppConnection(timeoutMs = 2500): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL("/favicon.ico", window.location.origin);
    url.searchParams.set("_probe", String(Date.now()));
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
