import type { AstroIntegration } from "astro";
import { loadEnv, type Plugin } from "vite";
import { createClient, localeFormat, type Redirect } from "../lib/astral/index.ts";
import { env, requireEnv } from "../lib/env.ts";
import { buildRoutes, type AstralConfig } from "../lib/routes.ts";

// Reads the CMS schema once, when Astro loads its configuration, and turns it
// into routes: one injected route per type, locale and kind (entry, listing,
// term archive), prerendered or on demand according to the type's `render`.
// The result is exposed to pages and middleware as the `astral:config` module.
// Redirects set in the CMS become Astro redirects.

// Astro reads `export const prerender` from the file, and applies it to every route of that
// file: a prerendered route and an on-demand one cannot share an entrypoint, hence two folders.
const entrypoint = (route: { kind: "entry" | "listing" | "term"; prerender: boolean }) => `./src/routes/${route.prerender ? "static" : "dynamic"}/${route.kind}.astro`;

export function astral(): AstroIntegration {
  return {
    name: "astral",
    hooks: {
      "astro:config:setup": async ({ injectRoute, updateConfig, logger, config: astroConfig }) => {
        // This hook runs before Vite fills import.meta.env: read .env the same way and let the
        // process (build, dev and the prerenderer) see it, like a Node app started with that .env.
        const dotenv = loadEnv(process.env.NODE_ENV ?? "production", astroConfig.root.pathname.replace(/^\/([A-Za-z]:)/, "$1"), "");
        for (const [key, value] of Object.entries(dotenv)) if (process.env[key] === undefined) process.env[key] = value;
        requireEnv();
        const client = createClient({ url: env.url, project: env.project, token: env.token || undefined, retries: 3 });
        let schema;
        let redirects: Redirect[] = [];
        try {
          [schema, redirects] = await Promise.all([client.schema(), client.redirects().catch(() => [] as Redirect[])]);
        } catch (error) {
          throw new Error(`Astral: não foi possível ler ${client.apiUrl}/schema (${error instanceof Error ? error.message : String(error)}). Confira ASTRAL_URL, ASTRAL_PROJECT e ASTRAL_TOKEN.`);
        }
        const format = localeFormat(schema, { mode: env.localeUrls || undefined });
        const only = (process.env.ASTRAL_BUILD_LOCALES ?? "").split(",").map((l) => l.trim()).filter((l) => format.locales.includes(l));
        const { routes, dropped } = buildRoutes(schema, format, only.length ? only : format.locales);
        for (const route of dropped) logger.warn(`rota ${route.pattern} (${route.locale}) ignorada: o mesmo caminho já serve outro idioma. No formato "${format.mode}" cada idioma é um build (ASTRAL_BUILD_LOCALES).`);

        for (const route of routes) injectRoute({ pattern: route.pattern, entrypoint: entrypoint(route), prerender: route.prerender });

        const config: AstralConfig = { format, routes, types: schema.types, taxonomies: schema.taxonomies, builtAt: new Date().toISOString() };
        updateConfig({
          redirects: Object.fromEntries(redirects.filter((r) => r.from.startsWith("/") && r.from !== r.to).map((r) => [r.from, { status: statusOf(r.status), destination: r.to }])),
          vite: { plugins: [virtualConfig(config)] },
        });

        const summary = schema.types.filter((t) => t.urlPattern).map((t) => `${t.apiId}: ${t.render ?? "static"}`).join(", ");
        logger.info(`${routes.length} rotas de ${format.locales.join(", ")} (${format.mode}); ${summary}; ${redirects.length} redirecionamentos`);
      },
    },
  };
}

const statusOf = (status: number): 300 | 301 | 302 | 303 | 304 | 307 | 308 => ([300, 301, 302, 303, 304, 307, 308] as const).find((s) => s === status) ?? 301;

/** `import config from "astral:config"`: the route table and locale format, frozen at build time. */
function virtualConfig(config: AstralConfig): Plugin {
  const id = "astral:config";
  const resolved = "\0astral:config";
  return {
    name: "astral-config",
    resolveId: (source) => (source === id ? resolved : null),
    load: (source) => (source === resolved ? `export default ${JSON.stringify(config)};` : null),
  };
}
