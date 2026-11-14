/// <reference path="../lunaris.d.ts" />
// Paradise Scans, BL manhwa and novels, through the JSON API its own site uses
// (paradisescans.com/api). Chapter URLs are API URLs, since chapters are addressed by id.

const BASE = "https://paradisescans.com";
const API = `${BASE}/api`;
const PER_PAGE = 24;

/** @param {string} path */
function get(path) {
  const res = fetch(API + path, { headers: { Accept: "application/json" } });
  if (res.status !== 200) throw new Error(`Paradise Scans: HTTP ${res.status}`);
  return JSON.parse(res.text);
}

/** @param {string} url */
function slugOf(url) {
  const m = url.match(/\/series\/([^/?#]+)/);
  if (!m) throw new Error(`Paradise Scans: not a series URL: ${url}`);
  return m[1];
}

/** @param {string} url */
function chapterIdOf(url) {
  const m = url.match(/\/api\/chapters\/([^/?#]+)/);
  if (!m) throw new Error(`Paradise Scans: not a chapter URL: ${url}`);
  return m[1];
}

/** @param {string} s */
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

extension({
  info: {
    id: "paradisescans",
    name: "Paradise Scans",
    lang: "en",
    kinds: ["manhwa", "novel"],
    version: "1.0.0",
    api: 1,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    // Browsing a source searches for nothing: list the most viewed instead.
    const filter = q ? `q=${encodeURIComponent(q)}` : "sort=views";
    /** @type {{ data: { slug: string, title: string, cover_url?: string, type: string, author?: string | null }[], meta: { last_page: number } }} */
    const res = get(`/series?${filter}&page=${page}&per_page=${PER_PAGE}`);
    if (page > res.meta.last_page) return [];
    return res.data.map((s) => ({
      title: s.title,
      url: `${BASE}/series/${s.slug}`,
      // Older covers come as site paths.
      cover: s.cover_url && !/^https?:/.test(s.cover_url) ? BASE + s.cover_url : s.cover_url,
      kind: /** @type {Kind} */ (s.type === "novel" ? "novel" : "manhwa"),
      author: s.author ?? undefined,
    }));
  },

  chapters(url) {
    /** @type {{ id: string, number: number, title?: string | null, is_premium?: boolean, price?: number, early_locked?: boolean, created_at: string }[]} */
    const chapters = get(`/series/${slugOf(url)}/chapters`);
    return (
      chapters
        // Premium chapters cost coins and early-access ones aren't out yet; leave them out.
        .filter((c) => !c.is_premium && !c.price && !c.early_locked)
        // The API lists oldest first.
        .reverse()
        .map((c) => ({
          // Many titles are upload file names ("Chapter_001_uu_br_chapter-276730"): skip those.
          title: `Chapter ${c.number}${c.title && !/^chapter[\s_-]*\d/i.test(c.title) && c.title !== String(c.number) ? `: ${c.title}` : ""}`,
          url: `${API}/chapters/${c.id}`,
          date: c.created_at,
        }))
    );
  },

  details(url) {
    /** @type {{ description?: string, genres?: string[], tropes?: string[], status?: string, author?: string | null, artist?: string | null, alternative_titles?: string[], korean_title?: string | null, rating?: number }} */
    const s = get(`/series/${slugOf(url)}`);
    return {
      description: (s.description ?? "").trim(),
      tags: [...(s.genres ?? []), ...(s.tropes ?? [])],
      status: (s.status ?? "").toLowerCase(),
      author: s.author ?? undefined,
      artist: s.artist ?? undefined,
      altTitles: [s.korean_title, ...(s.alternative_titles ?? [])].filter(
        /** @returns {t is string} */ (t) => !!t,
      ),
      rating: s.rating || undefined,
    };
  },

  pages(url) {
    /** @type {{ images?: string[], locked?: boolean }} */
    const c = get(`/chapters/${chapterIdOf(url)}`);
    const images = c.images ?? [];
    if (!images.length)
      throw new Error(
        `Paradise Scans: ${c.locked ? "this chapter is locked" : "this chapter has no pages"}`,
      );
    return images;
  },

  text(url) {
    /** @type {{ content?: string | null, locked?: boolean }} */
    const c = get(`/chapters/${chapterIdOf(url)}`);
    if (!c.content)
      throw new Error(
        `Paradise Scans: ${c.locked ? "this chapter is locked" : "this chapter has no text"}`,
      );
    // The API sends plain text: blank lines split paragraphs.
    return c.content
      .split(/\n\s*\n/)
      .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
      .join("");
  },
});
