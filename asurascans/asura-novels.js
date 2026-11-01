/// <reference path="../../sdk/lunaris.d.ts" />
// Asura Scans light novels, through the JSON API its novel reader uses
// (api.asurascans.com/api/novel-series). Item URLs are API URLs.

const API = "https://api.asurascans.com/api/novel-series";
const PER_PAGE = 20;

/** @param {string} url */
function get(url) {
  const res = fetch(url, { headers: { Accept: "application/json" } });
  if (res.status !== 200) throw new Error(`Asura Scans: HTTP ${res.status}`);
  const body = JSON.parse(res.text);
  // Lists come wrapped in "data"; single novels and chapters don't.
  return body.data ?? body;
}

/** @param {string | undefined} h */
const plain = (h) => html((h ?? "").replace(/<\/p>|<br\s*\/?>/gi, "\n")).text();

extension({
  info: {
    id: "asura-novels",
    name: "Asura Scans Novels",
    lang: "en",
    kinds: ["novel"],
    version: "1.2.0",
    api: 1,
    content: "sfw",
    site: "https://asurascans.com/novels",
  },

  search(query, page) {
    const offset = (page - 1) * PER_PAGE;
    const q = query ? `search=${encodeURIComponent(query)}&` : "";
    /** @type {{ slug: string, title: string, cover_url: string, author: string }[]} */
    const novels = get(`${API}?${q}limit=${PER_PAGE}&offset=${offset}`);
    return novels.map((n) => ({
      title: n.title,
      url: `${API}/${n.slug}`,
      cover: n.cover_url,
      kind: "novel",
      author: n.author,
    }));
  },

  chapters(url) {
    /** @type {{ series: { title: string }, chapters: { number: number, title?: string, is_locked: boolean }[] }} */
    const novel = get(url);
    // Locked chapters cost shards: leave them out. The API lists oldest first.
    return novel.chapters
      .filter((c) => !c.is_locked)
      .reverse()
      .map((c) => ({
        // Many chapters are titled with the novel's own name; that adds nothing.
        title: `Chapter ${c.number}${c.title && c.title !== novel.series.title ? `: ${c.title}` : ""}`,
        url: `${url}/chapter/${c.number}`,
      }));
  },

  details(url) {
    /** @type {{ series: { description?: string, genres?: string[], status: string, author: string, alternative_titles?: string, rating: number, bookmarks: number } }} */
    const { series: s } = get(url);
    return {
      description: plain(s.description),
      tags: s.genres ?? [],
      status: s.status,
      author: s.author,
      altTitles: (s.alternative_titles ?? "")
        .split("•")
        .map((t) => t.trim())
        .filter(Boolean),
      rating: s.rating,
      bookmarks: s.bookmarks,
    };
  },

  pages() {
    return [];
  },

  text(url) {
    /** @type {{ content_html: string | null }} */
    const chapter = get(url);
    if (!chapter.content_html) throw new Error("Asura Scans: this chapter is locked");
    return chapter.content_html;
  },
});
