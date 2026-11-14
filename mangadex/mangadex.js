/// <reference path="../lunaris.d.ts" />
// MangaDex, through its public API (api.mangadex.org). English chapters only. Item URLs
// are API URLs, since titles and chapters are addressed by id there.

const API = "https://api.mangadex.org";
const PER_PAGE = 20;
// The API's own default ratings; pornographic titles stay out.
const RATINGS = "contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica";

/** @param {string} path */
function get(path) {
  const res = fetch(API + path);
  if (res.status !== 200) throw new Error(`MangaDex: HTTP ${res.status}`);
  return JSON.parse(res.text);
}

/** @param {Record<string, string> | undefined} map */
const en = (map) => (map ? (map.en ?? Object.values(map)[0] ?? "") : "");

/** @param {string} lang the title's original language */
const kindOf = (lang) =>
  /** @type {Kind} */ (lang === "ko" ? "manhwa" : lang?.startsWith("zh") ? "manhua" : "manga");

/** @typedef {{ id: string, type: string, attributes?: Record<string, any> }} Rel */

/** @param {Rel[]} rels @param {string} type */
const names = (rels, type) =>
  rels.filter((r) => r.type === type && r.attributes).map((r) => r.attributes?.name);

/** @param {string} url */
const idOf = (url) => {
  const m = url.match(/\/(?:manga|title|chapter)\/([0-9a-f-]{36})/);
  if (!m) throw new Error(`MangaDex: not a MangaDex URL: ${url}`);
  return m[1];
};

extension({
  info: {
    id: "mangadex",
    name: "MangaDex",
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.0.0",
    api: 1,
    content: "mixed",
    site: "https://mangadex.org",
  },

  search(query, page) {
    const q = query.trim();
    // Browsing a source searches for nothing: list the most followed instead.
    const filter = q
      ? `title=${encodeURIComponent(q)}&order[relevance]=desc`
      : "order[followedCount]=desc";
    const offset = (page - 1) * PER_PAGE;
    // The API refuses offsets past 10,000.
    if (offset >= 10000) return [];
    /** @type {{ data: { id: string, attributes: Record<string, any>, relationships: Rel[] }[] }} */
    const res = get(
      `/manga?${filter}&limit=${PER_PAGE}&offset=${offset}&${RATINGS}&availableTranslatedLanguage[]=en&includes[]=cover_art&includes[]=author`,
    );
    return res.data.map((m) => {
      const cover = m.relationships.find((r) => r.type === "cover_art")?.attributes?.fileName;
      return {
        title: en(m.attributes.title),
        url: `${API}/manga/${m.id}`,
        cover: cover ? `https://uploads.mangadex.org/covers/${m.id}/${cover}.512.jpg` : undefined,
        kind: kindOf(m.attributes.originalLanguage),
        author: names(m.relationships, "author").join(", ") || undefined,
      };
    });
  },

  chapters(url) {
    const id = idOf(url);
    /** @type {{ id: string, attributes: { chapter: string | null, volume: string | null, title: string | null, publishAt: string }, relationships: Rel[] }[]} */
    const all = [];
    // Official chapters that only link out (MangaPlus and the like) and scheduled ones have
    // no pages here: leave them out, like locked chapters.
    for (let offset = 0; ; offset += 500) {
      /** @type {{ data: typeof all, total: number }} */
      const res = get(
        `/manga/${id}/feed?translatedLanguage[]=en&order[chapter]=desc&order[createdAt]=desc&limit=500&offset=${offset}&${RATINGS}&contentRating[]=pornographic&includeExternalUrl=0&includeFuturePublishAt=0&includeEmptyPages=0&includeUnavailable=0&includes[]=scanlation_group`,
      );
      all.push(...res.data);
      if (offset + 500 >= res.total || !res.data.length) break;
    }
    return all.map((c) => {
      const a = c.attributes;
      const group = names(c.relationships, "scanlation_group")[0];
      const number = a.chapter ? `Chapter ${a.chapter}` : "Oneshot";
      return {
        title: `${number}${a.title ? `: ${a.title}` : ""}${group ? ` (${group})` : ""}`,
        url: `${API}/chapter/${c.id}`,
        date: a.publishAt,
      };
    });
  },

  details(url) {
    const id = idOf(url);
    /** @type {{ data: { attributes: Record<string, any>, relationships: Rel[] } }} */
    const { data: m } = get(`/manga/${id}?includes[]=author&includes[]=artist`);
    /** @type {{ statistics: Record<string, { rating?: { bayesian?: number }, follows?: number }> }} */
    const stats = get(`/statistics/manga/${id}`);
    const s = stats.statistics[id] ?? {};
    const a = m.attributes;
    return {
      description: en(a.description).replace(/\r/g, "").trim(),
      tags: a.tags.map((/** @type {{ attributes: { name: Record<string, string> } }} */ t) =>
        en(t.attributes.name),
      ),
      status: a.status,
      author: names(m.relationships, "author").join(", "),
      artist: names(m.relationships, "artist").join(", "),
      altTitles: a.altTitles.map(en).filter(Boolean),
      rating: s.rating?.bayesian || undefined,
      bookmarks: s.follows,
    };
  },

  pages(url) {
    /** @type {{ baseUrl: string, chapter: { hash: string, data: string[] } }} */
    const at = get(`/at-home/server/${idOf(url)}`);
    if (!at.chapter.data.length) throw new Error("MangaDex: this chapter has no pages");
    return at.chapter.data.map((f) => `${at.baseUrl}/data/${at.chapter.hash}/${f}`);
  },
});
