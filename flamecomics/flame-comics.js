/// <reference path="../../sdk/lunaris.d.ts" />
// Flame Comics, a Next.js site: /api/series lists every title, and each series or chapter
// page carries its data as JSON in __NEXT_DATA__.

const BASE = "https://flamecomics.xyz";
const CDN = "https://cdn.flamecomics.xyz/uploads/images/series";

/** @param {string} url */
function get(url) {
  const res = fetch(url);
  if (res.status !== 200) throw new Error(`Flame Comics: HTTP ${res.status}`);
  return res.text;
}

/** @param {string} url */
function pageProps(url) {
  const m = get(url).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Flame Comics: page data not found");
  return JSON.parse(m[1]).props.pageProps;
}

extension({
  info: {
    id: "flame-comics",
    name: "Flame Comics",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.1.0",
    api: 1,
    content: "sfw",
    site: BASE,
  },

  search(query, page) {
    // shortcut: the API has no search or paging, so page 1 filters the whole list (~150 titles), page by slices if it grows into the thousands
    if (page > 1) return [];
    /** @type {{ id: number, label: string, image: string }[]} */
    const series = JSON.parse(get(`${BASE}/api/series`));
    const q = query.trim().toLowerCase();
    return series
      .filter((s) => s.label.toLowerCase().includes(q))
      .map((s) => ({
        title: s.label,
        url: `${BASE}/series/${s.id}`,
        cover: `${CDN}/${s.id}/${s.image}`,
      }));
  },

  chapters(url) {
    /** @type {{ series_id: number, chapter: string, title: string | null, token: string, release_date?: number }[]} */
    const chapters = pageProps(url).chapters;
    return chapters.map((c) => ({
      // "12.00" → "12", "12.50" → "12.5"
      title: `Chapter ${Number(c.chapter)}${c.title ? `: ${c.title}` : ""}`,
      url: `${BASE}/series/${c.series_id}/${c.token}`,
      date: c.release_date ? new Date(c.release_date * 1000).toISOString() : undefined,
    }));
  },

  details(url) {
    /** @type {{ description?: string, tags?: string[], status: string, author?: string[], artist?: string[], altTitles?: string[] }} */
    const s = pageProps(url).series;
    return {
      // The description is HTML: keep its paragraphs as line breaks.
      description: html((s.description ?? "").replace(/<\/p>|<br\s*\/?>/gi, "\n")).text(),
      tags: s.tags ?? [],
      status: s.status.toLowerCase(),
      author: (s.author ?? []).join(", "),
      artist: (s.artist ?? []).join(", "),
      altTitles: (s.altTitles ?? []).map((t) => t.trim()).filter(Boolean),
    };
  },

  pages(url) {
    /** @type {{ series_id: string, token: string, release_date: string, images: Record<string, { name: string }> }} */
    const c = pageProps(url).chapter;
    // Integer keys ("0", "1", …) come back from Object.values in reading order.
    const images = Object.values(c.images ?? {});
    if (!images.length) throw new Error("Flame Comics: this chapter has no pages");
    return images.map((i) => `${CDN}/${c.series_id}/${c.token}/${i.name}?${c.release_date}`);
  },
});
