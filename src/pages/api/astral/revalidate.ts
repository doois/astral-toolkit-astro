import type { APIRoute } from "astro";
import config from "astral:config";
import { pathsOf, tagsOf, typesOf, verifyWebhook } from "../../../lib/astral/index.ts";
import { pages, purgeAll, purgeTags } from "../../../lib/cache.ts";
import { env } from "../../../lib/env.ts";

// The CMS calls this on every change (the project's webhook). After checking the
// signature, the site:
// 1. purges the HTML of the paths named by the event (revalidate routes) and every
//    cached CMS response carrying one of the event's tags;
// 2. when a static type, or something every page uses (menus, settings, schema,
//    taxonomies), changed, asks for a rebuild through ASTRAL_REBUILD_HOOK;
// 3. on "site.rebuild" (the admin's button), asks for the rebuild right away.
//
// On a CDN, the same paths and tags are what to purge (Cache-Tag header): add the
// CDN's purge call where `rebuild` is called, with the same `paths` and `tags`.
export const prerender = false;

const GLOBAL_TAGS = ["menus", "settings", "schema"];

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const result = await verifyWebhook(raw, request.headers, env.webhookSecret);
  if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: result.reason === "missing_secret" ? 503 : 401 });

  const { payload } = result;
  const paths = pathsOf(payload);
  const tags = tagsOf(payload);
  const types = typesOf(payload);
  const staticTypes = types.filter((apiId) => (config.types.find((t) => t.apiId === apiId)?.render ?? "static") === "static");
  const touchesGlobal = tags.some((tag) => GLOBAL_TAGS.includes(tag) || tag.startsWith("taxonomy:"));
  const needsRebuild = payload.event === "site.rebuild" || staticTypes.length > 0 || touchesGlobal;

  let purged = payload.event === "site.rebuild" ? purgeAll() : pages.purgePaths(paths) + purgeTags(tags);
  // Anything shared by every page (menus, settings) invalidates every cached page too.
  if (touchesGlobal) purged += purgeAll();

  const rebuild = needsRebuild ? await requestRebuild(payload.event) : "not_needed";
  return Response.json({ ok: true, event: result.event, purged, paths, tags, rebuild });
};

export const GET: APIRoute = () => Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });

/** POSTs to the deploy hook (Dokploy, GitHub, any CI). Without one, the answer says so and the admin's build status stays as it was. */
async function requestRebuild(reason: string): Promise<"requested" | "no_hook" | "failed"> {
  if (!env.rebuildHook) return "no_hook";
  try {
    const response = await fetch(env.rebuildHook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event_type: "astral-rebuild", reason, at: new Date().toISOString() }) });
    return response.ok ? "requested" : "failed";
  } catch {
    return "failed";
  }
}
