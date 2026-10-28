// The site's route table, built from the CMS schema at config time
// (src/integration/astral.ts) and read by pages and middleware through the
// virtual module `astral:config`. One route per type, locale and kind.

import { listingPath, listingUrl, renderMode, routePattern, type LocaleFormat, type RenderMode, type Schema, type SchemaTaxonomy, type SchemaType } from "./astral/index.ts";
import { t } from "./i18n.ts";

export type RouteKind = "entry" | "listing" | "term";

export type SiteRoute = {
  /** The Astro pattern ("/en/blog/[slug]"). */
  pattern: string;
  kind: RouteKind;
  /** The content type (for "term" routes: the collection the taxonomy lists). */
  type: string;
  locale: string;
  mode: RenderMode;
  prerender: boolean;
  /** "term" routes: the taxonomy apiId. */
  taxonomy?: string;
  /** Listing and term routes with a [page] parameter. */
  paged?: boolean;
};

export type AstralConfig = {
  format: LocaleFormat;
  routes: SiteRoute[];
  types: SchemaType[];
  taxonomies: SchemaTaxonomy[];
  builtAt: string;
};

const RANK: Record<RenderMode, number> = { static: 0, revalidate: 1, dynamic: 2 };
/** The most demanding of several modes (a listing of static and dynamic types is dynamic). */
export const mostDynamic = (modes: RenderMode[]): RenderMode => modes.reduce((top, m) => (RANK[m] > RANK[top] ? m : top), "static");

const join = (base: string, segment: string) => (base === "/" ? `/${segment}` : `${base}/${segment}`);

/**
 * Every route the site serves for a schema and locale format. Patterns that
 * repeat (the "domain" and "none" formats give every locale the same paths)
 * keep the first locale only: those formats need one build per locale
 * (ASTRAL_BUILD_LOCALES), see the README.
 */
export function buildRoutes(schema: Schema, format: LocaleFormat, locales = format.locales): { routes: SiteRoute[]; dropped: SiteRoute[] } {
  const routes: SiteRoute[] = [];
  const dropped: SiteRoute[] = [];
  const seen = new Set<string>();
  const add = (route: SiteRoute) => {
    if (seen.has(route.pattern)) dropped.push(route);
    else {
      seen.add(route.pattern);
      routes.push(route);
    }
  };
  const routed = schema.types.filter((type) => type.urlPattern);
  for (const locale of locales) {
    const segment = t(locale).pageSegment;
    for (const type of routed) {
      const mode = renderMode(schema, type);
      const prerender = mode === "static";
      add({ pattern: routePattern(type.urlPattern!, locale, format), kind: "entry", type: type.apiId, locale, mode, prerender });
      if (type.kind === "COLLECTION" && listingPath(type.urlPattern) !== "/") {
        const base = listingUrl(type.urlPattern, locale, format).replace(/^https?:\/\/[^/]+/, "") || "/";
        add({ pattern: base, kind: "listing", type: type.apiId, locale, mode, prerender });
        add({ pattern: join(base, `${segment}/[page]`), kind: "listing", type: type.apiId, locale, mode, prerender, paged: true });
      }
    }
    for (const taxonomy of schema.taxonomies.filter((x) => x.urlPattern)) {
      const types = routed.filter((type) => taxonomy.types.includes(type.apiId) && type.kind === "COLLECTION");
      const type = types[0];
      if (!type) continue;
      const mode = mostDynamic(types.map((x) => renderMode(schema, x)));
      const prerender = mode === "static";
      const pattern = routePattern(taxonomy.urlPattern!, locale, format);
      add({ pattern, kind: "term", type: type.apiId, locale, mode, prerender, taxonomy: taxonomy.apiId });
      add({ pattern: join(pattern, `${segment}/[page]`), kind: "term", type: type.apiId, locale, mode, prerender, taxonomy: taxonomy.apiId, paged: true });
    }
  }
  return { routes, dropped };
}

/** The route of an Astro route pattern, or undefined for the site's own pages (404, preview, api). */
export const routeOf = (config: Pick<AstralConfig, "routes">, pattern: string) => config.routes.find((r) => r.pattern === pattern);

/** The URL of page N of a listing or term route ("/blog" for page 1, "/blog/pagina/2" after). */
export function pagedUrl(base: string, page: number, locale: string) {
  return page <= 1 ? base : join(base, `${t(locale).pageSegment}/${page}`);
}
