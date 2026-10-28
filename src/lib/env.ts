// Configuration comes from the environment, never from the repository. In dev
// and at build time Astro loads .env into import.meta.env; in the Node container
// the values come from process.env at runtime.

const read = (name: string): string => {
  const runtime = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const build = (import.meta.env as Record<string, string | undefined>)[name];
  return (runtime ?? build ?? "").trim();
};

export const env = {
  get url() {
    return read("ASTRAL_URL").replace(/\/+$/, "");
  },
  get project() {
    return read("ASTRAL_PROJECT");
  },
  get token() {
    return read("ASTRAL_TOKEN");
  },
  get webhookSecret() {
    return read("ASTRAL_WEBHOOK_SECRET");
  },
  get buildWebhookId() {
    return read("ASTRAL_BUILD_WEBHOOK_ID");
  },
  get siteUrl() {
    return (read("SITE_URL") || "http://localhost:4321").replace(/\/+$/, "");
  },
  get rebuildHook() {
    return read("ASTRAL_REBUILD_HOOK");
  },
  get localeUrls() {
    return read("ASTRAL_LOCALE_URLS");
  },
};

/** Fails early with a clear message when the CMS connection is not configured. */
export function requireEnv() {
  const missing = ["ASTRAL_URL", "ASTRAL_PROJECT"].filter((name) => !read(name));
  if (missing.length) throw new Error(`Astral: defina ${missing.join(", ")} no ambiente (.env). Veja .env.example.`);
}
