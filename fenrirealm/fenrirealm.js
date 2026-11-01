/// <reference path="../lunaris.d.ts" />
// Fenrir Realm, a SvelteKit novel site with a public JSON API for series and chapter lists.
// Chapter text only loads in the page after a Cloudflare Turnstile "confirm you're human"
// check, so text() renders the chapter with verify and reads the reader once it fills in.

const BASE = "https://fenrirealm.com";
const API = `${BASE}/api/new/v2`;

/** @param {string} path */
function api(path) {
  const res = fetch(API + path);
  if (res.status !== 200) throw new Error(`Fenrir Realm: HTTP ${res.status}`);
  return JSON.parse(res.text);
}

/** The series slug from /series/<slug>[/…]. @param {string} url */
function slugOf(url) {
  const m = url.match(/\/series\/([^/?#]+)/);
  if (!m) throw new Error(`Fenrir Realm: not a series URL: ${url}`);
  return m[1];
}

/** @param {string} path */
const asset = (path) => (path.startsWith("http") ? path : `${BASE}/${path}`);

/** @param {{ name: string }[] | undefined} list */
const names = (list) => (list ?? []).map((x) => x.name);

// Runs inside the page (render's script), not in the extension.
/** Resolves with the chapter's HTML once the reader shows it; waits while the user verifies. */
function chapterText() {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (document.querySelector("#unlock-chapter")) {
        observer.disconnect();
        reject(new Error("Fenrir Realm: this chapter must be bought on the site"));
        return;
      }
      const area = document.querySelector('[id^="reader-area-"]');
      if (!area || area.querySelector('[data-testid^="unlock-"]')) return;
      if (/Verifying access/.test(area.textContent ?? "") || !area.querySelector("p")) return;
      observer.disconnect();
      // The text is watermarked: hidden <div>s of random letters between paragraphs, and
      // zero-width characters inside them.
      const text = /** @type {Element} */ (area.cloneNode(true));
      for (const div of text.querySelectorAll(":scope > div")) div.remove();
      resolve(text.innerHTML.replace(/[​-‍⁠﻿]/g, ""));
    };
    const observer = new MutationObserver(check);
    observer.observe(document, { childList: true, subtree: true });
    check();
  });
}

extension({
  info: {
    id: "fenrirealm",
    name: "Fenrir Realm",
    lang: "en",
    kinds: ["novel"],
    version: "1.0.0",
    api: 2,
    content: "sfw",
    site: BASE,
  },

  search(query, page) {
    const q = encodeURIComponent(query.trim());
    /** @type {{ data: { title: string, slug: string, cover?: string, user?: { name: string } }[], meta: { last_page: number } }} */
    const res = api(`/series?page=${page}&per_page=24&search=${q}&sort=popular`);
    if (page > res.meta.last_page) return [];
    return res.data.map((s) => ({
      title: s.title,
      url: `${BASE}/series/${s.slug}`,
      cover: s.cover ? asset(s.cover) : undefined,
      author: s.user?.name,
    }));
  },

  chapters(url) {
    const slug = slugOf(url);
    /** @type {{ slug: string, name: string, title: string | null, locked?: { price: number, unlocked_at: string | null } }[]} */
    const list = api(`/series/${slug}/chapters`);
    const now = Date.now();
    return (
      list
        // Paid chapters can't be read without buying them; some turn free on unlocked_at.
        .filter(
          (c) =>
            !c.locked?.price ||
            (c.locked.unlocked_at != null && Date.parse(c.locked.unlocked_at) <= now),
        )
        .map((c) => {
          // Series fill these in differently: name may be just the number ("Volume 1
          // Chapter 1") or already hold the title, and title may repeat the number.
          const name = c.name.trim();
          const title = (c.title ?? "").trim();
          return {
            title:
              !title || name.includes(title)
                ? name
                : /^chapter\b/i.test(title)
                  ? title
                  : `${name}: ${title}`,
            url: `${BASE}/series/${slug}/${c.slug}`,
          };
        })
        // The API lists oldest first.
        .reverse()
    );
  },

  details(url) {
    /** @type {{ alt_title?: string, status?: string, description?: string, genres?: { name: string }[], tags?: { name: string }[], user?: { name: string }, subscribers?: number }} */
    const s = api(`/series/${slugOf(url)}`);
    return {
      description: (s.description ?? "").trim(),
      tags: [...names(s.genres), ...names(s.tags)],
      status: (s.status ?? "").toLowerCase(),
      author: s.user?.name,
      altTitles: s.alt_title ? [s.alt_title] : [],
      bookmarks: s.subscribers,
    };
  },

  pages() {
    return [];
  },

  text(url) {
    return render(url, { script: `(${chapterText})()`, verify: true });
  },
});
