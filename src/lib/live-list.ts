// The island behind <astral-live-list>: fetches the site's own JSON endpoint
// (src/pages/api/astral/posts.ts, which holds the CMS key server-side) and
// rebuilds the cards. Under 1 kB, no framework. The server-rendered list stays
// as it is when the fetch fails, so the page never degrades.

type Card = { url: string | null; title: string; excerpt: string | null; date: string | null; dateLabel: string; category: { name: string; url: string | null } | null; cover: Record<string, string | number> | null };

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const attrs = (cover: Record<string, string | number>) => Object.entries(cover).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");

const card = (post: Card) => `<li><article class="post-card">
  ${post.cover ? `<a class="post-card__media" href="${esc(post.url)}" tabindex="-1" aria-hidden="true"><img ${attrs(post.cover)} loading="lazy" decoding="async" alt=""></a>` : ""}
  <div class="post-card__meta">${post.date ? `<time datetime="${esc(post.date)}">${esc(post.dateLabel)}</time>` : ""}${post.category ? (post.category.url ? `<a href="${esc(post.category.url)}">${esc(post.category.name)}</a>` : `<span>${esc(post.category.name)}</span>`) : ""}</div>
  <h3 class="post-card__title"><a href="${esc(post.url)}">${esc(post.title)}</a></h3>
  ${post.excerpt ? `<p class="post-card__excerpt">${esc(post.excerpt)}</p>` : ""}
</article></li>`;

export function defineLiveList() {
  if (customElements.get("astral-live-list")) return;
  customElements.define(
    "astral-live-list",
    class extends HTMLElement {
      connectedCallback() {
        const url = this.dataset.url;
        if (!url) return;
        this.dataset.state = "loading";
        this.setAttribute("aria-busy", "true");
        fetch(url, { headers: { accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((body: { data: Card[] }) => {
            if (body.data.length) this.innerHTML = `<ul class="post-grid">${body.data.map(card).join("")}</ul>`;
          })
          .catch(() => undefined)
          .finally(() => {
            this.dataset.state = "ready";
            this.removeAttribute("aria-busy");
          });
      }
    },
  );
}
