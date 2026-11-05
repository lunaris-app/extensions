/// <reference path="../lunaris.d.ts" />
// Comix, a React app on the same engine as MangaFire, but its API calls are signed per
// request and the chapter answers come back encrypted. Search reads the page's own (plain)
// list answer, details the JSON the title page embeds, chapters the rendered list, and
// pages the image URLs the reader keeps in its React props.

const BASE = "https://comix.to";

/** @param {string} url */
const pathOf = (url) => url.replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "");

// The site only says "12h ago", "1w ago" or "11mos ago". Counting from the start of the
// current unit keeps the answer the same across refreshes, so saved chapters don't change.
/** @param {string} text */
function fromAgo(text) {
  const m = text.trim().match(/^(\d+)\s*(mo|[a-z])[a-z]*\s+ago$/i);
  /** @type {Record<string, number>} */
  const units = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, mo: 2592e6, y: 31536e6 };
  const unit = m && units[m[2].toLowerCase()];
  if (!m || !unit) return undefined;
  return new Date((Math.floor(Date.now() / unit) - Number(m[1])) * unit).toISOString();
}

// The functions below run inside the page (render's script), not in the extension:
// they can't see anything else in this file, so until is passed in.

/**
 * Resolves with cond()'s first truthy value. Timers fire about once a second in a hidden
 * window, so it checks on page changes and on the page's API answers instead.
 * @template T @param {() => T | false | 0 | "" | null | undefined} cond @param {string} what for the error
 * @returns {Promise<T>}
 */
function until(cond, what) {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => check());
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`Comix: ${what} didn't load`));
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

/** The browse page's own answer for its result list. @param {typeof until} wait @param {number} page */
async function listAnswer(wait, page) {
  /** @type {{ url: string, text: string }[]} */
  const responses = /** @type {any} */ (window).__lunaris.responses;
  const res = await wait(
    () =>
      responses.find((r) => r.url.includes("/api/v1/manga?") && r.url.includes(`page=${page}&`)),
    "the results",
  );
  return res.text;
}

/**
 * Every row of the chapter list. The list shows 20 rows a page (one per group), too few to
 * click through for long series, so it asks the page's own chapter query for 100 at a
 * time (the API's most) and reads its decrypted answers; if that query can't be found it
 * clicks through the pager instead. @param {typeof until} wait
 */
async function allChapters(wait) {
  const rows = () =>
    [...document.querySelectorAll(".mchap-row")].map((row) => ({
      href: row.querySelector(".mchap-row__primary")?.getAttribute("href") ?? "",
      ch: row.querySelector(".mchap-row__ch")?.textContent?.trim() ?? "",
      name: row.querySelector(".mchap-row__title")?.textContent?.trim() ?? "",
      group: row.querySelector(".mchap-row__group")?.textContent?.trim() ?? "",
      time: row.querySelector(".mchap-row__time")?.textContent?.trim() ?? "",
    }));
  const first = await wait(() => document.querySelector(".mchap-row, .uempty"), "the chapter list");
  if (!first.matches(".mchap-row")) return [];

  // The React Query client, from the providers above the list.
  const key = Object.keys(first).find((k) => k.startsWith("__reactFiber"));
  /** @type {any} */
  let client = null;
  for (let f = key && /** @type {any} */ (first)[key]; f && !client; f = f.return) {
    const v = f.memoizedProps?.client ?? f.memoizedProps?.value;
    if (v?.getQueryCache) client = v;
  }
  /** @type {any} */
  const query = client
    ?.getQueryCache()
    .getAll()
    .find((/** @type {any} */ q) => q.queryKey[1] === "chapters");
  if (query && "limit" in (query.options.queryKey?.[3] ?? {})) {
    // A failed fetch leaves the query stuck, so fail fast instead of retrying.
    query.options.retry = false;
    /** @type {{ href: string, ch: string, name: string, group: string, time: string }[]} */
    const all = [];
    /** @type {string | undefined} */
    let nameKey;
    for (let page = 1; ; page++) {
      // Re-read each time: every render of the list replaces the options.
      Object.assign(query.options.queryKey[3], { page, limit: 100 });
      const data = await query.fetch();
      /** @type {Record<string, any>[]} */
      const items = Object.values(data ?? {}).find(Array.isArray) ?? [];
      for (const item of items) {
        // The answer's field names are minified, so find each field by its shape: the
        // URL starts with /title/, and the group is an object whose name field is also
        // the chapter's name field.
        const values = Object.values(item);
        const href = values.find((v) => typeof v === "string" && v.startsWith("/title/")) ?? "";
        const group = values.find((v) => v && typeof v === "object" && !Array.isArray(v)) ?? {};
        // Learnt from the first row with a group; rows without one have a name too.
        nameKey ??= Object.keys(group).find((k) => typeof group[k] === "string");
        all.push({
          href,
          ch: `Ch.${href.match(/-chapter-([\d.]+)$/)?.[1] ?? ""}`,
          name: (nameKey && typeof item[nameKey] === "string" && item[nameKey]) || "",
          group: (nameKey && typeof group[nameKey] === "string" && group[nameKey]) || "",
          time: values.find((v) => typeof v === "string" && /^\d+\s*[a-z]+ ago$/i.test(v)) ?? "",
        });
      }
      if (items.length < 100) return all;
    }
  }

  let got = rows();
  const all = [...got];
  for (let page = 2; ; page++) {
    // The pager always shows the next number while there is one.
    const button = [...document.querySelectorAll(".npager__num")].find(
      (b) => b.textContent?.trim() === String(page),
    );
    if (!button) break;
    const first = got[0].href;
    /** @type {HTMLElement} */ (button).click();
    got = await wait(() => {
      const r = rows();
      return r.length && r[0].href !== first && r;
    }, `page ${page} of the chapter list`);
    all.push(...got);
  }
  return all;
}

/** The reader's image URLs, read from each page's React props. @param {typeof until} wait */
async function readerPages(wait) {
  const urlOf = (/** @type {Element} */ el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    /** @type {any} */
    let fiber = key && /** @type {any} */ (el)[key];
    for (let i = 0; fiber && i < 4; i++, fiber = fiber.return) {
      const page = fiber.memoizedProps?.page;
      // The props' names are minified, so take the page's URL by its shape.
      const url =
        page && Object.values(page).find((v) => typeof v === "string" && /^https?:\/\//.test(v));
      if (url) return url;
    }
    return "";
  };
  return wait(() => {
    const pages = [...document.querySelectorAll(".rpage-page")];
    const urls = pages.map(urlOf);
    return pages.length && urls.every(Boolean) && urls;
  }, "the chapter's pages");
}

/** @typedef {{ title: string }} Named */
/** @param {Named[] | undefined} list */
const titles = (list) => (list ?? []).map((x) => x.title);

extension({
  info: {
    id: "comix",
    name: "Comix",
    lang: "en",
    kinds: ["manga", "manhwa", "manhua"],
    version: "1.1.0",
    api: 2,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    // Browsing a source searches for nothing: list this week's most read instead.
    const params = q ? `q=${encodeURIComponent(q)}&sort=relevance:desc` : "sort=views_7d:desc";
    const text = render(`${BASE}/browse?${params}&page=${page}`, {
      script: `(${listAnswer})(${until}, ${page})`,
    });
    /** @type {{ result?: { items: { title: string, url: string, type?: string, poster?: { medium?: string } }[] } }} */
    const data = JSON.parse(text);
    if (!data.result) throw new Error("Comix: the site's answer changed");
    return data.result.items.map((m) => ({
      title: m.title,
      url: BASE + m.url,
      cover: m.poster?.medium,
      kind: /** @type {Kind} */ (m.type),
    }));
  },

  chapters(url) {
    /** @type {{ href: string, ch: string, name: string, group: string, time: string }[]} */
    const rows = JSON.parse(render(BASE + pathOf(url), { script: `(${allChapters})(${until})` }));
    const seen = new Set();
    return rows
      .filter((r) => r.href && !seen.has(r.href) && seen.add(r.href))
      .map((r) => {
        const number = r.ch.replace(/^Ch\.\s*/i, "Chapter ");
        return {
          title: `${number}${r.name ? `: ${r.name}` : ""}${r.group ? ` (${r.group})` : ""}`,
          url: BASE + r.href,
          date: fromAgo(r.time),
        };
      });
  },

  details(url) {
    const res = fetch(BASE + pathOf(url));
    if (res.status !== 200) throw new Error(`Comix: HTTP ${res.status}`);
    const json = res.text.match(/<script[^>]*id="initial-data"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!json) throw new Error("Comix: the title page changed");
    /** @type {{ queries: Record<string, any> }} */
    const data = JSON.parse(json);
    const key = Object.keys(data.queries).find((k) => k.startsWith('["manga","detail"'));
    /** @type {{ synopsis?: string, altTitles?: string[], status?: string, genres?: Named[], demographics?: Named[], authors?: Named[], artists?: Named[], ratedAvg?: number, followsTotal?: number }} */
    const m = key ? data.queries[key] : {};
    const status = m.status ?? "";
    return {
      description: (m.synopsis ?? "").replace(/\s*\n\s*/g, "\n").trim(),
      // Its tags run to hundreds per title; genres are the useful part.
      tags: [...titles(m.genres), ...titles(m.demographics)],
      // The site says "releasing" and "finished".
      status: { releasing: "ongoing", finished: "completed" }[status] ?? status,
      author: titles(m.authors).join(", "),
      artist: titles(m.artists).join(", "),
      altTitles: m.altTitles ?? [],
      rating: m.ratedAvg || undefined,
      bookmarks: m.followsTotal,
    };
  },

  pages(url) {
    /** @type {string[]} */
    const images = JSON.parse(render(BASE + pathOf(url), { script: `(${readerPages})(${until})` }));
    if (!images.length) throw new Error("Comix: this chapter has no pages");
    return images;
  },
});
