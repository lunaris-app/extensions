/// <reference path="../../sdk/lunaris.d.ts" />
// Asura Scans, through the JSON API its own site uses (api.asurascans.com).
// Item URLs are API URLs, since titles and chapters are addressed by slug and number there.

const API = "https://api.asurascans.com/api";
const PER_PAGE = 20;

// Premium chapters are paid early access: they have no pages until early_access_until
// passes, and then show up as free.
/** @param {{ is_premium: boolean, early_access_until?: string }} c */
const locked = (c) =>
  c.is_premium || (!!c.early_access_until && Date.parse(c.early_access_until) > Date.now());

/** @param {string} url */
function get(url) {
  const res = fetch(url, { headers: { Accept: "application/json" } });
  if (res.status !== 200) throw new Error(`Asura Scans: HTTP ${res.status}`);
  const body = JSON.parse(res.text);
  // Most endpoints wrap their result in "data"; the series page does so only some of the time.
  return body.data ?? body;
}

extension({
  info: {
    id: "asura-scans",
    name: "Asura Scans",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.6.0",
    api: 1,
    content: "sfw",
    site: "https://asurascans.com",
  },

  search(query, page) {
    const offset = (page - 1) * PER_PAGE;
    const q = query ? `search=${encodeURIComponent(query)}&` : "";
    /** @type {{ slug: string, title: string, cover: string, type: string, author: string }[]} */
    const series = get(`${API}/series?${q}limit=${PER_PAGE}&offset=${offset}`);
    return series.map((s) => ({
      title: s.title,
      url: `${API}/series/${s.slug}/chapters`,
      cover: s.cover,
      kind: /** @type {Kind} */ (s.type),
      author: s.author,
    }));
  },

  chapters(url) {
    /** @type {{ number: number, title?: string, is_premium: boolean, early_access_until?: string, published_at?: string }[]} */
    const chapters = get(url);
    return chapters
      .filter((c) => !locked(c))
      .map((c) => ({
        title: `Chapter ${c.number}${c.title ? `: ${c.title}` : ""}`,
        url: `${url}/${c.number}`,
        date: c.published_at,
      }));
  },

  details(url) {
    /** @type {{ description?: string, genres?: { name: string }[], status: string, author: string, artist: string, alt_titles?: string[], rating: number, bookmark_count: number }} */
    const s = get(url.replace(/\/chapters$/, "")).series;
    return {
      // The API sends HTML: keep its paragraphs as line breaks.
      description: html((s.description ?? "").replace(/<\/p>|<br\s*\/?>/gi, "\n")).text(),
      tags: (s.genres ?? []).map((g) => g.name),
      status: s.status,
      author: s.author,
      artist: s.artist,
      altTitles: s.alt_titles ?? [],
      rating: s.rating,
      bookmarks: s.bookmark_count,
    };
  },

  pages(url) {
    /** @type {{ chapter: { pages?: { url: string }[] } }} */
    const data = get(url);
    // Locked chapters come without pages.
    const pages = data.chapter.pages ?? [];
    if (!pages.length)
      throw new Error("Asura Scans: this chapter is locked (premium or early access)");
    return pages.map((p) => p.url);
  },
});
