# Lunaris extensions

The default [Lunaris](https://github.com/lunaris-app/release) extension repo, maintained by
the project. Lunaris lists it under **Extensions > Available**, so there's nothing to add.

| Extension          | Site                                                   | Kinds                 | Notes                                                                                               |
| ------------------ | ------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------- |
| Asura Scans        | [asurascans.com](https://asurascans.com)               | manhwa, manhua, manga |                                                                                                     |
| Asura Scans Novels | [asurascans.com/novels](https://asurascans.com/novels) | novel                 |                                                                                                     |
| Comix              | [comix.to](https://comix.to)                           | manga, manhwa, manhua | Uses `render` (API 2): the site signs and encrypts its API calls                                    |
| Demonic Scans      | [demonicscans.org](https://demonicscans.org)           | manhwa, manhua, manga | Some adult titles                                                                                   |
| Eris Scans         | [erisscans.com](https://erisscans.com)                 | manhwa, manhua, manga | Some adult titles; search loads the whole catalogue; locked chapters are left out                   |
| Fenrir Realm       | [fenrirealm.com](https://fenrirealm.com)               | novel                 | Chapter text needs a "confirm you're human" check in the Lunaris window; paid chapters are left out |
| Flame Comics       | [flamecomics.xyz](https://flamecomics.xyz)             | manhwa, manhua, manga |                                                                                                     |
| HentaiNexus        | [hentainexus.com](https://hentainexus.com)             | manga                 | Adult                                                                                               |
| HiperDEX           | [hiperdex.com](https://hiperdex.com)                   | manhwa, manhua, manga | Adult                                                                                               |
| KeroScans          | [keroscans.net](https://keroscans.net)                 | manga, manhwa, manhua | Locked chapters are left out                                                                        |
| Madara Scans       | [madarascans.net](https://madarascans.net)             | manhwa, manhua, manga | Locked chapters are left out                                                                        |
| MangaDex           | [mangadex.org](https://mangadex.org)                   | manga, manhwa, manhua | English only; chapters that only link out (MangaPlus) are left out                                  |
| MangaFire          | [mangafire.to](https://mangafire.to)                   | manga, manhwa, manhua | Some adult titles                                                                                   |
| Mangak             | [mangak.io](https://mangak.io)                         | manga, manhwa, manhua | Some adult titles                                                                                   |
| Mangakakalot       | [mangakakalot.art](https://www.mangakakalot.art)       | manga, manhwa, manhua | Same platform as MangaNato                                                                          |
| MangaNato          | [manganato.gg](https://www.manganato.gg)               | manga, manhwa, manhua | Search may show a Cloudflare check; search returns one page of results                              |
| ManhwaToon         | [manhwatoon.com](https://www.manhwatoon.com)           | manhwa, manhua, manga | Adult; pages use `render` (API 2): plain requests get decoy images                                  |
| NiyaNiya           | [niyaniya.moe](https://niyaniya.moe)                   | manga                 | Adult                                                                                               |
| Omega Scans        | [omegascans.org](https://omegascans.org)               | manhwa                | Adult; comics only; paid chapters are left out                                                      |
| Paradise Scans     | [paradisescans.com](https://paradisescans.com)         | manhwa, novel         | BL; some adult titles; premium chapters are left out                                                |
| Vortex Scans       | [vortexscans.org](https://vortexscans.org)             | manhwa, manhua, manga | Locked chapters are left out                                                                        |

## Installing

The repo's link is:

```
https://raw.githubusercontent.com/lunaris-app/extensions/main/index.json
```

Lunaris lists it already as **Lunaris extensions**, so you don't need to add it.

1. In Lunaris, open **Extensions** and switch to the **Available** tab.
2. Under **Lunaris extensions**, click **Install** beside the ones you want.
3. Find titles in **Browse**, or switch an extension off in the **Installed** tab without
   removing it.

Sources whose Notes start with "Adult" stay out of **Available** until you turn on
**Settings > Sources > Show NSFW extensions**. Ones with "some adult titles" always show.

### Human checks

Some sites ask you to prove you're human (see Notes). When one does, Lunaris shows a banner,
or the site's page in its own window: pass the check there and reading carries on. To pass
or refresh a check ahead of time, use the globe button beside the extension in the
**Installed** tab.

### Updates

When a script changes, **Available** shows **Update from v…** beside it, and an **Update all**
button at the top. Your library, history and downloads are kept.

### Other repos and single scripts

- **Add a repo** at the bottom of **Available** takes another repo's `index.json` URL. It
  must be signed, with `index.json.sig` beside it. Nobody reviews other repos' scripts, so
  only add one you trust.
- **Import script** at the top of **Extensions** installs a single `.js` file, such as one
  you're writing.

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
