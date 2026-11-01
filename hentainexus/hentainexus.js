/// <reference path="../../sdk/lunaris.d.ts" />
// HentaiNexus: plain HTML pages. Each gallery is one chapter, and the reader page hides its
// image list in initReader("…"), encrypted with the site's own RC4-like cipher (decode below).

const BASE = "https://hentainexus.com";
const HOST = "hentainexus.com";

/** @param {string} url */
function get(url) {
  const res = fetch(url);
  if (res.status !== 200) throw new Error(`HentaiNexus: HTTP ${res.status}`);
  return res.text;
}

/** goja has no atob. @param {string} s */
function atob(s) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let bits = 0;
  let n = 0;
  for (const ch of s.replace(/[^A-Za-z0-9+/]/g, "")) {
    n = (n << 6) | abc.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((n >> bits) & 0xff);
    }
  }
  return out;
}

/** Port of initReader in /static/js/reader.min.js. @param {string} encoded */
function decode(encoded) {
  const data = atob(encoded).split("");
  // The first bytes (up to 64) are XORed with the hostname.
  for (let i = 0; i < Math.min(HOST.length, 64); i++) {
    data[i] = String.fromCharCode(data[i].charCodeAt(0) ^ HOST.charCodeAt(i));
  }
  const d = data.join("");

  // The first 16 primes; a checksum of the 64-byte key picks the step.
  /** @type {boolean[]} */
  const sieve = [];
  const primes = [];
  for (let i = 2; primes.length < 16; i++) {
    if (sieve[i]) continue;
    primes.push(i);
    for (let j = i << 1; j <= 256; j += i) sieve[j] = true;
  }
  let crc = 0;
  for (let i = 0; i < 64; i++) {
    crc ^= d.charCodeAt(i);
    for (let j = 0; j < 8; j++) crc = crc & 1 ? (crc >>> 1) ^ 12 : crc >>> 1;
  }
  const step = primes[crc & 7];

  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + d.charCodeAt(i % 64)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let out = "";
  for (let k = 0, i = 0, j = 0, x = 0, y = 0; k + 64 < d.length; k++) {
    i = (i + step) % 256;
    j = (x + s[(j + s[i]) % 256]) % 256;
    x = (x + i + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    y = s[(j + s[(i + s[(y + x) % 256]) % 256]) % 256];
    out += String.fromCharCode(d.charCodeAt(k + 64) ^ y);
  }
  return JSON.parse(out);
}

/** @param {string} url */
function galleryId(url) {
  const m = url.match(/\/(?:view|read)\/(\d+)/);
  if (!m) throw new Error("HentaiNexus: not a gallery link");
  return m[1];
}

extension({
  info: {
    id: "hentainexus",
    name: "HentaiNexus",
    lang: "en",
    kinds: ["manga"],
    version: "1.0.0",
    api: 1,
    content: "nsfw",
    site: BASE,
  },

  search(query, page) {
    const q = encodeURIComponent(query.trim());
    const doc = html(get(page > 1 ? `${BASE}/page/${page}?q=${q}` : `${BASE}/?q=${q}`));
    return doc.select(".column a[href^='/view/']").map((a) => ({
      title: a.select(".card-header-title")[0]?.text() ?? "",
      url: BASE + a.attr("href"),
      cover: a.select(".card-image img")[0]?.attr("src"),
    }));
  },

  chapters(url) {
    return [{ title: "Chapter 1", url: `${BASE}/read/${galleryId(url)}` }];
  },

  details(url) {
    const doc = html(get(`${BASE}/view/${galleryId(url)}`));
    /** @type {Record<string, any>} */
    const rows = {};
    for (const tr of doc.select("table.view-page-details tr")) {
      const td = tr.select("td");
      if (td.length < 2) continue;
      // Link text ends with a count, "Kizuka Kazuki (28)": drop it.
      const links = td[1].select("a").map((a) => a.text().replace(/\s*\([\d,]+\)$/, ""));
      rows[td[0].text()] = links.length ? links : td[1].text();
    }
    return {
      description: typeof rows.Description === "string" ? rows.Description : "",
      tags: rows.Tags ?? [],
      artist: (rows.Artist ?? []).join(", "),
      author: (rows.Circle ?? rows.Artist ?? []).join(", "),
      bookmarks: Number(String(rows.Favorites ?? "").replace(/,/g, "")) || undefined,
    };
  },

  pages(url) {
    const m = get(`${BASE}/read/${galleryId(url)}`).match(/initReader\("([^"]+)"/);
    if (!m) throw new Error("HentaiNexus: reader data not found");
    /** @type {{ type: string, image_source?: string, image_fallback: string }[]} */
    const data = decode(m[1]);
    const images = data
      .filter((p) => p.type === "image")
      .map((p) => p.image_source ?? p.image_fallback);
    if (!images.length) throw new Error("HentaiNexus: this gallery has no pages");
    return images;
  },
});
