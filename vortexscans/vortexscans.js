/// <reference path="../lunaris.d.ts" />
// Vortex Scans, through the JSON API its own site uses (api.vortexscans.org). Title and
// chapter URLs are the site's own, /series/<slug>[/<chapter>].

const BASE = "https://vortexscans.org";
const API = "https://api.vortexscans.org/api";
const PER_PAGE = 20;

/** @param {string} path */
function get(path) {
  const res = fetch(API + path);
  if (res.status !== 200) throw new Error(`Vortex Scans: HTTP ${res.status}`);
  return JSON.parse(res.text);
}

/** @param {string} url */
function slugsOf(url) {
  const m = url.match(/\/series\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (!m) throw new Error(`Vortex Scans: not a series URL: ${url}`);
  return { series: m[1], chapter: m[2] };
}

/** @typedef {{ id: number, slug: string, postTitle: string, featuredImage?: string, seriesType?: string, author?: string | null }} Post */

extension({
  info: {
    id: "vortexscans",
    name: "Vortex Scans",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.0.0",
    api: 1,
    content: "sfw",
    site: BASE,
  },

  search(query, page) {
    /** @type {{ posts: Post[] }} */
    const res = get(
      `/query?searchTerm=${encodeURIComponent(query.trim())}&page=${page}&perPage=${PER_PAGE}`,
    );
    return res.posts.map((p) => ({
      title: p.postTitle,
      url: `${BASE}/series/${p.slug}`,
      cover: p.featuredImage,
      kind: /** @type {Kind} */ (p.seriesType?.toLowerCase()),
      author: p.author ?? undefined,
    }));
  },

  chapters(url) {
    const { series } = slugsOf(url);
    /** @type {{ post: Post }} */
    const { post } = get(`/post?postSlug=${encodeURIComponent(series)}`);
    /** @type {{ slug: string, number: number, title?: string, createdAt: string, isLocked?: boolean, isAccessible?: boolean }[]} */
    const all = [];
    // The API answers at most 999 a request.
    for (let skip = 0; ; skip += 999) {
      /** @type {{ post: { chapters: typeof all } }} */
      const res = get(`/chapters?postId=${post.id}&skip=${skip}&take=999&order=desc`);
      all.push(...res.post.chapters);
      if (res.post.chapters.length < 999) break;
    }
    return (
      all
        // Coin chapters say isLocked; leave them out.
        .filter((c) => !c.isLocked && c.isAccessible !== false)
        .map((c) => ({
          title: `Chapter ${c.number}${c.title ? `: ${c.title}` : ""}`,
          url: `${BASE}/series/${series}/${c.slug}`,
          date: c.createdAt,
        }))
    );
  },

  details(url) {
    /** @type {{ post: Post & { postContent?: string, genres?: { name: string }[], seriesStatus?: string, artist?: string | null, alternativeTitles?: string | null, averageRating?: number, _count?: { bookmarks?: number } } }} */
    const { post: p } = get(`/post?postSlug=${encodeURIComponent(slugsOf(url).series)}`);
    return {
      // The API sends HTML: keep its paragraphs as line breaks.
      description: html((p.postContent ?? "").replace(/<\/p>|<br\s*\/?>/gi, "\n"))
        .text()
        .trim(),
      tags: (p.genres ?? []).map((g) => g.name),
      status: (p.seriesStatus ?? "").toLowerCase(),
      author: p.author ?? undefined,
      artist: p.artist ?? undefined,
      altTitles: (p.alternativeTitles ?? "")
        .split(/\s*[,|]\s*/)
        .filter((t) => t && t !== p.postTitle),
      rating: p.averageRating || undefined,
      bookmarks: p._count?.bookmarks,
    };
  },

  pages(url) {
    const { series, chapter } = slugsOf(url);
    if (!chapter) throw new Error(`Vortex Scans: not a chapter URL: ${url}`);
    /** @type {{ chapter: { isLocked?: boolean, images?: { url: string, order: number }[] } }} */
    const res = get(
      `/chapter?mangaslug=${encodeURIComponent(series)}&chapterslug=${encodeURIComponent(chapter)}`,
    );
    const images = [...(res.chapter.images ?? [])].sort((a, b) => a.order - b.order);
    if (!images.length)
      throw new Error(
        `Vortex Scans: ${res.chapter.isLocked ? "this chapter is locked" : "this chapter has no pages"}`,
      );
    // The API sometimes doubles the slash after the host.
    return images.map((i) => i.url.replace(/^(https?:\/\/[^/]+)\/+/, "$1/"));
  },
});
