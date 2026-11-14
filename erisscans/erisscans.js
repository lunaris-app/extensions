/// <reference path="../lunaris.d.ts" />
// Eris Scans, on the Keyoapp platform. Its series page lists every title at once and
// filters them in the browser, so search does the same here; chapters and pages come
// from the HTML.

const BASE = "https://erisscans.com";
const PER_PAGE = 30;

/** @param {string} url */
function get(url) {
  const res = fetch(url);
  if (res.status !== 200) throw new Error(`Eris Scans: HTTP ${res.status}`);
  return res.text;
}

/** @param {string} href */
const abs = (href) => (/^https?:/.test(href) ? href : BASE + href);

/** The URL in a style="background-image:url(…)". @param {string} style */
const bgImage = (style) => style.match(/url\(['"]?([^'")]+)/)?.[1];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Mar 20, 2026", or "21 hours ago" for the newest. Relative times count from the start of
// the current unit, so the answer stays the same across refreshes.
/** @param {string} text */
function dateOf(text) {
  const abs = text.trim().match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
  if (abs) {
    const month = MONTHS.indexOf(abs[1].toLowerCase());
    if (month < 0) return undefined;
    return `${abs[3]}-${String(month + 1).padStart(2, "0")}-${abs[2].padStart(2, "0")}`;
  }
  const ago = text.trim().match(/^(\d+|an?)\s*(second|minute|hour|day|week|month|year)s? ago$/i);
  /** @type {Record<string, number>} */
  const units = {
    second: 1e3,
    minute: 6e4,
    hour: 36e5,
    day: 864e5,
    week: 6048e5,
    month: 2592e6,
    year: 31536e6,
  };
  const unit = ago && units[ago[2].toLowerCase()];
  if (!ago || !unit) return undefined;
  const n = /^\d+$/.test(ago[1]) ? Number(ago[1]) : 1;
  return new Date((Math.floor(Date.now() / unit) - n) * unit).toISOString();
}

/** The value beside a label ("Status", "Type") on the title page. @param {string} page @param {string} label */
const labelled = (page, label) =>
  page
    .match(new RegExp(`<span>${label}</span>\\s*</div>\\s*<div[^>]*>\\s*([^<]*?)\\s*</div>`))?.[1]
    ?.trim();

extension({
  info: {
    id: "erisscans",
    name: "Eris Scans",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.0.0",
    api: 1,
    content: "mixed",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim().toLowerCase();
    // shortcut: fetches the whole catalogue (about 2 MB) for every page, ask the site for
    // a search endpoint if that gets slow.
    const matches = html(get(`${BASE}/series/`))
      .select("#searched_series_page > button")
      // The card's title holds the English and the original-language name.
      .filter((b) => b.attr("title").toLowerCase().includes(q));
    return matches.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((b) => {
      const a = b.select("a[href]")[0];
      return {
        title: a?.attr("title") || b.attr("title"),
        url: abs(a?.attr("href") ?? ""),
        cover: bgImage(b.select("[style*=background-image]")[0]?.attr("style") ?? ""),
        kind: /** @type {Kind} */ (b.select("span.capitalize")[0]?.text().trim().toLowerCase()),
      };
    });
  },

  chapters(url) {
    return (
      html(get(url))
        .select("#chapters > a")
        // Locked chapters carry a lock over their thumbnail and a coin price.
        .filter((a) => !a.select('img[src*="lock"]').length)
        .map((a) => ({
          title: a.attr("title") || a.select(".text-sm")[0]?.text().trim() || "",
          url: abs(a.attr("href")),
          date: dateOf(a.select(".text-xs.w-fit")[0]?.text() ?? ""),
        }))
        .filter((c) => c.url !== BASE)
    );
  },

  details(url) {
    const page = get(url);
    const doc = html(page);
    const alt = page.match(/Alternative titles\s*<\/div>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? "";
    return {
      description: doc.select('p[style*="white-space"]')[0]?.text().trim() ?? "",
      tags: doc.select('a[href*="?genre="]').map((a) => a.text().replace(/,$/, "").trim()),
      status: (labelled(page, "Status") ?? "").toLowerCase(),
      altTitles: html(alt)
        .select("span")
        .map((s) => s.text().trim())
        .filter(Boolean),
    };
  },

  pages(url) {
    const page = get(url);
    // The reader builds each image's URL from its uid and a CDN base in its own script.
    const cdn =
      page.match(/realUrl\s*=\s*`([^`$]+)\$\{uid\}`/)?.[1] ?? "https://cdn.meowing.org/uploads/";
    const images = html(page)
      .select("#pages img[uid]")
      .map((img) => cdn + img.attr("uid"));
    if (!images.length) throw new Error("Eris Scans: this chapter is locked or has no pages");
    return images;
  },
});
