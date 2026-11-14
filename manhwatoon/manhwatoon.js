/// <reference path="../lunaris.d.ts" />
// ManhwaToon, a WordPress site on the Madara theme. Lists and chapters come from its
// HTML; the reader sends plain requests decoy images, so pages go through render().

const BASE = "https://www.manhwatoon.me";

/** @param {string} url @param {FetchOptions} [options] */
function get(url, options) {
  const res = fetch(url, options);
  if (res.status !== 200) throw new Error(`ManhwaToon: HTTP ${res.status}`);
  return html(res.text);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "November 5, 2026", or "2 days ago" for the newest. Relative times count from the start
// of the current unit, so the answer stays the same across refreshes.
/** @param {string} text */
function dateOf(text) {
  const abs = text.trim().match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
  if (abs) {
    const month = MONTHS.indexOf(abs[1].toLowerCase());
    if (month < 0) return undefined;
    return `${abs[3]}-${String(month + 1).padStart(2, "0")}-${abs[2].padStart(2, "0")}`;
  }
  const ago = text.trim().match(/^(\d+)\s*(sec|min|hour|day|week|month|year)s? ago$/i);
  /** @type {Record<string, number>} */
  const units = {
    sec: 1e3,
    min: 6e4,
    hour: 36e5,
    day: 864e5,
    week: 6048e5,
    month: 2592e6,
    year: 31536e6,
  };
  const unit = ago && units[ago[2].toLowerCase()];
  if (!ago || !unit) return undefined;
  return new Date((Math.floor(Date.now() / unit) - Number(ago[1])) * unit).toISOString();
}

/** The title's path, /manhwa/<slug>/, from any of its URLs. @param {string} url */
function titlePath(url) {
  const m = url.match(/\/manhwa\/([^/?#]+)/);
  if (!m) throw new Error(`ManhwaToon: not a title URL: ${url}`);
  return `/manhwa/${m[1]}/`;
}

extension({
  info: {
    id: "manhwatoon",
    name: "ManhwaToon",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.0.0",
    api: 2,
    content: "nsfw",
    site: BASE,
  },

  search(query, page) {
    // Browsing a source searches for nothing: list the most viewed instead.
    const sort = query.trim() ? "" : "&m_orderby=views";
    const prefix = page > 1 ? `/page/${page}` : "";
    const res = fetch(
      `${BASE}${prefix}/?s=${encodeURIComponent(query.trim())}&post_type=wp-manga${sort}`,
    );
    // WordPress answers 404 past the last page.
    if (res.status === 404) return [];
    if (res.status !== 200) throw new Error(`ManhwaToon: HTTP ${res.status}`);
    return html(res.text)
      .select("article.mt-card")
      .map((card) => {
        const link = card.select("h3 a")[0];
        return {
          title: link?.text() ?? "",
          url: link?.attr("href") ?? "",
          cover: card.select("a.mt-cover img")[0]?.attr("src"),
        };
      })
      .filter((t) => t.url);
  },

  chapters(url) {
    const doc = get(`${BASE}${titlePath(url)}ajax/chapters/`, { method: "POST" });
    return (
      doc
        .select("li.wp-manga-chapter")
        // The coin plugin marks paid chapters "premium"; leave them out.
        .filter((li) => !/\bpremium\b/.test(li.attr("class")))
        .map((li) => {
          const a = li.select("a")[0];
          const when = li.select(".chapter-release-date")[0];
          return {
            title: a?.text() ?? "",
            url: a?.attr("href") ?? "",
            // The newest show "2 days ago" as a link title instead of a date.
            date: dateOf(when?.select("a[title]")[0]?.attr("title") || when?.text() || ""),
          };
        })
        .filter((c) => c.url.startsWith("http"))
    );
  },

  details(url) {
    const doc = get(BASE + titlePath(url));
    const rating = Number(doc.select(".mt-detail-rating strong")[0]?.text());
    const alt = (doc.select(".mt-alternative")[0]?.text() ?? "").replace(
      /^\W*Also known as\s*/i,
      "",
    );
    return {
      description: doc
        .select(".summary__content p")
        .map((p) => p.text())
        // The site starts every summary with its own name.
        .filter((p) => p && !/^Read on ManhwaToon$/i.test(p))
        .join("\n"),
      tags: doc.select(".mt-detail-genres a").map((a) => a.text()),
      status: (doc.select(".mt-status-pill")[0]?.text() ?? "").replace(/^\W+/, "").toLowerCase(),
      author: doc
        .select('a[href*="/manhwa-author/"]')
        .map((a) => a.text())
        .join(", "),
      artist: doc
        .select('a[href*="/manhwa-artist/"]')
        .map((a) => a.text())
        .join(", "),
      altTitles: alt ? alt.split(/\s*,\s*/).filter(Boolean) : [],
      // The site rates out of 5.
      rating: rating ? rating * 2 : undefined,
    };
  },

  pages(url) {
    const doc = html(render(url, { waitFor: ".reading-content img" }));
    const images = doc
      .querySelectorAll(".reading-content img")
      .map((img) => (img.getAttribute("data-src") || img.getAttribute("src") || "").trim());
    if (images.some((src) => src.includes("scraper-decoy")))
      throw new Error("ManhwaToon: the site sent placeholder images; try again");
    // The reader opens with the site's own banner; the chapter's images are under WP-manga.
    const pages = images.filter((src) => src.includes("/WP-manga/data/"));
    if (!pages.length) throw new Error("ManhwaToon: this chapter has no pages");
    return pages;
  },
});
