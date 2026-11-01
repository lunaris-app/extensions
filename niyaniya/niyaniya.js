/// <reference path="../../sdk/lunaris.d.ts" />
// NiyaNiya, a Schale Network site. Galleries are one chapter each. Its API
// (api.schale.network) only answers the site's own pages, so every function opens a page
// with render() and reads the page's answer. The images also need a token the site hands
// out after a "verify you're human" check, so pages() renders with verify: the user passes
// the check once in the window Lunaris shows, the site keeps the token in its storage, and
// later reads reuse it until the site asks again. Its image server only answers the site's
// pages too; Lunaris fetches those images from its window by itself.

const BASE = "https://niyaniya.moe";

/** @param {string} url */
function gallery(url) {
  const m = url.match(/\/g\/(\d+)\/([0-9a-f]+)/);
  if (!m) throw new Error(`NiyaNiya: not a gallery URL: ${url}`);
  return { id: m[1], key: m[2] };
}

// Runs inside the page (render's script), not in the extension.
/**
 * The page's own api.schale.network answer whose URL matches pattern, parsed. Waits on
 * the answers as they come instead of on timers, which fire about once a second in a
 * hidden window. ms 0 waits as long as render lets it (the user may be solving the check).
 * @param {string} pattern a RegExp source @param {number} ms
 */
function answer(pattern, ms) {
  /** @type {{ url: string, text: string }[]} */
  const responses = /** @type {any} */ (window).__lunaris.responses;
  const re = new RegExp(pattern);
  return new Promise((resolve, reject) => {
    const timer = ms
      ? setTimeout(() => {
          removeEventListener("lunaris:response", check);
          reject(new Error("NiyaNiya: the site didn't answer"));
        }, ms)
      : 0;
    const check = () => {
      const res = responses.find((r) => re.test(r.url));
      if (!res) return;
      removeEventListener("lunaris:response", check);
      clearTimeout(timer);
      resolve(JSON.parse(res.text));
    };
    addEventListener("lunaris:response", check);
    check();
  });
}

/**
 * Opens path on the site and returns its API answer matching pattern.
 * @param {string} path @param {RegExp} pattern @param {boolean} [verify] the page needs the check
 */
function load(path, pattern, verify = false) {
  const script = `(${answer})(${JSON.stringify(pattern.source)}, ${verify ? 0 : 20000})`;
  return JSON.parse(render(BASE + path, { script, verify }));
}

/** Schale's tag groups (namespace numbers) that read as tags. */
const TAG_GROUPS = [0, 3, 8, 9, 10, 12];

extension({
  info: {
    id: "niyaniya",
    name: "NiyaNiya",
    lang: "en",
    kinds: ["manga"],
    version: "1.0.0",
    api: 2,
    content: "nsfw",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    // Browsing a source searches for nothing: the site then lists the newest galleries.
    const params = [q && `s=${encodeURIComponent(q)}`, page > 1 && `page=${page}`].filter(Boolean);
    /** @type {{ entries?: { id: number, key: string, title: string, thumbnail?: { path: string } }[] }} */
    const data = load(`/browse?${params.join("&")}`, /\/books(\?|$)/);
    return (data.entries ?? []).map((g) => ({
      title: g.title,
      url: `${BASE}/g/${g.id}/${g.key}`,
      cover: g.thumbnail?.path,
    }));
  },

  chapters(url) {
    const { id, key } = gallery(url);
    return [{ title: "Chapter 1", url: `${BASE}/g/${id}/${key}/read/1` }];
  },

  details(url) {
    const { id, key } = gallery(url);
    /** @type {{ tags?: { namespace?: number, name: string }[], statistic?: { favorites?: number } }} */
    const g = load(`/g/${id}/${key}`, new RegExp(`/books/detail/${id}/${key}$`));
    /** @param {number} ns */
    const names = (ns) =>
      (g.tags ?? []).filter((t) => (t.namespace ?? 0) === ns).map((t) => t.name);
    const artists = names(1).join(", ");
    return {
      tags: TAG_GROUPS.flatMap(names),
      author: names(2).join(", ") || artists,
      artist: artists,
      bookmarks: g.statistic?.favorites,
    };
  },

  pages(url) {
    const { id, key } = gallery(url);
    // The reader asks the site for the images with the check's token; the window shows the
    // check if the site wants it.
    /** @type {{ base: string, entries: { path: string }[] }} */
    const data = load(`/g/${id}/${key}/read/1`, new RegExp(`/books/data/${id}/${key}/`), true);
    if (!data.entries?.length) throw new Error("NiyaNiya: this gallery has no pages");
    return data.entries.map((e) => data.base + e.path);
  },
});
