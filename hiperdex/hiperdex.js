/// <reference path="../../sdk/lunaris.d.ts" />
// HiperDEX, a React app: its pages are empty until its scripts run, and its API wants a key
// hidden in those scripts, so every page goes through render() instead.

const BASE = "https://hiperdex.com";

/** @param {string} path @param {string} waitFor a selector that's there once the page has its content */
function page(path, waitFor) {
  return html(render(BASE + path, { waitFor }));
}

/** @param {string} url */
const pathOf = (url) => url.replace(/^https?:\/\/[^/]+/, "");

/** @param {string} href */
const abs = (href) => (/^https?:/.test(href) ? href : BASE + href);

// The site only says "12h ago", "1w ago" or "11mos ago". Counting from the start of the
// current unit keeps the answer the same across refreshes, so saved chapters don't change.
/** @param {string} text */
function fromAgo(text) {
  const m = text.trim().match(/^(\d+)\s*(mo|[a-z])[a-z]*\s+ago$/i);
  /** @type {Record<string, number>} */
  const units = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, mo: 2592e6, y: 31536e6 };
  const unit = m && units[m[2].toLowerCase()];
  if (!m || !unit) return undefined;
  return new Date((Math.floor(Date.now() / unit) - Number(m[1])) * unit).toISOString();
}

/** @param {Node} doc @param {string} param the search filter the links set, e.g. "genre" */
const filterLinks = (doc, param) =>
  doc.querySelectorAll(`a[href*="${param}="]`).map((a) => a.text());

extension({
  info: {
    id: "hiperdex",
    name: "HiperDEX",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.1.0",
    api: 2,
    content: "nsfw",
    site: BASE,
  },

  search(query, n) {
    const q = query.trim();
    // Browsing a source searches for nothing: list the most popular titles instead.
    const params = q ? `q=${encodeURIComponent(q)}` : "sort=popular";
    // Title links in the result grid; the navbar has none.
    const sel = 'a[href^="/manga/"]:has(img)';
    // Or the "No results found" note, past the last page.
    const doc = page(`/search?${params}&page=${n}`, `${sel}, .opacity-30 + p.font-medium`);
    return doc.querySelectorAll(sel).map((a) => {
      const img = a.querySelector("img");
      return {
        title: img?.getAttribute("alt") ?? a.text(),
        url: abs(a.attr("href")),
        cover: img?.attr("src"),
      };
    });
  },

  chapters(url) {
    const path = pathOf(url);
    // The page lists every chapter, newest first, each linking to /manga/<slug>/<number>.
    const link = `a[href^="${path}/"]`;
    const doc = page(path, link);
    const links = doc.querySelectorAll(link);
    const times = doc.querySelectorAll(`${link} + div span:last-child`);
    return links.map((a, i) => ({
      title: a.text(),
      url: abs(a.attr("href")),
      // Only when every row has one, or dates would land on the wrong chapters.
      date: times.length === links.length ? fromAgo(times[i].text()) : undefined,
    }));
  },

  details(url) {
    const doc = page(pathOf(url), "h1");
    return {
      description: doc.querySelector("p.line-clamp-4")?.text() ?? "",
      tags: filterLinks(doc, "genre"),
      status: (filterLinks(doc, "status")[0] ?? "").toLowerCase(),
      author: filterLinks(doc, "author").join(", "),
      artist: filterLinks(doc, "artist").join(", "),
    };
  },

  pages(url) {
    // The reader also keeps hidden copies of upcoming pages to preload them; skip those.
    const images = page(pathOf(url), "img.block[src^='http']")
      .querySelectorAll("img.block")
      .map((i) => i.attr("src"))
      .filter((src) => src.startsWith("http"));
    if (!images.length) throw new Error("HiperDEX: this chapter has no pages");
    return images;
  },
});
