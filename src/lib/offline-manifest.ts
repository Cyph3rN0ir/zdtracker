// Phase 5: Offline route-coverage manifest.
//
// Single source of truth for *which* routes are offline-supported and *what
// bounds* the warmup uses when prefetching their data. Both the warmup module
// and (future) UI affordances ("This page is offline-ready") read from here.
//
// Conventions:
// - `key`       — canonical React Query key prefix the route reads from.
// - `route`     — route path pattern (for documentation / future per-route UI).
// - `bounded`   — what limits we apply during warmup to keep the persisted
//                 cache reasonable on phones.
// - `fallback`  — what the user sees offline if no cache exists yet (i.e. the
//                 route was never visited and warmup hasn't fanned out to it).

export const OFFLINE_BOUNDS = {
  // Cap per-collection fan-out during warmup so a user with 200 lists doesn't
  // explode the cache on first launch. Realistic phone-friendly ceilings.
  MAX_BUSINESSES: 20,
  MAX_LISTS: 20,
  MAX_PERSONAL_PROFILES: 20,
  // Notebook "today" window — only today is prefetched; other days load on
  // demand when online and stay cached after.
  TODAY_WINDOW_DAYS: 1,
  // Default staleTime for warmed-up entries: long enough that route render
  // doesn't trigger an immediate refetch, short enough that the next foreground
  // visit refreshes.
  STALE_TIME_MS: 1000 * 60 * 5,
} as const;

export type OfflineRoute = {
  route: string;
  keyPrefix: ReadonlyArray<string>;
  bounded: string;
  fallback: string;
};

export const OFFLINE_ROUTES: ReadonlyArray<OfflineRoute> = [
  { route: "/",                          keyPrefix: ["businesses"],                  bounded: "all (small list)",                fallback: "empty state" },
  { route: "/my/tasks",                  keyPrefix: ["my-tasks"],                    bounded: "all assigned to me",              fallback: "empty state" },
  { route: "/notebook/today",            keyPrefix: ["notebook", "today"],           bounded: "today only",                      fallback: "empty state" },
  { route: "/notebook/lists",            keyPrefix: ["notebook", "lists"],           bounded: "all lists",                       fallback: "empty state" },
  { route: "/notebook/lists/$listId",    keyPrefix: ["notebook", "notes"],           bounded: `first ${OFFLINE_BOUNDS.MAX_LISTS} lists`, fallback: "empty state if list not warmed" },
  { route: "/notebook/notes/$noteId",    keyPrefix: ["notebook", "note"],            bounded: "on-demand only",                  fallback: "must visit while online once" },
  { route: "/businesses/$id",            keyPrefix: ["business"],                    bounded: `first ${OFFLINE_BOUNDS.MAX_BUSINESSES}`, fallback: "must visit while online once" },
  { route: "/businesses/$id/people",     keyPrefix: ["members"],                     bounded: `first ${OFFLINE_BOUNDS.MAX_BUSINESSES}`, fallback: "must visit while online once" },
  { route: "/businesses/$id/tasks",      keyPrefix: ["tasks"],                       bounded: "current week",                    fallback: "must visit while online once" },
  { route: "/businesses/$id/money",      keyPrefix: ["btx"],                         bounded: `first ${OFFLINE_BOUNDS.MAX_BUSINESSES}`, fallback: "must visit while online once" },
  { route: "/businesses/$id/accounts",   keyPrefix: ["baccounts", "baccountsList"], bounded: `first ${OFFLINE_BOUNDS.MAX_BUSINESSES}`, fallback: "must visit while online once" },
  { route: "/businesses/$id/profit",     keyPrefix: ["btx"],                         bounded: `first ${OFFLINE_BOUNDS.MAX_BUSINESSES}`, fallback: "must visit while online once" },
  { route: "/personal",                  keyPrefix: ["personal"],                    bounded: "all profiles",                    fallback: "empty state" },
  { route: "/personal/$id",              keyPrefix: ["personal-tx", "personal-accts", "personal-cats", "personal-cps", "personal-loans", "personal-budgets"], bounded: `first ${OFFLINE_BOUNDS.MAX_PERSONAL_PROFILES}`, fallback: "must visit while online once" },
  { route: "/chat",                      keyPrefix: ["chat", "unread-total"],        bounded: "unread badge only",               fallback: "messages require network" },
];

// Routes NOT offline-supported (require network on every visit):
//   /chat/$conversationId — messages are realtime, not warmed.
//   /admin/users          — admin-only privileged data, not persisted client-side.
export const OFFLINE_EXCLUDED = ["/chat/$conversationId", "/admin/users"] as const;
