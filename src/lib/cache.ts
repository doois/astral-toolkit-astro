// Two small in-memory caches for the Node host, both purged by the revalidation
// webhook (src/pages/api/astral/revalidate.ts):
//
// - `memo`: CMS responses (settings, menus, lists) keyed by name and tagged with
//   the CMS's cache tags ("type:post", "menus", "settings"...). At build time it
//   simply avoids repeated requests; at runtime a short TTL covers a missed webhook.
// - `pages`: rendered HTML of "revalidate" routes, keyed by path and tagged too.
//   The middleware serves hits and stores misses; a webhook purges by path or tag.
//
// Both live in the process: a container restart starts empty (the first request
// renders again) and several containers each keep their own copy, so the CDN
// in front (Cache-Control + Cache-Tag headers) is the cache that matters at scale.

type Memo = { value: Promise<unknown>; tags: Set<string>; expires: number };
type Page = { body: string; status: number; headers: Record<string, string>; tags: Set<string>; storedAt: number };

const memos = new Map<string, Memo>();
const html = new Map<string, Page>();

/** 5 minutes at runtime; at build time the process ends long before. */
export const DEFAULT_TTL = 5 * 60_000;

export async function memo<T>(key: string, tags: string[], loader: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const hit = memos.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = loader();
  memos.set(key, { value, tags: new Set(tags), expires: Date.now() + ttl });
  // A failed load is not kept: the next call tries again.
  value.catch(() => memos.delete(key));
  return value;
}

export const pages = {
  get: (path: string) => html.get(path),
  set(path: string, page: Omit<Page, "storedAt">) {
    html.set(path, { ...page, storedAt: Date.now() });
  },
  purgePaths(paths: string[]) {
    let n = 0;
    for (const path of paths) if (html.delete(path)) n++;
    return n;
  },
  size: () => html.size,
};

/** Drops every memo and page that carries one of the tags; returns how many went. */
export function purgeTags(tags: string[]) {
  const wanted = new Set(tags);
  let n = 0;
  for (const [key, entry] of memos) if ([...entry.tags].some((t) => wanted.has(t))) (memos.delete(key), n++);
  for (const [path, page] of html) if ([...page.tags].some((t) => wanted.has(t))) (html.delete(path), n++);
  return n;
}

export function purgeAll() {
  const n = memos.size + html.size;
  memos.clear();
  html.clear();
  return n;
}
