# astral.convert.md

Read by the CMS's code-conversion job: how this toolkit is laid out and what a
conversion may change. Everything outside the allowed paths is infrastructure
shared by every Astral toolkit and stays as it is.

## Writable paths

- `src/blocks/`
- `src/components/`
- `src/layouts/`
- `src/templates/`
- `src/styles/`
- `public/fonts/`
- `public/favicon.svg`
- `src/lib/i18n.ts`
- `astral.model.json`
- `DESIGN.md`

## Tokens

`src/styles/tokens.css`: every color (light, and dark under
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and
`:root[data-theme="dark"]`), font stacks, type scale (`--text-xs` to `--text-4xl`),
rhythm (`--space-1` to `--space-9`, `--section`, `--gutter`), layout widths, radii
and motion. A re-brand changes this file first; new tokens go here, not inline.
Keep `--ink` on `--paper` and `--accent` on `--paper` at 4.5:1 or more in both schemes.

Styles:

- Global: `src/styles/base.css` (fonts, reset, headings, `.prose`, `.button`,
  `.arrow-link`, `.container`, utilities) and `src/styles/layout.css` (header,
  footer, listing, pagination, post page, 404, preview banner).
- Per block: `src/styles/blocks.css`, one commented section per component, class
  names `.<component>` and `.<component>__part` as listed in `DESIGN.md`.
- All files are imported by `src/styles/index.css`, bundled into one stylesheet
  and inlined in the HTML (keep the total under 32 kB).
- Responsive with `@media (min-width: ...)` in em; motion through `--dur`/`--ease`
  only (they are zero under `prefers-reduced-motion`).

## Blocks

- Templates: `src/blocks/<Name>.astro`, one per CMS component (`hero` is
  `Hero.astro`, `mediatext` is `MediaText.astro`). Props are
  `{ block, locale, index }`: `block` is the delivered component (`block.component`,
  `block.key`, then its fields), `index` is the block's position (`0` gets `h1`, the rest `h2`).
- Registration: `src/blocks/Blocks.astro` holds `REGISTRY`, a map from the
  component apiId to the Astro component. Unregistered components are skipped.
- Images through `src/components/Image.astro` (`media`, `sizes`, optional
  `priority`/`alt`); rich text fields only through `set:html` (the CMS sanitizes
  them); plain `text`/`textarea` fields as text.
- Wrapper: `<section class="block block-<apiId> <apiId>" data-block={block.key}>`
  with a `.container` inside; optional `.block__head` with the title and lede.

Minimal example, `src/blocks/Pricing.astro` for a component `pricing` with
`title` (text) and `plans` (repeatable component with `name`, `price`):

```astro
---
import type { Block } from "../lib/astral/index.ts";

type Props = { block: Block<{ title: string | null; plans: { name: string; price: string }[] | null }>; locale: string; index: number };
const { block, index } = Astro.props;
const Heading = index === 0 ? "h1" : "h2";
---

<section class="block block-pricing pricing" data-block={block.key}>
  <div class="container">
    {block.title && <div class="block__head"><Heading>{block.title}</Heading></div>}
    <ul class="pricing__grid">
      {(block.plans ?? []).map((plan) => (
        <li class="plan"><h3>{plan.name}</h3><span class="plan__price">{plan.price}</span></li>
      ))}
    </ul>
  </div>
</section>
```

Then in `src/blocks/Blocks.astro`: `import Pricing from "./Pricing.astro";` and
`pricing: Pricing,` inside `REGISTRY`; styles under a `/* Pricing */` section of
`src/styles/blocks.css`; the component itself in `astral.model.json` (`components[]`,
and its apiId in the `blocks` field of `home` and `page`); markup noted in `DESIGN.md`.

## Layouts

- `src/layouts/Base.astro`: the document (head with title, description, canonical,
  hreflang, Open Graph, JSON-LD, the stylesheet and the font preload), skip link,
  `<Header>`, the `banner` slot, `<main id="content">`, `<Footer>`. Props:
  `locale`, `title`, `description`, `image`, `canonical`, `alternates`, `noindex`,
  `jsonLd`, `ogType`, `currentPath`.
- Header: `src/components/Header.astro` (brand from `settings.logo`/`siteName`, the
  `header` menu, language switcher, `<details>` mobile menu). Footer:
  `src/components/Footer.astro` (about, the `footer` menu, social links, footer text).
  Both read the CMS through `getSettings`/`getMenu` in `src/lib/cms.ts`.
- Page templates: `src/templates/Home.astro`, `Page.astro`, `Post.astro`,
  `Listing.astro`; `Entry.astro` picks one by `entry.type`. Shared pieces:
  `src/components/PostCard.astro`, `Pagination.astro`, `Icon.astro`.

## Assets

- Fonts: `public/fonts/*.woff2`, declared with `@font-face` at the top of
  `src/styles/base.css`; the text face is preloaded in `Base.astro`
  (`<link rel="preload" href="/fonts/...">`), display faces use `font-display: swap`
  with a metric-matched fallback. Replace the files and the three `@font-face`
  blocks together, and the preload href.
- Logo: comes from the CMS (`settings.logo`, rendered as `<img class="brand__logo">`,
  inverted in dark mode by CSS); without one, `.brand__mark` plus the site name.
  Favicon: `public/favicon.svg`.
- Demo images and content: `scripts/demo-assets/` and `scripts/demo-content.mjs`
  (seed only, not part of the site).

## Pages

Routing and infrastructure the conversion must not touch:

```
src/lib/astral/**          the shared client, synced from the CMS repository
src/lib/cms.ts             loaders, memo and cache tags
src/lib/cache.ts
src/lib/routes.ts          route table
src/lib/resolve.ts
src/lib/env.ts
src/integration/**         schema-driven routing
src/routes/**              static and on-demand entrypoints
src/middleware.ts          revalidate cache
src/pages/**               404, sitemap, robots, preview, api/astral/*
src/env.d.ts
astro.config.mjs
tsconfig.json
package.json, package-lock.json
lighthouserc.json
.github/**
scripts/**
.env, .env.example, .gitignore
```

## Notes

Astro 7 (`output: "static"` + `@astrojs/node`), TypeScript strict, plain CSS
(no Tailwind, no preprocessor, no `!important`), no UI framework, zero
client-side JavaScript except the `postlist` live island. Content comes only
from the Astral delivery API through `src/lib/cms.ts`; field shapes follow
`astral.model.json`.
