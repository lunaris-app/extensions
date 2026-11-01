# Lunaris extensions

A [Lunaris](https://github.com/lunaris-app/release) extension repo. Add the URL of this
folder's `index.json` in Lunaris to install them.

| Extension    | Site                                             | Kinds                 | Notes                                                                                               |
| ------------ | ------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------- |
| Comix        | [comix.to](https://comix.to)                     | manga, manhwa, manhua | Uses `render` (API 2): the site signs and encrypts its API calls                                    |
| MangaNato    | [manganato.gg](https://www.manganato.gg)         | manga, manhwa, manhua | Search may show a Cloudflare check; search returns one page of results                              |
| Mangakakalot | [mangakakalot.art](https://www.mangakakalot.art) | manga, manhwa, manhua | Same platform as MangaNato                                                                          |
| Fenrir Realm | [fenrirealm.com](https://fenrirealm.com)         | novel                 | Chapter text needs a "confirm you're human" check in the Lunaris window; paid chapters are left out |

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

`bunx tsc -p jsconfig.json` type-checks the scripts. It reports `document`, `window` and
similar names in the functions that run inside the site's page through `render`; those are
expected.

## Terms

These scripts read public pages the way a browser does. Check each site's terms before
publishing or using them.
