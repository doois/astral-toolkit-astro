import type { APIRoute } from "astro";
import { env } from "../lib/env.ts";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(["User-agent: *", "Allow: /", "Disallow: /preview", "Disallow: /api/", "", `Sitemap: ${env.siteUrl}/sitemap.xml`, ""].join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
