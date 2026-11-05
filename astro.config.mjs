import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import { loadEnv } from "vite";
import { astral } from "./src/integration/astral.ts";

const env = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");

// Static by default: every page is HTML at build time. The Node adapter is here
// for the routes that cannot be built ahead (types with render "revalidate" or
// "dynamic", the draft preview, the revalidation webhook and the live island
// data). Which routes those are is decided by the CMS schema (src/integration).
export default defineConfig({
  site: env.SITE_URL || "http://localhost:4321",
  output: "static",
  // staticHeaders: the adapter serves prerendered files without running the middleware, so it keeps the
  // Content-Security-Policy each page had at build time and sends it with the file.
  adapter: node({ mode: "standalone", staticHeaders: true }),
  // The switch that makes the adapter keep that header. The value is the middleware's (src/lib/csp.ts), which
  // replaces Astro's own: the style hashes Astro generates would void 'unsafe-inline' and block style attributes.
  security: { csp: true },
  // No Markdown pages here: without this, every build warns that Shiki and that switch do not mix.
  markdown: { syntaxHighlight: false },
  // URLs without a trailing slash, like the CMS delivers them; "directory" writes /en/about/index.html,
  // which the Node adapter (and any host with directory index) serves at /en/about.
  trailingSlash: "never",
  build: {
    format: "directory",
    // The single stylesheet is inlined in the HTML (no render-blocking request); larger assets stay external and hashed.
    inlineStylesheets: "auto",
    assets: "_astro",
  },
  // Scripts stay files, however small: an inline one would need 'unsafe-inline' in script-src (src/lib/csp.ts).
  vite: { build: { assetsInlineLimit: (file, content) => !file.endsWith(".js") && content.length < 32 * 1024 } },
  compressHTML: true,
  integrations: [astral()],
});
