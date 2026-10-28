// What each injected route needs: the paths to prerender (static routes) and
// the data of the page being rendered (static and on-demand alike). The route
// files in src/routes/static and src/routes/dynamic are thin wrappers around
// these, which keeps the "prerender" export explicit per file (Astro reads it
// from the file, so it cannot vary per injected route of the same component).

import config from "astral:config";
import { fillPattern, listingUrl, pathOf, type Entry, type ListMeta, type Term } from "./astral/index.ts";
import { getEntry, getSingle, getTerm, getTerms, listAll, listPosts, PAGE_SIZE, type Post } from "./cms.ts";
import { t } from "./i18n.ts";
import { pagedUrl, routeOf, type SiteRoute } from "./routes.ts";

type Params = Record<string, string | undefined>;
export type Outcome<T> = { kind: "ok"; props: T } | { kind: "notFound" } | { kind: "redirect"; to: string };

const route = (pattern: string): SiteRoute => {
  const found = routeOf(config, pattern);
  if (!found) throw new Error(`Astral: rota ${pattern} não está na tabela do schema`);
  return found;
};
const typeOf = (apiId: string) => config.types.find((x) => x.apiId === apiId)!;
/** The first taxonomy with an archive URL that classifies a collection. */
const taxonomyOf = (apiId: string) => config.taxonomies.find((x) => x.urlPattern && x.types.includes(apiId))?.apiId ?? "";

// ── Entries ─────────────────────────────────────────────────────────────

export async function entryPaths(pattern: string) {
  const r = route(pattern);
  const type = typeOf(r.type);
  if (type.kind === "SINGLE") return [{ params: {} }];
  const entries = await listAll(r.type, r.locale);
  return entries
    // The CMS decides the URL (the entry with slug "home" is "/"): only entries whose URL is this pattern's.
    .filter((entry) => pathOf(entry.meta.url) === pathOf(fillPattern(type.urlPattern!, { slug: entry.slug ?? entry.id, id: entry.id, locale: r.locale }, config.format)))
    .map((entry) => ({ params: { slug: entry.slug, id: entry.id }, props: { ref: entry.slug ?? entry.id } }));
}

export async function resolveEntry(pattern: string, params: Params, props: { ref?: string }, locals: App.Locals): Promise<{ entry: Entry; locale: string } | null> {
  const r = route(pattern);
  const type = typeOf(r.type);
  const ref = props.ref ?? params.slug ?? params.id ?? "";
  const entry = type.kind === "SINGLE" ? await getSingle(r.type, r.locale) : ref ? await getEntry(r.type, ref, r.locale) : null;
  if (!entry) return null;
  locals.tags.push(`entry:${entry.id}`);
  return { entry, locale: r.locale };
}

// ── Listings ────────────────────────────────────────────────────────────

export type ListingProps = {
  locale: string;
  title: string;
  description?: string | null;
  posts: Post[];
  meta: ListMeta;
  base: string;
  allUrl: string;
  terms: Term[];
  current: Term | null;
  alternates: { locale: string; url: string | null }[];
};

export async function listingPaths(pattern: string) {
  const r = route(pattern);
  if (!r.paged) return [{ params: {} }];
  const { meta } = await listPosts(r.locale, 1);
  return Array.from({ length: Math.max(meta.pageCount - 1, 0) }, (_, i) => ({ params: { page: String(i + 2) } }));
}

export async function resolveListing(pattern: string, params: Params): Promise<Outcome<ListingProps>> {
  const r = route(pattern);
  const type = typeOf(r.type);
  const base = listingUrl(type.urlPattern, r.locale, config.format);
  const page = r.paged ? Number(params.page) : 1;
  if (r.paged && (!Number.isInteger(page) || page < 2)) return { kind: "redirect", to: base };
  const [{ data: posts, meta }, terms] = await Promise.all([listPosts(r.locale, page, undefined, PAGE_SIZE), getTerms(taxonomyOf(r.type), r.locale)]);
  if (page > Math.max(meta.pageCount, 1)) return { kind: "notFound" };
  const alternates = config.format.locales.map((locale) => ({ locale, url: pagedUrl(listingUrl(type.urlPattern, locale, config.format), page, locale) }));
  return { kind: "ok", props: { locale: r.locale, title: t(r.locale).blog, posts, meta, base, allUrl: base, terms, current: null, alternates } };
}

// ── Term archives ───────────────────────────────────────────────────────

export async function termPaths(pattern: string) {
  const r = route(pattern);
  const terms = await getTerms(r.taxonomy!, r.locale);
  if (!r.paged) return terms.map((term) => ({ params: { slug: term.slug } }));
  const paths: { params: { slug: string; page: string } }[] = [];
  for (const term of terms) {
    const { meta } = await listPosts(r.locale, 1, term.id);
    for (let page = 2; page <= meta.pageCount; page++) paths.push({ params: { slug: term.slug, page: String(page) } });
  }
  return paths;
}

export async function resolveTerm(pattern: string, params: Params, locals: App.Locals): Promise<Outcome<ListingProps>> {
  const r = route(pattern);
  const type = typeOf(r.type);
  const slug = params.slug ?? "";
  const term = slug ? await getTerm(r.taxonomy!, slug, r.locale) : null;
  if (!term) return { kind: "notFound" };
  const allUrl = listingUrl(type.urlPattern, r.locale, config.format);
  const base = term.url ?? allUrl;
  const page = r.paged ? Number(params.page) : 1;
  if (r.paged && (!Number.isInteger(page) || page < 2)) return { kind: "redirect", to: base };
  // The term's own slug is the canonical one in this locale: a slug of another locale redirects.
  if (term.slug !== slug) return { kind: "redirect", to: pagedUrl(base, page, r.locale) };
  const [{ data: posts, meta }, terms] = await Promise.all([listPosts(r.locale, page, term.id, PAGE_SIZE), getTerms(r.taxonomy!, r.locale)]);
  if (page > Math.max(meta.pageCount, 1)) return { kind: "notFound" };
  locals.tags.push(`taxonomy:${r.taxonomy}`);
  const alternates = term.meta.alternates.map((a) => ({ locale: a.locale, url: a.url ? pagedUrl(a.url, page, a.locale) : null }));
  return { kind: "ok", props: { locale: r.locale, title: term.name, description: term.description, posts, meta, base, allUrl, terms, current: term, alternates } };
}
