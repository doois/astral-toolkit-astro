// Everything the templates read from the CMS goes through here: one client, one
// memo per thing, tagged the way the webhook purges. Field shapes follow
// astral.model.json; narrow them further in your own site if you change the model.

import { createClient, isNotFound, type Block, type Entry, type JsonLd, type ListResult, type Media, type Menu, type Term } from "./astral/index.ts";
import { memo } from "./cache.ts";
import { env } from "./env.ts";

export const cms = createClient({ url: env.url, project: env.project, token: env.token || undefined, retries: 3 });

export type Link = { label: string; url: string; newTab: boolean | null };
export type Settings = Entry<{ siteName: string; logo: Media | null; description: string | null; social: Link[] | null; footerText: string | null; contactEmail: string | null }>;
export type Author = Entry<{ name: string; photo: Media | null; bio: string | null }>;
export type Post = Entry<{ title: string; excerpt: string | null; cover: Media | null; body: string | null; date: string | null; author: Author | null; category: Term[] | null }>;
export type Page = Entry<{ title: string; blocks: Block[] | null }>;
export type Home = Entry<{ blocks: Block[] | null }>;

export const POST_TYPE = "post";
export const CATEGORY = "category";
export const PAGE_SIZE = 9;

/** Settings, or a bare set with the project slug as name while the single is not published. */
export const getSettings = (locale: string) =>
  memo(`settings:${locale}`, ["type:settings", "settings"], () =>
    cms.single<Settings>("settings", { locale }).catch(fallback<Settings>({ id: "single", type: "settings", locale, meta: { url: null, publishedAt: null, updatedAt: new Date(0).toISOString() }, siteName: env.project, logo: null, description: null, social: null, footerText: null, contactEmail: null })),
  );

export const getMenu = (apiId: string, locale: string) => memo(`menu:${apiId}:${locale}`, ["menus", `menu:${apiId}`], () => cms.menu(apiId, locale).catch(fallback<Menu>({ apiId, name: apiId, items: [] })));

export const getSiteJsonLd = () => memo("jsonld", ["settings"], () => cms.jsonLd().catch(() => null as JsonLd | null));

export const getTerms = (taxonomy: string, locale: string) => memo(`terms:${taxonomy}:${locale}`, [`taxonomy:${taxonomy}`], () => cms.terms(taxonomy, locale).catch(fallback<Term[]>([])));

export const getTerm = (taxonomy: string, ref: string, locale: string) => memo(`term:${taxonomy}:${locale}:${ref}`, [`taxonomy:${taxonomy}`], () => cms.term(taxonomy, ref, locale).catch(fallback(null)));

/** One entry by slug or id, or null when it does not exist (a 404), with relations two levels deep. */
export const getEntry = <T extends Record<string, unknown>>(type: string, ref: string, locale: string) => memo(`entry:${type}:${locale}:${ref}`, [`type:${type}`], () => cms.get<T>(type, ref, { locale, populate: 2 }).catch(fallback<Entry<T> | null>(null)));

export const getSingle = <T extends Record<string, unknown>>(type: string, locale: string) => memo(`single:${type}:${locale}`, [`type:${type}`], () => cms.single<T>(type, { locale, populate: 2 }).catch(fallback<Entry<T> | null>(null)));

/** Every entry of a collection in a locale (for getStaticPaths). */
export const listAll = <T extends Record<string, unknown>>(type: string, locale: string) => memo(`all:${type}:${locale}`, [`type:${type}`], () => cms.listAll<T>(type, { locale, populate: 0 }));

/** One page of posts, newest first, optionally inside a category (slug in any locale or id). */
export const listPosts = (locale: string, page = 1, category?: string, pageSize = PAGE_SIZE) =>
  memo(`posts:${locale}:${category ?? ""}:${page}:${pageSize}`, [`type:${POST_TYPE}`], () =>
    cms.list<Post>(POST_TYPE, { locale, page, pageSize, sort: "date:desc", populate: 1, ...(category ? { filter: { [CATEGORY]: category } } : {}) }).catch(fallback<ListResult<Post>>({ data: [], meta: { page: 1, pageSize, offset: 0, total: 0, pageCount: 0 } })),
  );

/** A 404 from the API becomes the fallback; anything else (a bad key, the CMS down) still fails the build or the request. */
function fallback<T>(value: T) {
  return (error: unknown): T => {
    if (isNotFound(error)) return value;
    throw error;
  };
}
