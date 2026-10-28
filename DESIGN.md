# Design do toolkit Astral

Este documento descreve os tokens e a marcação de cada bloco para que os
toolkits Next, Nuxt e PHP produzam exatamente o mesmo HTML e usem o mesmo CSS
(`src/styles/*.css`, CSS puro, sem Tailwind, sem `!important`). Nomes de
classe são estáveis: mudar um nome aqui é mudar nos quatro toolkits.

## Tokens (`src/styles/tokens.css`)

Um cliente muda a marca editando só esse arquivo.

| Grupo | Tokens | Notas |
|---|---|---|
| Superfícies | `--paper`, `--paper-2`, `--paper-3` | fundo da página, cartões, campos |
| Texto | `--ink`, `--ink-2`, `--ink-3` | principal, secundário, apagado |
| Destaque | `--accent`, `--accent-ink`, `--accent-soft` | uma cor só, usada com parcimônia; `--accent-ink` é o texto sobre ela |
| Linhas | `--line`, `--line-strong` | divisórias e bordas |
| Foco | `--focus` | contorno de `:focus-visible` (2px, offset 3px) |
| Fontes | `--font-text`, `--font-display`, `--font-mono` | Inter (variável, 100 a 900) e Instrument Serif (400, regular e itálico), auto-hospedadas em `public/fonts` |
| Escala | `--text-xs` ... `--text-4xl` | razão 1,25 a partir de 1rem; `xl` em diante são fluidos (`clamp`) |
| Entrelinha | `--leading-tight` 1.08, `--leading-snug` 1.25, `--leading-normal` 1.6 | |
| Tracking | `--tracking-tight` -0.015em (títulos), `--tracking-wide` 0.08em (eyebrow) | |
| Ritmo | `--space-1` (0.25rem) ... `--space-9` (6rem), `--section`, `--gutter` | espaçamentos sempre múltiplos de 0.25rem |
| Layout | `--container` 74rem, `--container-narrow` 44rem, `--measure` 66ch, `--header-height` | |
| Forma | `--radius-sm`, `--radius`, `--radius-lg`, `--radius-full` | |
| Movimento | `--ease`, `--dur` 180ms, `--dur-slow` 320ms | zerados em `prefers-reduced-motion` |

Modo escuro: os mesmos tokens são redefinidos em `@media (prefers-color-scheme: dark)`
(a menos que `<html data-theme="light">`) e em `:root[data-theme="dark"]`. Não há
JavaScript de alternância; um site que quiser um botão só precisa definir `data-theme`.

Contraste: `--ink` sobre `--paper` e `--accent` sobre `--paper` passam de 4.5:1 nos
dois esquemas; `--ink-3` serve a textos auxiliares (acima de 3:1, usar em 14px ou mais).

## Base (`src/styles/base.css`)

- Reset curto, `body` em flex column (o `main` cresce, o rodapé fica no fim).
- `h1` e `h2` usam a serifa de display (`.display` aplica o mesmo a qualquer elemento);
  `h3` e `h4` ficam na fonte de texto, peso 600.
- Utilitários: `.eyebrow`, `.lede`, `.muted`, `.small`, `.container`, `.container--narrow`,
  `.stack`, `.visually-hidden`, `.skip-link`.
- Botões: `.button` (preenchido), `.button--secondary` (contorno), `.button--accent`; links
  com seta: `.arrow-link`.
- Texto rico do CMS: `.prose` (largura `--measure`, títulos, listas, citação, código, tabela).

## Documento

```html
<a class="skip-link" href="#content">Ir para o conteúdo</a>
<header class="site-header"><div class="container site-header__inner">
  <a class="brand" href="/"><img class="brand__logo" ...> ou <span class="brand__mark"></span> + nome</a>
  <nav class="nav" aria-label="Menu">
    <ul class="nav__list"><li><a class="nav__link" aria-current="page">...</a></li></ul>
    <ul class="locale-switch" aria-label="Idioma"><li><a hreflang lang aria-current="true">pt</a></li></ul>
    <details class="nav__toggle"><summary>Menu</summary><div class="nav__panel"><ul class="nav__list">...</ul></div></details>
  </nav>
</div></header>
<div class="preview-banner" role="status">...</div>   <!-- só na pré-visualização -->
<main id="content" tabindex="-1">...</main>
<footer class="site-footer"><div class="container">
  <div class="site-footer__grid"><div class="site-footer__about">...</div><nav><h3/><ul/></nav><div><h3>Social</h3><ul/></div></div>
  <div class="site-footer__bottom"><span>texto do rodapé</span><a>Início</a></div>
</div></footer>
```

O menu mobile é um `<details>`: abre e fecha sem JavaScript (abaixo de 48em).

## Blocos (`src/styles/blocks.css`)

Todo bloco é `<section class="block block-<componente> <componente>" data-block="<key>">`
com um `.container` dentro. O primeiro bloco da página usa `h1` no título; os
demais, `h2` (os templates passam `index`). `.block + .block` remove o espaço
superior, então a seção respira só por baixo.

Cabeçalho opcional de bloco: `<div class="block__head"><h2/><p class="lede"/></div>`
(`.block__head--center` centraliza).

| Componente | Marcação |
|---|---|
| `hero` | `.hero[.hero--center] > .container > .hero__grid[.hero__grid--image] > .hero__content (p.eyebrow, h1.display, p.hero__text, .hero__actions > a.button + a.button.button--secondary) + .hero__media > img` |
| `richtext` | `.richtext[.richtext--wide] > .container[.container--narrow] > .prose` |
| `features` | `.features > .container > .block__head + ul.features__grid.features__grid--{2,3,4} > li.feature (svg.feature__icon, h3, p, a.arrow-link)` |
| `mediatext` | `.mediatext[.mediatext--start] > .container > .mediatext__grid > .mediatext__content (h2, .prose, a.arrow-link) + .mediatext__media > img` |
| `gallery` | `.gallery > .container > .block__head + ul.gallery__grid.gallery__grid--{2,3} > li > figure.gallery__item > img + figcaption` |
| `testimonials` | `.testimonials > .container > .block__head + ul.testimonials__grid > li > figure.testimonial > blockquote + figcaption (img, span > strong + cargo)` |
| `faq` | `.faq > .container > .block__head + .faq__list > details.faq__item > summary + .faq__answer.prose`, mais um `<script type="application/ld+json">` FAQPage |
| `logos` | `.logos > .container > p.logos__title.eyebrow + ul.logos__list > li > img` (alt = nome da empresa) |
| `stats` | `.stats > .container > .block__head + ul.stats__grid > li.stat > span.stat__value + span.stat__label` |
| `cta` | `.cta[.cta--accent] > .container > .cta__box > div (h2, p) + a.button[.button--accent]` |
| `postlist` | `.postlist > .container > .block__head + astral-live-list[data-url] > ul.post-grid > li > article.post-card` + `p.postlist__foot > a.arrow-link` |

Cartão de post (`src/components/PostCard.astro`), usado no bloco e na listagem:

```html
<article class="post-card">
  <a class="post-card__media" href tabindex="-1" aria-hidden="true"><img ...></a>
  <div class="post-card__meta"><time datetime>14 de outubro de 2026</time><a href>Design</a></div>
  <h3 class="post-card__title"><a href>Título</a></h3>
  <p class="post-card__excerpt">Resumo</p>
</article>
```

## Páginas

- Listagem (`/blog`, categoria): `.page-header (p.eyebrow, h1, p.lede)` + `nav.filters > a[aria-current=page]`
  + `ul.post-grid` + `nav.pagination (a[rel=prev], span.pagination__status, a[rel=next])`.
- Post: `article.post > header.post__header (p.eyebrow > a, h1, p.lede.post__lede, .post__byline (img, span, time))`
  + `.post__cover > img` + `.post__body > .prose` + `footer.post__footer > .author-card (img, div > h3 + p)`.
- 404: `.not-found (p.eyebrow, h1, p.lede, p > a...)`.

## Imagens

Toda imagem do CMS sai de `imageAttrs()` (`src/lib/astral/image.ts`): `src` (WebP
otimizado), `srcset` nas larguras do projeto, `sizes` do layout, `width` e `height`
intrínsecos (sem salto de layout), `loading="lazy"` e `decoding="async"`. A primeira
imagem de cada página sai `loading="eager" decoding="sync" fetchpriority="high"`
(contador em `Astro.locals.images`; `priority` força). JPEGs recebem `style="background-color: <cor dominante>"`
enquanto carregam; PNG, WebP e GIF (podem ter transparência) não. Nada sobrepõe a
imagem: sem gradiente, sem blur, sem filtro (exceto a inversão dos logos de clientes e do logo da marca no modo escuro, um padrão razoável para marcas escuras sobre fundo claro; uma marca colorida troca por um logo próprio para o escuro em `Header.astro`).

## Fontes

Três arquivos woff2 (subset latin): `inter-variable.woff2` (texto, pré-carregado no
`<head>`, é o que pinta primeiro), `instrument-serif-400.woff2` e `instrument-serif-400-italic.woff2`
(títulos, `font-display: swap` com fallback de métricas ajustadas, "Instrument Serif Fallback").
