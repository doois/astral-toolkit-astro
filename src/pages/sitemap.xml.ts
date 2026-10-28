import type { APIRoute } from "astro";
import { AstralHttpError } from "../lib/astral/index.ts";
import { cms } from "../lib/cms.ts";
import { env } from "../lib/env.ts";

// The sitemap the CMS already builds (hreflang, x-default, images). When the
// project has no site address yet, the same data is assembled here with SITE_URL.
export const prerender = true;

const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = async () => {
  let body: string;
  try {
    body = await cms.sitemapXml();
  } catch (error) {
    if (!(error instanceof AstralHttpError && error.code === "site_url_required")) throw error;
    const { data } = await cms.sitemap();
    const loc = (url: string) => (/^https?:\/\//.test(url) ? url : `${env.siteUrl}${url}`);
    body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...data.map((u) =>
        [
          "<url>",
          `<loc>${xml(loc(u.url))}</loc>`,
          `<lastmod>${u.lastmod}</lastmod>`,
          ...u.alternates.map((a) => `<xhtml:link rel="alternate" hreflang="${xml(a.locale)}" href="${xml(loc(a.url))}"/>`),
          ...u.images.map((i) => `<image:image><image:loc>${xml(i.loc)}</image:loc></image:image>`),
          "</url>",
        ].join(""),
      ),
      "</urlset>",
    ].join("\n");
  }
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
