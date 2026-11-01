// Types for Lunaris extensions, host API 2. Reference this file from your
// script for editor checks; see docs/writing-extensions.md.

type Kind = "manga" | "manhwa" | "manhua" | "novel";

interface Info {
  // Unique and stable: lowercase letters, digits and dashes. Never change it,
  // or installed copies won't update.
  id: string;
  name: string;
  // "en", "ja", … or "multi"
  lang: string;
  kinds: Kind[];
  // Raise it on every release; the app offers an update when it changes.
  version: string;
  // The host API this script was written for: 2 if it uses render() or the
  // DOM names on Node, 1 otherwise.
  api: 1 | 2;
  // Whether the site is safe for work: "mixed" when it has some adult titles,
  // "nsfw" when they're most of it. Lunaris hides NSFW sources unless the
  // user turns them on.
  content: "sfw" | "mixed" | "nsfw";
  // The site it reads. Its icon becomes the extension's icon in Lunaris.
  site?: string;
}

interface Item {
  title: string;
  // Passed back to chapters() or pages(); absolute URLs are safest.
  url: string;
  cover?: string;
  // Titles only. A kind not in info.kinds falls back to the first one there.
  kind?: Kind;
  author?: string;
}

interface Details {
  // Plain text; separate paragraphs with "\n".
  description?: string;
  // Genres and themes, as the source names them.
  tags?: string[];
  // Lowercase, such as "ongoing", "completed", "hiatus" or "cancelled".
  status?: string;
  author?: string;
  artist?: string;
  altTitles?: string[];
  // Out of 10.
  rating?: number;
  // How many people follow it on the source.
  bookmarks?: number;
}

interface Extension {
  info: Info;
  // page starts at 1. Return [] when there are no more results.
  search(query: string, page: number): Item[];
  // Newest chapter first.
  chapters(url: string): Item[];
  // Image URLs of the chapter, in reading order.
  pages(url: string): string[];
  // Optional: more about a title's url from search, fetched when it's opened.
  details?(url: string): Details;
  // Novels: the chapter at url as HTML. Lunaris keeps only basic text tags
  // (p, br, em, strong, headings, lists…) and drops every attribute.
  text?(url: string): string;
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface FetchResponse {
  status: number;
  text: string;
}

interface Node {
  // Descendants matching a CSS selector.
  select(css: string): Node[];
  // Text content, trimmed.
  text(): string;
  // An attribute, or "" when missing.
  attr(name: string): string;
  html(): string;
  // The DOM's names, as in node-html-parser (host API 2).
  // The first descendant matching a CSS selector, or null.
  querySelector(css: string): Node | null;
  querySelectorAll(css: string): Node[];
  // An attribute, or null when missing.
  getAttribute(name: string): string | null;
}

interface RenderOptions {
  // A CSS selector to wait for, for content the site's scripts add after load.
  waitFor?: string;
  // A JavaScript expression run inside the page once it's ready (a promise is
  // awaited); render then returns its result instead of the HTML: a string as
  // is, anything else as JSON. It runs in the site's page, not the extension,
  // so it sees nothing from your script; pass helpers in as source, e.g.
  // `(${fn})(${JSON.stringify(arg)})`. The JSON responses the page gets
  // (from any host) are in window.__lunaris.responses ({ url, text }[]), and
  // "lunaris:response" fires on window for each. Timers fire about once a
  // second in the hidden window: wait on events or a MutationObserver instead.
  script?: string;
  // The page may need the user, e.g. a "verify you're human" check: if it
  // isn't done after 10s the window is shown until render returns, and closing
  // it cancels. Whatever the site saves (cookies, storage, a token) is kept for
  // later renders and restarts, so the user is asked again only when the site asks.
  verify?: boolean;
}

// Registers the extension. Call it exactly once.
declare function extension(e: Extension): void;

// Blocks until the response arrives; Cloudflare checks are handled by the
// app. Throws on network errors, not on error statuses: check status.
declare function fetch(url: string, options?: FetchOptions): FetchResponse;

// Host API 2. Loads url in a hidden browser window and returns the page's HTML
// after its scripts ran, or options.script's result. Slow (seconds): use it only
// when fetch's HTML lacks the content and the site has no usable JSON API.
// Throws if the page isn't ready in 30s.
declare function render(url: string, options?: RenderOptions): string;

declare function html(text: string): Node;
