import type { APIRoute } from "astro";
import config from "astral:config";
import { imageAttrs } from "../../../lib/astral/index.ts";
import { listPosts } from "../../../lib/cms.ts";
import { formatDate } from "../../../lib/i18n.ts";

// Data for the live postlist island: the newest posts as ready-to-render cards.
// The CMS key stays on the server; the browser only ever talks to the site.
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const locale = config.format.locales.includes(url.searchParams.get("locale") ?? "") ? url.searchParams.get("locale")! : config.format.defaultLocale;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 3, 1), 12);
  const category = url.searchParams.get("category")?.trim() || undefined;
  const { data } = await listPosts(locale, 1, category, limit);
  const cards = data.map((post) => {
    const category = post.category?.[0] ?? null;
    const cover = post.cover ? imageAttrs(post.cover, { sizes: "(min-width: 64em) 24rem, (min-width: 40em) 50vw, 100vw", alt: "" }) : null;
    return {
      url: post.meta.url,
      title: post.title,
      excerpt: post.excerpt,
      date: post.date,
      dateLabel: formatDate(post.date, locale),
      category: category ? { name: category.name, url: category.url } : null,
      cover: cover ? { src: cover.src, ...(cover.srcset ? { srcset: cover.srcset, sizes: cover.sizes } : {}), ...(cover.width ? { width: cover.width, height: cover.height } : {}), ...(cover.style ? { style: cover.style } : {}) } : null,
    };
  });
  return Response.json({ data: cards }, { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600" } });
};
