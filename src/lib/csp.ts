// The site's Content-Security-Policy. Same policy as the other toolkits
// (cms/docs/TOOLKITS.md). The middleware sends it (prerendered pages keep it
// through the adapter's staticHeaders), and the build writes it to `_headers`
// for static hosts.
//
// Images come from the CMS, on ASTRAL_URL or on its media host. ASTRAL_MEDIA_URL
// names that host; without it the site cannot know it (nothing in the API says),
// so img-src takes any https: origin instead of breaking images. JSON-LD is a data
// block, which script-src does not block; style-src keeps 'unsafe-inline' for the
// inlined stylesheet and the images' dominant-color style attribute.
//
// The draft preview alone (`preview`) also lets the CMS admin frame the page and
// run its live edit agent, so published pages never carry those two sources.

import { env } from "./env.ts";

const originOf = (url: string) => {
  try {
    const { origin, protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? origin : "";
  } catch {
    return "";
  }
};

const directive = (name: string, sources: string[]) => [name, ...new Set(sources.filter(Boolean))].join(" ");

/** For a <meta> tag: browsers ignore frame-ancestors there and log an error. The final ";" keeps object-src valid under antivirus proxies that append to the value (Kaspersky). */
export const metaContentSecurityPolicy = () => `${contentSecurityPolicy().replace(/frame-ancestors [^;]*; /, "")};`;

/** The CMS's live edit agent. It answers only its own origin, so it is always loaded from the CMS. */
export const liveEditAgent = () => `${originOf(env.url)}/live-edit.js`;

export function contentSecurityPolicy(preview = false) {
  const cms = originOf(env.url);
  const media = originOf(env.mediaUrl);
  return [
    "default-src 'self'",
    directive("script-src", ["'self'", preview ? cms : ""]),
    "style-src 'self' 'unsafe-inline'",
    directive("img-src", ["'self'", "data:", cms, media || "https:"]),
    "font-src 'self'",
    directive("connect-src", ["'self'", cms]),
    "form-action 'self'",
    directive("frame-ancestors", ["'self'", preview ? cms : ""]),
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}
