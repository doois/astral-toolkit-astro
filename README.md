# Astral toolkit: Astro

Site inicial em [Astro](https://astro.build) para o Astral (CMS headless da Doois):
cliente tipado, blocos, menus, idiomas, imagens responsivas, SEO, JSON-LD, sitemap,
pré-visualização de rascunhos, revalidação por webhook e status de build. É o
ponto de partida de um site novo: o instalador do CMS cria o repositório do site a
partir deste template, aplica o `astral.model.json` ao projeto e preenche o `.env`.

Os outros toolkits (Next, Nuxt, PHP) usam o mesmo modelo, a mesma marcação e o
mesmo CSS ([DESIGN.md](DESIGN.md)); o que está aqui vale para todos.

## O que vem

| Pasta | O quê |
|---|---|
| `astral.model.json` | O modelo do site (componentes, tipos, taxonomia, menus), no formato de proposta do CMS |
| `src/lib/astral/` | O cliente JavaScript do Astral (copiado do repositório do CMS por `npm run toolkits:sync`; não edite aqui) |
| `src/lib/` | `cms.ts` (o que os templates leem, com memo e tags), `cache.ts`, `routes.ts`, `resolve.ts`, `i18n.ts`, `env.ts`, `csp.ts` |
| `src/integration/astral.ts` | Lê o `/schema` do CMS ao carregar a configuração e injeta as rotas |
| `src/blocks/` | Um componente Astro por componente do CMS, mais o `Blocks.astro` que os monta |
| `src/templates/` | Página inicial, página, post, listagem, e o `Entry.astro` que escolhe por tipo |
| `src/routes/` | Os pontos de entrada das rotas injetadas (`static/` pré-renderadas, `dynamic/` sob demanda) |
| `src/pages/` | 404, `sitemap.xml`, `robots.txt`, `preview`, `api/astral/revalidate`, `api/astral/posts` |
| `src/styles/` | Tokens, base, layout e blocos, em CSS puro |
| `astral.convert.md` | O que o conversor de código do CMS pode mudar neste layout (caminhos, blocos, estilos) |
| `scripts/` | `build.mjs` (build com status para o CMS), `seed-demo.mjs` (modelo e conteúdo de demonstração), `demo-assets/` |
| `lighthouserc.json`, `.github/workflows/lighthouse.yml` | Lighthouse CI com mínimo 95 em todas as categorias |

## Configuração

Copie `.env.example` para `.env` e preencha (nunca versione o `.env`):

| Variável | O quê |
|---|---|
| `ASTRAL_URL` | Endereço do CMS, como `https://cms.doois.com.br` |
| `ASTRAL_PROJECT` | Slug do projeto |
| `ASTRAL_TOKEN` | Chave de leitura (`cms_xxxxxxxx_...`), com `entries:*:read`, `entries:*:preview` e `media.read` |
| `ASTRAL_WEBHOOK_SECRET` | Segredo do webhook do projeto que aponta para `<site>/api/astral/revalidate` |
| `ASTRAL_BUILD_WEBHOOK_ID` | Opcional: id desse webhook, para o build reportar o status ao CMS |
| `ASTRAL_MEDIA_URL` | Opcional: host de mídia do CMS (o `MEDIA_URL` dele, como `https://cms-media.doois.com.br`), para a Content-Security-Policy; veja "Segurança" |
| `SITE_URL` | Endereço público do site |
| `ASTRAL_REBUILD_HOOK` | Opcional: URL chamada (POST) quando o site precisa ser reconstruído |
| `ASTRAL_LOCALE_URLS` | Opcional: formato das URLs por idioma (`prefix`, `prefix-all`, `domain`, `none`) só para um CMS antigo que não entregue `localeUrls` no `/schema`; o do CMS sempre vale mais |
| `ASTRAL_BUILD_LOCALES` | Opcional: só estes idiomas neste build (formatos `domain` e `none`, um build por idioma) |

No CMS, em Configurações do projeto: endereço do site (`SITE_URL`) e endereço de
pré-visualização `https://<site>/preview?token={token}`.

```sh
npm install
npm run dev        # http://localhost:4321, lendo o CMS a cada pedido
npm run build      # scripts/build.mjs: astro build + status para o CMS
npm start          # o servidor Node (dist/server/entry.mjs)
npm run check      # tipos
npm run lhci       # Lighthouse CI no build (precisa de um build antes)
```

## Como as rotas e os modos de renderização funcionam

Ao carregar a configuração, `src/integration/astral.ts` lê `GET /api/<projeto>/schema`
e, para cada tipo com `urlPattern` e cada idioma, injeta uma rota no formato de URL do
projeto: `/blog/[slug]` e `/en/blog/[slug]`, a listagem `/blog` com páginas em
`/blog/pagina/[page]` (`/en/blog/page/[page]`), e o arquivo de cada taxonomia com
URL (`/blog/categoria/[slug]`). A tabela de rotas fica no módulo virtual `astral:config`
(idiomas, formato, tipos, taxonomias) e é lida pelas páginas e pelo middleware.

O `render` de cada tipo (opção do tipo no CMS, entregue pelo `/schema`; ausente vale
`static`) decide como as páginas são geradas:

| `render` | No Astro | Quando o conteúdo muda |
|---|---|---|
| `static` | pré-renderada no build (`src/routes/static/*`) | o webhook pede um rebuild (`ASTRAL_REBUILD_HOOK`) |
| `revalidate` | rota sob demanda (`src/routes/dynamic/*`); o HTML fica em memória no Node e vai com `Cache-Control: public, s-maxage=1 ano, stale-while-revalidate` e `Cache-Tag` | o webhook apaga só os caminhos e tags do evento; a próxima visita renderiza de novo |
| `dynamic` | rota sob demanda, sem cache em memória, `s-maxage=60` | nada a fazer |

As listagens e arquivos de categoria seguem o modo da coleção (o mais dinâmico, se
uma taxonomia classificar coleções de modos diferentes).

Compromissos, ditos com clareza:

- O Astro lê `export const prerender` do arquivo da rota, e vale para todas as rotas
  daquele arquivo. Por isso há dois conjuntos de pontos de entrada (`static/` e `dynamic/`),
  com a lógica compartilhada em `src/lib/resolve.ts`; a opção `prerender` do `injectRoute`
  sozinha não bastou (quando várias rotas injetadas compartilham um componente sem o
  export, o Astro 7 marca uma delas como sob demanda).
- Uma página `revalidate` não existe como arquivo: ela é gerada na primeira visita depois
  de um deploy ou de uma purga (alguns milissegundos, com o CMS em cache) e fica em memória
  até o próximo evento. Com mais de um container, cada um tem a sua cópia: o cache que
  importa em escala é o do CDN na frente, alimentado pelos cabeçalhos.
- Uma página `static` que embute conteúdo de um tipo `revalidate` (a home com a lista de
  posts) só muda no próximo build. Para mostrar o conteúdo novo antes disso, o bloco
  `postlist` tem a opção `live`: a lista vem do servidor no HTML e um elemento de menos
  de 1 kB busca a versão atual em `/api/astral/posts` (que guarda a chave do CMS no servidor).
  É o único JavaScript do toolkit, e só em páginas com um bloco `live`.
- A tabela de rotas é decidida no build. Um tipo novo com URL, um idioma novo ou um
  `render` diferente pedem um rebuild (o evento `schema.updated` pede um).
- Nos formatos `domain` e `none` todos os idiomas têm os mesmos caminhos: faça um build
  por idioma (`ASTRAL_BUILD_LOCALES=en`), um por domínio. O formato `prefix` (padrão) e
  o `prefix-all` saem num build só.

## Revalidação, purga e rebuild

O CMS chama `POST /api/astral/revalidate` em cada mudança (webhook do projeto com os
eventos de conteúdo, mídia, menus, configurações, taxonomias e schema). O endpoint
confere `x-cms-timestamp` e `x-cms-signature` (HMAC-SHA256 de `timestamp.corpo` com
`ASTRAL_WEBHOOK_SECRET`, janela de 5 minutos) e então:

1. apaga da memória o HTML dos caminhos do evento (`data.paths`) e tudo o que tem uma
   das tags (`data.tags`: `type:post`, `entry:<id>`, `menus`, `settings`, ...);
2. se mudou um tipo `static`, ou algo que toda página usa (menus, configurações, schema,
   taxonomias), chama `ASTRAL_REBUILD_HOOK` (POST com `{ event_type, reason, at }`);
3. no evento `site.rebuild` (botão "Reconstruir site" do painel), chama o hook direto.

A resposta diz o que foi feito: `{ ok, purged, paths, tags, rebuild: "requested" | "no_hook" | "not_needed" | "failed" }`.

Por hospedagem:

- **Container Node**: cache em memória do processo, purgado pelo webhook. Os assets com
  hash (`/_astro/*`) saem com `Cache-Control: immutable` por um ano; o HTML estático sem
  cache no navegador (`max-age=0`), deixando o CDN decidir.
- **CDN na frente (Cloudflare, Bunny)**: as páginas `revalidate` já saem com `s-maxage`
  longo e `Cache-Tag`. Para purgar também no CDN, chame a API de purga dele no mesmo
  ponto em que `requestRebuild` é chamado em `src/pages/api/astral/revalidate.ts`, com os
  mesmos `paths` (purga por URL) ou `tags` (purga por tag, nos planos que têm).
- **Hospedagem estática** (só `dist/client`): nada roda no servidor, então não há
  revalidação, pré-visualização nem ilha `live`. Tudo é `static` e cada publicação é um
  rebuild. Use o webhook com "Agrupar eventos" (60 s) apontando para o hook de deploy do
  host, em vez do endpoint do site.

## Status de build

`npm run build` roda `scripts/build.mjs`: com `ASTRAL_BUILD_WEBHOOK_ID` e
`ASTRAL_WEBHOOK_SECRET` definidos, envia `building` antes do `astro build` e `success`
(com `SITE_URL`) ou `failed` (com o motivo) depois, assinados como um webhook, para
`POST /api/<projeto>/webhooks/<id>/status`. O painel mostra o estado; uma falha avisa
por e-mail quem cuida do site. Sem as variáveis, é só um `astro build`.

## Deploy

### Container Node (Dokploy)

1. Crie a aplicação a partir do repositório (Nixpacks ou o Dockerfile abaixo); comando
   de build `npm ci && npm run build`, comando de start `npm start`, porta `4321`.
2. Variáveis de ambiente: as do `.env.example`. `HOST=0.0.0.0` para o container.
3. `ASTRAL_REBUILD_HOOK` = o webhook de deploy da aplicação no Dokploy. Assim uma
   publicação de conteúdo estático dispara o redeploy, e o build reporta o status ao CMS.
4. No CMS: webhook do projeto para `https://<site>/api/astral/revalidate` com todos os
   eventos de conteúdo; copie o segredo para `ASTRAL_WEBHOOK_SECRET` e o id para
   `ASTRAL_BUILD_WEBHOOK_ID`.

```Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG ASTRAL_URL ASTRAL_MEDIA_URL ASTRAL_PROJECT ASTRAL_TOKEN ASTRAL_WEBHOOK_SECRET ASTRAL_BUILD_WEBHOOK_ID SITE_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV HOST=0.0.0.0 PORT=4321 NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
```

### Hospedagem estática (site todo `static`)

`npm run build` e publique `dist/client`, com o `_headers` (veja "Segurança"), em Cloudflare Pages, Netlify ou nginx com
`try_files $uri $uri/index.html`. As URLs não têm barra no fim e cada página é
`<caminho>/index.html`. O host precisa servir `404.html` para endereços desconhecidos e
tratar os redirecionamentos do CMS (o build gera páginas de `meta refresh` para eles; um
`_redirects` ou regra do host é melhor). Sem servidor, não há `preview`, `revalidate` nem
`api/astral/posts`: deixe todos os tipos em `static` e aponte o webhook do CMS, com
agrupamento de eventos, para o hook de deploy do host.

## Segurança: Content-Security-Policy

`src/lib/csp.ts` monta a política, igual à dos outros toolkits:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: <ASTRAL_URL> <ASTRAL_MEDIA_URL ou https:>; font-src 'self';
connect-src 'self' <ASTRAL_URL>; form-action 'self'; frame-ancestors 'self';
base-uri 'self'; object-src 'none'
```

Como ela chega ao navegador em cada caso:

| Onde | Como |
|---|---|
| Rotas sob demanda (`revalidate`, `dynamic`, `preview`) | Cabeçalho, pelo `src/middleware.ts`, inclusive nas páginas guardadas em memória |
| Páginas pré-renderadas no container Node | Cabeçalho: o middleware o define no build e o `staticHeaders` do adaptador o guarda em `dist/_headers.json` |
| 404 no container Node | `<meta>` no documento: o adaptador lê o `404.html` direto do disco, sem middleware nem `staticHeaders`. Tudo vale, menos `frame-ancestors`, que o navegador ignora em `<meta>` |
| Hospedagem estática | O build grava `dist/client/_headers` (Cloudflare Pages, Netlify) com o valor pronto, somado a um `public/_headers` se existir. Em outro host, copie o valor desse arquivo: no nginx, `add_header Content-Security-Policy "<valor>" always;` |

A política vale no `astro build` e no `npm start`, não no `astro dev` (o Vite injeta scripts
inline). As páginas pré-renderadas guardam o valor do build: `ASTRAL_MEDIA_URL` precisa
estar no build e no container.

- `security: { csp: true }` no `astro.config.mjs` é só a chave que faz o adaptador guardar
  o cabeçalho. O valor é o do middleware, que substitui o do Astro: os hashes de estilo que o
  Astro gera anulariam `'unsafe-inline'` e bloqueariam atributos `style`.
- Nenhum script inline: o JSON-LD é bloco de dados (o `script-src` não o bloqueia) e a ilha
  sai como arquivo em `/_astro`, porque o `assetsInlineLimit` não embute `.js`. Um bloco
  novo com JavaScript usa `<script>` processado pelo Astro, nunca `is:inline` ou `onclick`.
- As imagens vêm do CMS, mas a API não diz qual é o host de mídia. Com `ASTRAL_MEDIA_URL`
  o `img-src` fica fechado nele; sem ela, aceita qualquer `https:` para não quebrar imagem.
  Num CMS sem `MEDIA_URL`, repita o valor de `ASTRAL_URL` para fechar. Imagens externas em
  campos `richtext` (o CMS permite qualquer `src` http/https) só carregam com a variável vazia.
- Vídeos do YouTube ou Vimeo (`frame-src`), `<video>` do CMS (`media-src`) e serviços de
  terceiros (analytics, mapas) precisam da origem acrescentada em `src/lib/csp.ts`.

### Editar no site

O "Editar no site" do CMS abre o rascunho num frame do admin, e um agente dentro da página
acha os campos pelo valor: os templates não precisam de marcação nem de atributos. Só a
pré-visualização muda, as páginas publicadas continuam com a política acima:

- O documento carrega `<script src="<origem do ASTRAL_URL>/live-edit.js" defer></script>`.
  Fora do frame do admin esse script não faz nada. Ele só atende a própria origem, então
  `ASTRAL_URL` precisa ser o endereço em que o admin abre.
- A política ganha a origem do CMS em `script-src` e vira `frame-ancestors 'self' <origem do CMS>`.
  O resto é igual (`src/lib/csp.ts`).
- O toolkit não envia `X-Frame-Options`. Um proxy na frente não pode enviar esse cabeçalho, nem
  somar outra `Content-Security-Policy`, nessas respostas: as políticas se somam e a mais fechada vence.
- Hospedagem estática: sem servidor não há `/preview`, logo não há editar no site. O `_headers` continua só com a política publicada; para editar no site o projeto precisa do container Node.

## Idiomas

O projeto define os idiomas e o formato das URLs (Configurações › Idiomas). O cliente
entrega tudo já nesse formato (`meta.url`, menus, termos, sitemap); o site só precisa
servir as rotas, o que a integração faz. Os textos de interface do próprio site
(paginação, "Ler mais", 404) ficam em `src/lib/i18n.ts`: acrescente um idioma lá quando o
projeto ganhar um. O seletor de idioma usa `meta.alternates` do conteúdo e cai para a
home do idioma quando a página não tem tradução.

## SEO e performance

- `<title>`, descrição, canônica, `hreflang` (com `x-default`), Open Graph e o JSON-LD do
  site (`/jsonld`: Organization e WebSite) em toda página; `BlogPosting` nos posts (do CMS
  quando o tipo tem dados estruturados mapeados, senão montado aqui); `FAQPage` no bloco de
  perguntas.
- `sitemap.xml` vem pronto do CMS (precisa do endereço do site no projeto; sem ele, é
  montado aqui com `SITE_URL`). `robots.txt` bloqueia `/preview` e `/api/`.
- Zero JavaScript por padrão; CSS em um arquivo, embutido no HTML (abaixo de 32 kB);
  fontes auto-hospedadas, só a de texto pré-carregada; imagens com `srcset` do CMS,
  `width`/`height`, a primeira `eager` com `fetchpriority="high"` e as demais `lazy`.
- Lighthouse CI (`lighthouserc.json`): o workflow do GitHub constrói o site com os
  segredos do repositório (`ASTRAL_URL`, `ASTRAL_PROJECT`, `ASTRAL_TOKEN`) e falha abaixo
  de 95 em qualquer categoria.

## Como adicionar um bloco

1. No CMS, crie o componente (por exemplo `pricing`) e acrescente-o à lista de blocos
   dos tipos `home` e `page` (ou edite `astral.model.json` e rode o seed numa instalação nova).
2. Crie `src/blocks/Pricing.astro` recebendo `{ block, locale, index }`; use `index === 0`
   para decidir entre `h1` e `h2`, `Image.astro` para imagens e `set:html` só em campos
   `richtext` (já sanitizados pelo CMS; veja `src/lib/astral/richtext.ts`).
3. Registre em `src/blocks/Blocks.astro` (`pricing: Pricing`) e escreva o CSS em
   `src/styles/blocks.css` seguindo a marcação do [DESIGN.md](DESIGN.md), para os outros
   toolkits poderem copiar.

Um bloco que o site não conhece é ignorado na renderização (com aviso no dev), então
criar o componente no CMS antes do código nunca quebra o build.

## Demonstração

`scripts/seed-demo.mjs` aplica o modelo e um conteúdo fictício (o estúdio "Vértice",
pessoas e clientes inventados, imagens geradas) a um projeto, pelo admin API:

```sh
ASTRAL_ADMIN_API=https://cms.exemplo.com/admin-api \
ASTRAL_ADMIN_EMAIL=... ASTRAL_ADMIN_PASSWORD=... \
ASTRAL_SEED_PROJECT=astral-demo ASTRAL_SEED_SITE_URL=http://localhost:4321 \
node scripts/seed-demo.mjs --write-env .env
```

Cria o projeto se não existir (e remove o modelo padrão do CMS), cria a chave de leitura
e o webhook, e com `--write-env` escreve o `.env` do site. Rodar de novo atualiza em vez
de duplicar; `--prune` remove de um projeto existente o que o modelo não define. Os
segredos só aparecem na criação: o script nunca os imprime.

## Cliente

`src/lib/astral/` é copiado do repositório do CMS (`toolkits/client`, testado lá com
100% de cobertura). `createClient({ url, project, token })` expõe `list`, `listAll`,
`get`, `single`, `menu`, `menus`, `terms`, `term`, `schema`, `sitemap`, `sitemapXml`,
`jsonLd`, `redirects`, `analytics`, `preview`, com erros tipados (`AstralNotFoundError`,
`AstralAuthError`, `AstralHttpError`, `AstralNetworkError`) e nova tentativa em erros de
rede e 5xx. Ajudantes: `renderMode`, `pathOf`, `localeFormat`, `routePattern`,
`localeOfPath`, `imageAttrs`, `verifyWebhook`, `signBody`, `tagsOf`, `pathsOf`.
