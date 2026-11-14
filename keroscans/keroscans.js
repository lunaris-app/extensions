/// <reference path="../lunaris.d.ts" />
// KeroScans, a Next.js site with no public API: its pages carry their data in the Next.js
// flight payload (self.__next_f), which this reads instead of the markup. Comics only.
// The site turns away requests that don't come from a browser, so every page goes
// through render().

const BASE = "https://keroscans.net";

// Runs in the page. Next.js empties self.__next_f once it hydrates, so read the payload
// from the inline scripts that pushed it.
const PAYLOAD = String.raw`[...document.querySelectorAll("script:not([src])")].flatMap((s) => [...s.textContent.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1]))).join("")`;

/** The page at path's flight payload, joined into one string. @param {string} path */
function payload(path) {
  const s = render(BASE + path, { script: PAYLOAD });
  if (!s) throw new Error("KeroScans: the page changed (no payload)");
  return s;
}

/** The JSON object or array that starts at s[start]. @param {string} s @param {number} start */
function jsonAt(s, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if ((ch === "}" || ch === "]") && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  throw new Error("KeroScans: the page changed (cut-off data)");
}

/** @param {string} url */
function slugOf(url) {
  const m = url.match(/\/series\/comic\/([^/?#]+)/);
  if (!m) throw new Error(`KeroScans: not a comic URL: ${url}`);
  return m[1];
}

/** @param {string | null | undefined} path */
const abs = (path) => (!path ? undefined : /^https?:/.test(path) ? path : BASE + path);

/** @param {string} type */
const kindOf = (type) => /** @type {Kind} */ (type.toLowerCase());

/** @typedef {{ number: number, title?: string | null, isLocked?: boolean, hasAccess?: boolean, publishedAt?: string | null }} Chapter */

/** The title page's series object, with the chapters on that page. @param {string} slug @param {number} page */
function titlePage(slug, page) {
  const s = payload(`/series/comic/${slug}${page > 1 ? `?page=${page}` : ""}`);
  const at = s.indexOf(`"urlSlug":"${slug}","altTitle"`);
  const start = s.lastIndexOf('{"id":', at);
  if (at < 0 || start < 0) throw new Error("KeroScans: the title page changed");
  /** @type {{ title: string, aliases?: string[], description?: string, status?: string, type: string, rating?: number, bookmarkCount?: number, chapterCount: number, genres?: { name: string }[], tags?: { name: string }[], chapters?: Chapter[] }} */
  const series = jsonAt(s, start);
  // The chapter list sits beside the series, not inside it.
  const list = s.indexOf('"chapters":[', start);
  /** @type {Chapter[]} */
  const chapters = list < 0 ? [] : jsonAt(s, list + '"chapters":'.length);
  return { series, chapters };
}

extension({
  info: {
    id: "keroscans",
    name: "KeroScans",
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.0.1",
    api: 2,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    const s = payload(`/series?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page}`);
    /** @type {{ title: string, url: string, cover?: string, kind: Kind }[]} */
    const results = [];
    const seen = new Set();
    // Each result card's series: {"id":…,"slug":…,"urlSlug":…,"title":…,"coverImage":…,"type":…}
    const re = /\{"id":"[^"]+","slug":"[^"]+","urlSlug":"([^"]+)"/g;
    for (let m = re.exec(s); m; m = re.exec(s)) {
      /** @type {{ urlSlug: string, title: string, coverImage?: string | null, type: string }} */
      const series = jsonAt(s, m.index);
      if (seen.has(series.urlSlug) || series.type === "NOVEL") continue;
      seen.add(series.urlSlug);
      results.push({
        title: series.title,
        url: `${BASE}/series/comic/${series.urlSlug}`,
        cover: abs(series.coverImage),
        kind: kindOf(series.type),
      });
    }
    return results;
  },

  chapters(url) {
    const slug = slugOf(url);
    const first = titlePage(slug, 1);
    const all = [...first.chapters];
    // The page lists 100 chapters, oldest first.
    for (let page = 2; all.length < first.series.chapterCount; page++) {
      const more = titlePage(slug, page).chapters;
      if (!more.length) break;
      all.push(...more);
    }
    return (
      all
        // Coin chapters say isLocked until they turn free; leave them out.
        .filter((c) => !c.isLocked && c.hasAccess !== false)
        .reverse()
        .map((c) => ({
          title: `Chapter ${c.number}${c.title && c.title !== `Chapter ${c.number}` ? `: ${c.title}` : ""}`,
          url: `${BASE}/series/comic/${slug}/chapter/${c.number}`,
          date: c.publishedAt ?? undefined,
        }))
    );
  },

  details(url) {
    const { series: s } = titlePage(slugOf(url), 1);
    return {
      description: (s.description ?? "").replace(/\s*\r?\n\s*/g, "\n").trim(),
      tags: [...(s.genres ?? []), ...(s.tags ?? [])].map((t) => t.name),
      status: (s.status ?? "").toLowerCase(),
      altTitles: s.aliases ?? [],
      rating: s.rating || undefined,
      bookmarks: s.bookmarkCount,
    };
  },

  pages(url) {
    const s = payload(url.replace(/^https?:\/\/[^/]+/, ""));
    const at = s.indexOf('"pages":[{');
    if (at < 0) throw new Error("KeroScans: this chapter is locked or has no pages");
    /** @type {{ imageUrl?: string, kind?: string, isEncrypted?: boolean, isRedacted?: boolean, hasFragments?: boolean, hasStrips?: boolean }[]} */
    const pages = jsonAt(s, at + '"pages":'.length);
    // Scrambled pages need the site's own reader to put them back together.
    if (pages.some((p) => p.isEncrypted || p.isRedacted || p.hasFragments || p.hasStrips))
      throw new Error("KeroScans: this chapter's pages are scrambled; read it on the site");
    const images = pages
      .filter((p) => p.imageUrl)
      .map((p) => /** @type {string} */ (abs(p.imageUrl)));
    if (!images.length) throw new Error("KeroScans: this chapter has no pages");
    return images;
  },
});
