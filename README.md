# Lunaris extensions

The default [Lunaris](https://github.com/lunaris-app/release) extension repo, maintained by
the project. Lunaris lists it under **Extensions > Available**, so there's nothing to add.

| Extension          | Site                                                   | Kinds                 | Notes                                                                                               |
| ------------------ | ------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------- |
| Asura Scans        | [asurascans.com](https://asurascans.com)               | manhwa, manhua, manga |                                                                                                     |
| Asura Scans Novels | [asurascans.com/novels](https://asurascans.com/novels) | novel                 |                                                                                                     |
| Comix              | [comix.to](https://comix.to)                           | manga, manhwa, manhua | Uses `render` (API 2): the site signs and encrypts its API calls                                    |
| Demonic Scans      | [demonicscans.org](https://demonicscans.org)           | manhwa, manhua, manga | Some adult titles                                                                                   |
| Fenrir Realm       | [fenrirealm.com](https://fenrirealm.com)               | novel                 | Chapter text needs a "confirm you're human" check in the Lunaris window; paid chapters are left out |
| Flame Comics       | [flamecomics.xyz](https://flamecomics.xyz)             | manhwa, manhua, manga |                                                                                                     |
| HentaiNexus        | [hentainexus.com](https://hentainexus.com)             | manga                 | Adult                                                                                               |
| HiperDEX           | [hiperdex.com](https://hiperdex.com)                   | manhwa, manhua, manga | Adult                                                                                               |
| MangaFire          | [mangafire.to](https://mangafire.to)                   | manga, manhwa, manhua | Some adult titles                                                                                   |
| Mangak             | [mangak.io](https://mangak.io)                         | manga, manhwa, manhua | Some adult titles                                                                                   |
| Mangakakalot       | [mangakakalot.art](https://www.mangakakalot.art)       | manga, manhwa, manhua | Same platform as MangaNato                                                                          |
| MangaNato          | [manganato.gg](https://www.manganato.gg)               | manga, manhwa, manhua | Search may show a Cloudflare check; search returns one page of results                              |
| NiyaNiya           | [niyaniya.moe](https://niyaniya.moe)                   | manga                 | Adult                                                                                               |

## Working on them

`lunaris.d.ts` and `jsconfig.json` come from the [SDK](https://github.com/lunaris-app/sdk).
Try a function with `lunaris-ext` (it can't run `render` or pass Cloudflare checks; try
those in the app):

```sh
lunaris-ext run manganato/manganato.js chapters '"https://www.manganato.gg/manga/one-piece"'
```

After every change, raise the script's `version` and rebuild the index:

```sh
lunaris-ext index .
```

Pushing to `main` runs `.github/workflows/publish.yml`, which rebuilds `index.json`, signs it
into `index.json.sig` with the `LUNARIS_SIGNING_KEY` secret, and commits both. The app
refuses an index that isn't signed with that key, so never sign it with another one.

`bunx tsc -p jsconfig.json` type-checks the scripts. It reports `document`, `window` and
similar names in the functions that run inside the site's page through `render`; those are
expected.

## Terms

These scripts read public pages the way a browser does. Check each site's terms before
publishing or using them.
