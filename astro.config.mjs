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
  adapter: node({ mode: "standalone" }),
  // URLs without a trailing slash, like the CMS delivers them; "directory" writes /en/about/index.html,
  // which the Node adapter (and any host with directory index) serves at /en/about.
  trailingSlash: "never",
  build: {
    format: "directory",
    // The single stylesheet is inlined in the HTML (no render-blocking request); larger assets stay external and hashed.
    inlineStylesheets: "auto",
    assets: "_astro",
  },
  vite: { build: { assetsInlineLimit: 32 * 1024 } },
  compressHTML: true,
  integrations: [astral()],
});
