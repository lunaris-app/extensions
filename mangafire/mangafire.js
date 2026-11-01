/// <reference path="../../sdk/lunaris.d.ts" />
// MangaFire, a React app whose API calls are signed per request, so they can't be made
// from here. Pages go through render(): lists come from the page's HTML, and chapters
// and page images from the page's own API answers (window.__lunaris.responses).

const BASE = "https://mangafire.to";

/** @param {string} url */
const pathOf = (url) => url.replace(/^https?:\/\/[^/]+/, "");

// The functions below run inside the page (render's script), not in the extension:
// they can't see anything else in this file, so until is passed in.

/**
 * Resolves with cond()'s first truthy value. Timers fire about once a second in a hidden
 * window, so it checks on page changes and on the page's API answers instead.
 * @template T @param {() => T} cond @param {string} what for the error
 * @returns {Promise<T>}
 */
function until(cond, what) {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => check());
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`MangaFire: ${what} didn't load`));
    }, 15000);
    const stop = () => {
      observer.disconnect();
      removeEventListener("lunaris:response", check);
      clearTimeout(timer);
    };
    const check = () => {
      const v = cond();
      if (v) {
        stop();
        resolve(v);
      }
    };
    observer.observe(document, { childList: true, subtree: true, attributes: true });
    addEventListener("lunaris:response", check);
    check();
  });
}

/** Clicks through the chapter list's pages and returns every chapter. @param {typeof until} wait */
async function allChapters(wait) {
  /** @type {{ url: string, text: string }[]} */
  const responses = /** @type {any} */ (window).__lunaris.responses;
  const lists = () =>
    responses.filter((r) => r.url.includes("/chapters?")).map((r) => JSON.parse(r.text));
  let got = await wait(() => lists().length && lists(), "the chapter list");
  while (got.at(-1).meta.hasNext) {
    const page = got.at(-1).meta.page + 1;
    // The pager hides "Next page" near the end, but always shows the next number.
    const button = await wait(
      () =>
        [...document.querySelectorAll(".npager__num")].find((b) => b.textContent === String(page)),
      `page ${page} of the chapter list`,
    );
    /** @type {HTMLElement} */ (button).click();
    const n = got.length;
    got = await wait(() => lists().length > n && lists(), `page ${page} of the chapter list`);
  }
  return got.flatMap((l) => l.items);
}

/** The image URLs of chapter id, from the reader's own request for it. @param {typeof until} wait @param {string} id */
async function chapterPages(wait, id) {
  /** @type {{ url: string, text: string }[]} */
  const responses = /** @type {any} */ (window).__lunaris.responses;
  const res = await wait(
    () => responses.find((r) => r.url.includes(`/api/chapters/${id}?`)),
    "the chapter",
  );
  return JSON.parse(res.text).data.pages.map((/** @type {{ url: string }} */ p) => p.url);
}

extension({
  info: {
    id: "mangafire",
    name: "MangaFire",
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.0.0",
    api: 2,
    content: "mixed",
    site: BASE,
  },

  search(query, n) {
    const q = query.trim();
    // Browsing a source searches for nothing: list this week's most read instead.
    const params = q
      ? `keyword=${encodeURIComponent(q)}&sort=relevance:desc`
      : "sort=views_7d:desc";
    const sel = '.browse__results a[href^="/title/"]';
    const doc = html(
      render(`${BASE}/browse?${params}&page=${n}`, { waitFor: `${sel}, .browse__empty` }),
    );
    return doc.querySelectorAll(sel).map((a) => {
      const img = a.querySelector("img");
      return {
        title: img?.attr("alt") || a.text(),
        url: BASE + a.attr("href"),
        cover: img?.attr("src"),
        kind: /** @type {Kind} */ (a.querySelector("[data-type]")?.attr("data-type")),
      };
    });
  },

  chapters(url) {
    const path = pathOf(url);
    /** @type {{ id: number, number: number, name: string, type: string }[]} */
    const items = JSON.parse(render(BASE + path, { script: `(${allChapters})(${until})` }));
    const seen = new Set();
    return items
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .map((c) => ({
        // A chapter can come from several groups; the site badges the official one.
        title: `Chapter ${c.number}${c.name ? `: ${c.name}` : ""}${c.type === "official" ? " (official)" : ""}`,
        url: `${BASE}${path}/chapter/${c.id}`,
      }));
  },

  details(url) {
    const doc = html(render(BASE + pathOf(url), { waitFor: ".title-detail__title" }));
    /** @type {Record<string, string>} */
    const credits = {};
    for (const span of doc.querySelectorAll(".title-detail__credits > span")) {
      const m = span.text().match(/^(Author|Artist)s?\s*(.*)$/s);
      if (m) credits[m[1].toLowerCase()] = m[2].trim();
    }
    const status = doc.querySelector(".badge--status")?.text().toLowerCase() ?? "";
    return {
      description: doc.querySelector(".title-detail__synopsis p")?.text() ?? "",
      tags: doc.querySelectorAll(".title-detail__tag").map((a) => a.text()),
      // The site says "releasing" and "finished".
      status: { releasing: "ongoing", finished: "completed" }[status] ?? status,
      author: credits.author,
      artist: credits.artist,
      altTitles: doc.querySelectorAll(".title-detail__alt-line").map((s) => s.text()),
    };
  },

  pages(url) {
    const id = url.match(/\/chapter\/(\d+)/)?.[1];
    if (!id) throw new Error(`MangaFire: not a chapter URL: ${url}`);
    /** @type {string[]} */
    const images = JSON.parse(
      render(BASE + pathOf(url), { script: `(${chapterPages})(${until}, ${JSON.stringify(id)})` }),
    );
    if (!images.length) throw new Error("MangaFire: this chapter has no pages");
    return images;
  },
});
