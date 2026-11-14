/// <reference path="../lunaris.d.ts" />
// Omega Scans, through the JSON API its own site uses (api.omegascans.org, HeanCMS).
// Comics only. Title and chapter URLs are the site's own, /series/<slug>[/<chapter>].

const BASE = "https://omegascans.org";
const API = "https://api.omegascans.org";
const PER_PAGE = 20;

/** @param {string} path */
function get(path) {
  const res = fetch(API + path);
  if (res.status !== 200) throw new Error(`Omega Scans: HTTP ${res.status}`);
  return JSON.parse(res.text);
}

/** @param {string} url */
function slugsOf(url) {
  const m = url.match(/\/series\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (!m) throw new Error(`Omega Scans: not a series URL: ${url}`);
  return { series: m[1], chapter: m[2] };
}

extension({
  info: {
    id: "omegascans",
    name: "Omega Scans",
    lang: "en",
    kinds: ["manhwa"],
    version: "1.0.0",
    api: 1,
    content: "nsfw",
    site: BASE,
  },

  search(query, page) {
    // Browsing a source searches for nothing: list the most viewed instead.
    /** @type {{ data: { title: string, series_slug: string, thumbnail: string }[] }} */
    const res = get(
      `/query?query_string=${encodeURIComponent(query.trim())}&series_type=Comic&order=desc&orderBy=total_views&page=${page}&perPage=${PER_PAGE}`,
    );
    return res.data.map((s) => ({
      title: s.title,
      url: `${BASE}/series/${s.series_slug}`,
      cover: s.thumbnail,
    }));
  },

  chapters(url) {
    const { series } = slugsOf(url);
    /** @type {{ id: number }} */
    const { id } = get(`/series/${series}`);
    /** @type {{ chapter_name: string, chapter_title: string | null, chapter_slug: string, price: number, created_at: string }[]} */
    const all = [];
    for (let page = 1; ; page++) {
      /** @type {{ data: typeof all, meta: { last_page: number } }} */
      const res = get(`/chapter/query?series_id=${id}&page=${page}&perPage=500`);
      all.push(...res.data);
      if (page >= res.meta.last_page || !res.data.length) break;
    }
    return (
      all
        // Paid chapters cost coins until they turn free (price 0); leave them out.
        .filter((c) => !c.price)
        .map((c) => ({
          title: `${c.chapter_name}${c.chapter_title ? `: ${c.chapter_title}` : ""}`,
          url: `${BASE}/series/${series}/${c.chapter_slug}`,
          date: c.created_at,
        }))
    );
  },

  details(url) {
    /** @type {{ description?: string, tags?: { name: string }[], status?: string, author?: string, studio?: string, alternative_names?: string, rating?: number }} */
    const s = get(`/series/${slugsOf(url).series}`);
    return {
      // The API sends HTML: keep its paragraphs as line breaks.
      description: html((s.description ?? "").replace(/<\/p>|<br\s*\/?>/gi, "\n"))
        .text()
        .trim(),
      tags: (s.tags ?? []).map((t) => t.name),
      status: (s.status ?? "").toLowerCase(),
      author: s.author,
      artist: s.studio,
      altTitles: (s.alternative_names ?? "").split(/\s*\|\s*/).filter(Boolean),
      // The site rates out of 5.
      rating: s.rating ? s.rating * 2 : undefined,
    };
  },

  pages(url) {
    const { series, chapter } = slugsOf(url);
    if (!chapter) throw new Error(`Omega Scans: not a chapter URL: ${url}`);
    /** @type {{ paywall?: boolean, chapter: { chapter_data?: { images?: string[] } } }} */
    const res = get(`/chapter/${series}/${chapter}`);
    const images = res.chapter.chapter_data?.images ?? [];
    if (!images.length)
      throw new Error(
        `Omega Scans: ${res.paywall ? "this chapter is locked" : "this chapter has no pages"}`,
      );
    return images;
  },
});
