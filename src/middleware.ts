import type { APIContext, MiddlewareNext } from "astro";
import { defineMiddleware } from "astro:middleware";
import config from "astral:config";
import { pages } from "./lib/cache.ts";
import { contentSecurityPolicy } from "./lib/csp.ts";
import { routeOf } from "./lib/routes.ts";

// Cache policy per render mode, on the Node host:
// - static: prerendered files; the adapter serves them (and hashed assets as immutable). Nothing to do here.
// - revalidate: rendered on demand once, kept in memory and served from there; long shared-cache
//   headers with Cache-Tag so a CDN keeps it too. The webhook purges by path and tag.
// - dynamic: rendered per request, short shared cache.
// The site's own routes (preview, api) set their own headers.
//
// Every HTML answer carries the Content-Security-Policy, except in `astro dev`, where
// Vite injects its own inline scripts. A prerendered page gets it here, at build time,
// and keeps it through the adapter's staticHeaders. Pages kept in memory get it on the
// way out, so a cached copy never holds an old policy.

const REVALIDATE_HEADERS = "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400";
const DYNAMIC_HEADERS = "public, max-age=0, s-maxage=60, stale-while-revalidate=600";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await cached(context, next);
  if (!import.meta.env.DEV && (response.headers.get("content-type") ?? "").includes("text/html")) response.headers.set("content-security-policy", contentSecurityPolicy());
  return response;
});

const cached = async (context: APIContext, next: MiddlewareNext): Promise<Response> => {
  const route = routeOf(config, context.routePattern);
  context.locals.tags = route ? [`type:${route.type}`] : [];
  context.locals.images = 0;
  if (!route || context.isPrerendered || context.request.method !== "GET") return next();

  if (route.mode === "dynamic") {
    const response = await next();
    if (response.ok) response.headers.set("cache-control", DYNAMIC_HEADERS);
    return response;
  }

  // revalidate
  const path = context.url.pathname;
  const hit = pages.get(path);
  if (hit) return new Response(hit.body, { status: hit.status, headers: { ...hit.headers, "x-astral-cache": "hit" } });
  const response = await next();
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const body = await response.text();
  const tags = [...new Set(context.locals.tags)];
  const headers: Record<string, string> = { "content-type": response.headers.get("content-type")!, "cache-control": REVALIDATE_HEADERS, "cache-tag": tags.join(",") };
  pages.set(path, { body, status: response.status, headers, tags: new Set(tags) });
  return new Response(body, { status: response.status, headers: { ...headers, "x-astral-cache": "miss" } });
};
