/// <reference path="../lunaris.d.ts" />
// KeroScans, a server-rendered site with no public API, read from its HTML. Comics only.

const BASE = "https://keroscans.net";

/** @param {string} path */
function page(path) {
  const res = fetch(BASE + path);
  if (res.status !== 200) throw new Error(`KeroScans: HTTP ${res.status}`);
  return html(res.text);
}

/** @param {string} url */
function slugOf(url) {
  const m = url.match(/\/series\/comic\/([^/?#]+)/);
  if (!m) throw new Error(`KeroScans: not a comic URL: ${url}`);
  return m[1];
}

/** @param {string | null | undefined} path */
const abs = (path) => (!path ? undefined : /^https?:/.test(path) ? path : BASE + path);

extension({
  info: {
    id: "keroscans",
    name: "KeroScans",
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.1.0",
    api: 1,
    content: "mixed",
    site: BASE,
  },

  search(query, n) {
    const q = query.trim();
    // Browsing a source searches for nothing: list the whole catalogue instead.
    const doc = page(q ? `/search?q=${encodeURIComponent(q)}&page=${n}` : `/series?page=${n}`);
    return doc.querySelectorAll("article[data-series-id]").flatMap((card) => {
      const a = card.querySelector('a[href^="/series/comic/"]');
      if (!a) return [];
      // The card's first badge is its type: Manga, Manhwa or Manhua.
      const kind = card.querySelector(".ks-badge--overlay")?.text().toLowerCase();
      return [
        {
          title: a.querySelector("h3")?.text() ?? "",
          url: BASE + a.attr("href"),
          cover: abs(a.querySelector("img")?.getAttribute("src")),
          kind: /** @type {Kind | undefined} */ (kind),
        },
      ];
    });
  },

  chapters(url) {
    const slug = slugOf(url);
    /** @type {{ title: string, url: string, date?: string }[]} */
    const all = [];
    // The title page lists 10 chapters at a time, newest first, with a link to the next 10.
    for (let n = 1; n; ) {
      const doc = page(`/series/comic/${slug}${n > 1 ? `?page=${n}` : ""}`);
      for (const row of doc.querySelectorAll("#chapter-list li[data-access]")) {
        // Coin chapters say "paid" until they turn free; leave them out.
        if (row.attr("data-access") !== "free") continue;
        const a = row.querySelector("a[data-chapter-number]");
        if (!a) continue;
        all.push({
          title: `Chapter ${a.attr("data-chapter-number")}`,
          url: BASE + a.attr("href"),
          date: row.querySelector("time")?.getAttribute("datetime") ?? undefined,
        });
      }
      n = Number(doc.querySelector("a[data-chapter-more]")?.attr("data-next-page")) || 0;
    }
    return all;
  },

  details(url) {
    const doc = page(`/series/comic/${slugOf(url)}`);
    const aside = doc.querySelector('aside[aria-label="Series details"]');
    /** @type {Record<string, string>} */
    const facts = {};
    for (const row of aside?.querySelectorAll("dl > div") ?? [])
      facts[row.querySelector("dt")?.text() ?? ""] = row.querySelector("dd")?.text() ?? "";
    const tags = doc.querySelectorAll('ul[aria-label="Genres"] a, ul[aria-label="Tags"] a');
    return {
      description: doc
        .querySelectorAll(".ks-sp__summary p")
        .map((p) => p.text())
        .join("\n"),
      tags: tags.map((a) => a.text().replace(/^#/, "")),
      status: (facts.Status ?? "").toLowerCase(),
      author: facts.Author,
      artist: facts.Artist,
      altTitles: aside?.querySelectorAll("ul li").map((li) => li.text()) ?? [],
      // "Not rated yet" until someone rates it.
      rating: Number.parseFloat(facts.Rating ?? "") || undefined,
    };
  },

  pages(url) {
    const doc = page(url.replace(/^https?:\/\/[^/]+/, ""));
    // A coin chapter shows an unlock form instead of the reader's page list.
    if (!doc.querySelector("ol[data-pages]"))
      throw new Error("KeroScans: this chapter is locked (paid with coins)");
    const images = doc
      .querySelectorAll("ol[data-pages] img")
      .map((img) => /** @type {string} */ (abs(img.getAttribute("src"))))
      .filter(Boolean);
    if (!images.length) throw new Error("KeroScans: this chapter has no pages");
    return images;
  },
});
