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

/** @param {Node} doc @param {string} param the search filter the links set, e.g. "genre" */
const filterLinks = (doc, param) =>
  doc.querySelectorAll(`a[href*="${param}="]`).map((a) => a.text());

extension({
  info: {
    id: "hiperdex",
    name: "HiperDEX",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.0.0",
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
    return page(path, `a[href^="${path}/"]`)
      .querySelectorAll(`a[href^="${path}/"]`)
      .map((a) => ({ title: a.text(), url: abs(a.attr("href")) }));
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
