/// <reference path="../lunaris.d.ts" />
// Mangakakalot (mangakakalot.art). Search uses the site's own quick-search JSON, chapters
// come from its JSON API, and page images from the arrays the reader page embeds.
// manganato.gg runs the same platform; keep the two scripts in step.

const BASE = "https://www.mangakakalot.art";
const NAME = "Mangakakalot";

/** @param {string} url */
function get(url) {
  const res = fetch(url);
  if (res.status !== 200) throw new Error(`${NAME}: HTTP ${res.status}`);
  return res.text;
}

/** The title's slug from /manga/<slug>[/<chapter>]. @param {string} url */
function slugOf(url) {
  const m = url.match(/\/manga\/([^/?#]+)/);
  if (!m) throw new Error(`${NAME}: not a title URL: ${url}`);
  return m[1];
}

/** The site's own search-word format (see its fsearch.js): lowercase words joined by "_". @param {string} q */
const searchWord = (q) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** @param {string} s */
const stripTags = (s) => s.replace(/<[^>]*>/g, "").trim();

/** A `var name = [...]` array from the reader page. @param {string} page @param {string} name */
function jsArray(page, name) {
  const m = page.match(new RegExp(`var ${name}\\s*=\\s*(\\[[^\\]]*\\])`));
  if (!m) throw new Error(`${NAME}: the reader page changed (no ${name})`);
  return /** @type {string[]} */ (JSON.parse(m[1]));
}

extension({
  info: {
    id: "mangakakalot",
    name: NAME,
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.0.0",
    api: 1,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = searchWord(query);
    if (!q) {
      // Browsing a source searches for nothing: list the hot titles instead.
      return html(get(`${BASE}/manga-list/hot-manga?page=${page}`))
        .select(".list-comic-item-wrap")
        .map((item) => {
          const a = item.select("h3 a")[0];
          return {
            title: a?.text() ?? "",
            url: a?.attr("href") ?? "",
            cover: item.select("img")[0]?.attr("src"),
          };
        });
    }
    // shortcut: the quick search returns one page of results, switch to
    // /search/story/<word>?page=n once its markup has been checked.
    if (page > 1) return [];
    /** @type {{ name: string, url: string, thumb?: string, author?: string }[]} */
    const results = JSON.parse(get(`${BASE}/home/search/json?searchword=${q}`));
    return results.map((r) => ({
      title: stripTags(r.name),
      url: r.url,
      cover: r.thumb,
      author: r.author ? stripTags(r.author) : undefined,
    }));
  },

  chapters(url) {
    const slug = slugOf(url);
    /** @type {{ chapter_name: string, chapter_slug: string }[]} */
    const all = [];
    // The API pages its answer; 500 a request keeps even the longest series to a few.
    for (let offset = 0; ; offset += 500) {
      /** @type {{ data: { chapters: typeof all, pagination: { has_more: boolean } } }} */
      const res = JSON.parse(get(`${BASE}/api/manga/${slug}/chapters?limit=500&offset=${offset}`));
      all.push(...res.data.chapters);
      if (!res.data.pagination?.has_more || !res.data.chapters.length) break;
    }
    return all.map((c) => ({
      title: c.chapter_name,
      url: `${BASE}/manga/${slug}/${c.chapter_slug}`,
    }));
  },

  details(url) {
    const doc = html(get(`${BASE}/manga/${slugOf(url)}`));
    /** @type {Record<string, string>} */
    const info = {};
    for (const li of doc.select(".manga-info-text li")) {
      const m = li.text().match(/^([^:]+?)\s*:\s*(.*)$/s);
      if (m) info[m[1].toLowerCase()] = m[2].trim();
    }
    const alt = doc
      .select(".story-alternative")[0]
      ?.text()
      .replace(/^Alternative\s*:\s*/, "");
    const rating = doc.select(".rating")[0]?.attr("data-default");
    // The summary box starts with a "<title> summary:" heading.
    const box = doc.select("#contentBox")[0];
    const heading = box?.select("h2")[0]?.text() ?? "";
    return {
      description: (box?.text() ?? "")
        .replace(heading, "")
        .replace(/\s*\n\s*/g, "\n")
        .trim(),
      tags: doc.select(".manga-info-text li.genres a").map((a) => a.text()),
      status: (info.status ?? "").toLowerCase(),
      author: info["author(s)"],
      altTitles: alt ? alt.split(/\s*•\s*/).filter(Boolean) : [],
      // The site rates out of 5.
      rating: rating ? Number(rating) * 2 : undefined,
    };
  },

  pages(url) {
    const page = get(url);
    const cdn = jsArray(page, "cdns")[0];
    const images = jsArray(page, "chapterImages");
    if (!cdn || !images.length) throw new Error(`${NAME}: this chapter has no pages`);
    return images.map((path) => (path.startsWith("http") ? path : cdn + path));
  },
});
