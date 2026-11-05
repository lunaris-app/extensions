/// <reference path="../../sdk/lunaris.d.ts" />
// Mangak, a Next.js site (the MangaBuddy platform) with a public JSON API at api.mangak.io.
// Title and chapter URLs are the site's canonical ones, /titles/<id>-<slug>/<id>-<slug>,
// so each function gets the ids it needs from the URL in one request.

const BASE = "https://mangak.io";
const API = "https://api.mangak.io";

/** @param {string} path */
function api(path) {
  const res = fetch(`${API}${path}`);
  if (res.status !== 200) throw new Error(`Mangak: HTTP ${res.status}`);
  return JSON.parse(res.text).data;
}

/** The leading ids of /titles/<id>-<slug>[/<id>-<slug>]. @param {string} url */
function ids(url) {
  const m = url.match(/^https?:\/\/[^/]+\/titles\/([^-/]+)[^/]*(?:\/([^-/]+))?/);
  if (!m) throw new Error("Mangak: not a title URL");
  return { title: m[1], chapter: m[2] };
}

/** @typedef {{ name: string }} Named */
/** @param {Named[] | undefined} list */
function names(list) {
  return (list ?? []).map((x) => x.name);
}

extension({
  info: {
    id: "mangak",
    name: "Mangak",
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.2.0",
    api: 1,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    // The API refuses an empty q; without one it lists titles, most viewed first.
    /** @type {{ items: { id: string, slug: string, name: string, cover: string }[] }} */
    const data = api(
      `/titles/search?${q ? `q=${encodeURIComponent(q)}` : "sort=views"}&page=${page}`,
    );
    return data.items.map((t) => ({
      title: t.name,
      url: `${BASE}/titles/${t.id}-${t.slug}`,
      cover: t.cover,
    }));
  },

  chapters(url) {
    const id = ids(url).title;
    /** @type {{ chapters: { id: string, slug: string, name: string, updated_at?: string }[] }} */
    const data = api(`/titles/${id}/chapters`);
    return data.chapters.map((c) => ({
      title: c.name,
      url: `${url.replace(/\/$/, "")}/${c.id}-${c.slug}`,
      date: c.updated_at,
    }));
  },

  details(url) {
    /** @type {{ summary?: string, genres?: Named[], tags?: Named[], status?: string, authors?: Named[], artists?: Named[], alt_names?: Named[], rating?: number, stats?: { bookmarks_count?: number } }} */
    const t = api(`/titles/${ids(url).title}`).title;
    return {
      description: (t.summary ?? "").replace(/\s*\n\s*/g, "\n").trim(),
      tags: names(t.genres),
      status: (t.status ?? "").toLowerCase(),
      author: names(t.authors).join(", "),
      artist: names(t.artists).join(", "),
      altTitles: names(t.alt_names),
      // The site rates out of 5.
      rating: t.rating ? t.rating * 2 : undefined,
      bookmarks: t.stats?.bookmarks_count,
    };
  },

  pages(url) {
    const { title, chapter } = ids(url);
    if (!chapter) throw new Error("Mangak: not a chapter URL");
    /** @type {string[]} */
    const images = api(`/titles/${title}/chapters/${chapter}`).chapter.images ?? [];
    if (!images.length) throw new Error("Mangak: this chapter has no pages");
    return images;
  },
});
