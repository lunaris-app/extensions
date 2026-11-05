/// <reference path="../../sdk/lunaris.d.ts" />
// Demonic Scans, a plain PHP site: search.php is its live search box, title pages list
// every chapter, and chaptered.php has the page images as <img class="imgholder">.

const BASE = "https://demonicscans.org";

/** @param {string} url */
function get(url) {
  const res = fetch(url);
  if (res.status !== 200) throw new Error(`Demonic Scans: HTTP ${res.status}`);
  return html(res.text);
}

/** Paths and image URLs on this site can contain raw spaces. @param {string} src */
function abs(src) {
  const url = /^https?:/.test(src) ? src : `${BASE}/${src.replace(/^\//, "")}`;
  return url.replace(/ /g, "%20");
}

extension({
  info: {
    id: "demonic-scans",
    name: "Demonic Scans",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.2.0",
    api: 1,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    // Browsing a source searches for nothing: list the most read titles instead.
    if (!q) {
      return get(`${BASE}/advanced.php?list=${page}&status=all&orderby=VIEWS%20DESC`)
        .select(".advanced-element > a")
        .map((a) => ({
          title: a.attr("title"),
          url: abs(a.attr("href")),
          cover: abs(a.select("img")[0]?.attr("src") ?? ""),
        }));
    }
    // shortcut: search.php returns one short unpaged list (the site's live search), use advanced.php if it gains a name filter
    if (page > 1) return [];
    const doc = get(`${BASE}/search.php?manga=${encodeURIComponent(q)}`);
    return doc.select("a").map((a) => ({
      title: a.select(".seach-right > div")[0]?.text() ?? "",
      url: abs(a.attr("href")),
      cover: abs(a.select("img")[0]?.attr("src") ?? ""),
    }));
  },

  chapters(url) {
    return get(url)
      .select("#chapters-list a.chplinks")
      .map((a) => {
        const n = a.attr("href").match(/chapter=([\d.]+)/)?.[1];
        return {
          title: n ? `Chapter ${n}` : a.attr("title"),
          url: abs(a.attr("href")),
          date: a.select("span")[0]?.text().trim(),
        };
      });
  },

  details(url) {
    const doc = get(url);
    /** @type {Record<string, string>} */
    const stats = {};
    for (const row of doc.select("#manga-info-stats > div")) {
      const [k, v] = row.select("li").map((li) => li.text());
      if (k) stats[k.toLowerCase()] = v ?? "";
    }
    // The blurb starts with boilerplate that ends in "The Summary is".
    const blurb = (doc.select(".white-font")[0]?.html() ?? "").replace(/<br\s*\/?>/gi, "\n");
    const author = stats.author === "updating" ? "" : stats.author;
    return {
      description: html(blurb.split(/The Summary is/i).pop() ?? "")
        .text()
        .replace(/\n\s*\n+/g, "\n"),
      tags: doc.select(".genres-list li").map((li) => li.text()),
      status: (stats.status ?? "").toLowerCase(),
      author,
    };
  },

  pages(url) {
    const images = get(url)
      .select("img.imgholder")
      .map((i) => i.attr("src"))
      .filter((src) => src.startsWith("http"));
    // Fresh chapters are early access for paying members and show no pages.
    if (!images.length)
      throw new Error("Demonic Scans: this chapter has no pages (it may be early access)");
    return images.map(abs);
  },
});
