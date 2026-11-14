/// <reference path="../lunaris.d.ts" />
// Madara Scans, a WordPress site on the MangaThemesia theme: lists and chapters come from
// its HTML, and page images from the JSON its reader script is started with.

const BASE = "https://madarascans.net";

/** @param {string} url */
function get(url) {
  const res = fetch(url);
  if (res.status !== 200) throw new Error(`Madara Scans: HTTP ${res.status}`);
  return res.text;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "November 3, 2026" as 2026-11-03. @param {string} text */
function dateOf(text) {
  const m = text.trim().match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})$/);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return undefined;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** The "Status", "Author"… rows of the info box. @param {Node} doc */
function infoRows(doc) {
  /** @type {Record<string, string>} */
  const rows = {};
  for (const row of doc.select(".tsinfo .imptdt")) {
    const value = row.select("i, a")[0]?.text() ?? "";
    const label = row.text().replace(value, "").trim().toLowerCase();
    if (label) rows[label] = value.trim();
  }
  return rows;
}

extension({
  info: {
    id: "madarascans",
    name: "Madara Scans",
    lang: "en",
    kinds: ["manhwa", "manhua", "manga"],
    version: "1.0.0",
    api: 1,
    content: "sfw",
    site: BASE,
  },

  search(query, page) {
    const q = query.trim();
    // Browsing a source searches for nothing: list the most popular instead.
    const path = q
      ? `${page > 1 ? `/page/${page}` : ""}/?s=${encodeURIComponent(q)}`
      : `/series/?page=${page}&order=popular`;
    const res = fetch(BASE + path);
    // WordPress answers 404 past the last page.
    if (res.status === 404) return [];
    if (res.status !== 200) throw new Error(`Madara Scans: HTTP ${res.status}`);
    return html(res.text)
      .select(".bs .bsx a")
      .map((a) => ({
        title: a.attr("title") || a.select(".tt")[0]?.text() || "",
        url: a.attr("href"),
        cover: a.select("img")[0]?.attr("src"),
        kind: /** @type {Kind} */ (a.select(".colored")[0]?.text().toLowerCase()),
      }));
  },

  chapters(url) {
    return html(get(url))
      .select("#chapterlist li[data-num]")
      .map((li) => {
        const a = li.select("a")[0];
        return {
          title: li.select(".chapternum")[0]?.text().replace(/\s+/g, " ") ?? "",
          // Locked chapters open a "buy with coins" box instead of linking anywhere.
          url: a && !a.attr("data-coin") ? a.attr("href") : "",
          date: dateOf(li.select(".chapterdate")[0]?.text() ?? ""),
        };
      })
      .filter((c) => c.url.startsWith("http"));
  },

  details(url) {
    const doc = html(get(url));
    const rows = infoRows(doc);
    const alt = doc.select(".alternative")[0]?.text() ?? "";
    return {
      description: doc
        .select(".entry-content-single p")
        .map((p) => p.text())
        .filter(Boolean)
        .join("\n"),
      tags: doc.select(".mgen a").map((a) => a.text()),
      status: (rows.status ?? "").toLowerCase(),
      author: rows.author,
      artist: rows.artist,
      // The box repeats its names, split by "/", commas or runs of whitespace.
      altTitles: [
        ...new Set(
          alt
            .split(/\s*[/,]\s*|\s{2,}/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
    };
  },

  pages(url) {
    // ts_reader.run({...}) on one line, with the images of each server.
    const m = get(url).match(/ts_reader\.run\((\{.*\})\);/);
    if (!m) throw new Error("Madara Scans: the reader page changed");
    /** @type {{ sources: { images: string[] }[] }} */
    const data = JSON.parse(m[1]);
    const images = data.sources[0]?.images ?? [];
    if (!images.length) throw new Error("Madara Scans: this chapter has no pages");
    return images;
  },
});
