# Food Group Log

A single-page web app for logging which of **13 food groups** you eat each day, with a calendar,
analytics and backups. No login, no backend, no build step — everything is kept in the browser's
`localStorage`, and it installs to a phone home screen as an app.

## Features

- **Today** — the full date, a streak pill, a progress bar and 13 tappable item tiles.
- **Calendar** — a month grid shaded by how many groups were logged, with a day editor in a modal
  (a bottom sheet on phones) and previous/next day arrows.
- **Analytics** — date-range filter, four summary cards, "Times eaten per item" bars, a "Share of
  intake" donut with a legend, and a searchable, sortable history table.
- **Settings** — theme (System/Light/Dark), week start (Sunday/Monday), export JSON/CSV, copy JSON,
  import JSON/CSV with Merge or Replace, sample data and a reset.
- Works offline, in light and dark mode, on desktop and phones.

### Past days are editable, future days are not

You can log and edit **today and any past day**. **Future dates can't be logged**: their tiles and
the Select all / Clear all buttons are disabled, the day modal shows a note, the next-day arrow
stops at today, the custom analytics range can't reach past today, and `FT.store.set()` refuses any
key after today. Entries that already exist for a future date (for example from an imported backup
made on a device with a different clock) are still shown and never deleted — they just can't be
edited here.

## The 13 food groups

| # | id (stored) | Name | # | id (stored) | Name |
|---|---|---|---|---|---|
| 1 | `milk` | Milk | 8 | `fish` | Fish |
| 2 | `yogurt` | Yogurt | 9 | `beans` | Beans |
| 3 | `vegetables` | Vegetables | 10 | `sugar` | Sugar |
| 4 | `fruit` | Fruit | 11 | `bread` | Bread |
| 5 | `red_meat` | Red Meat | 12 | `complex_carbs` | Complex Carbs |
| 6 | `chicken` | Chicken | 13 | `processed_food` | Processed Food |
| 7 | `chicken_wings` | Chicken Wings | | | |

Imports accept readable names and common variants: `Red Meat`, `red-meat` and `red_meat` all become
`red_meat`; `simple_carbs` loads as Bread; `processed`, `veggies`, `wings` and `bean` are mapped too.

## Data format

`localStorage` key `foodGroupLog.entries`:

```json
{
  "2026-10-28": ["milk", "yogurt", "vegetables", "fruit", "red_meat", "complex_carbs"],
  "2026-10-29": ["milk", "vegetables", "fruit"]
}
```

Keys are local dates (`YYYY-MM-DD`, never UTC), values are item ids in the canonical order above.
Days with nothing logged are deleted rather than stored as `[]`. Settings live in
`foodGroupLog.settings`: `{ "theme": "system" | "light" | "dark", "weekStart": 0 | 1 }`.

CSV export is wide — `date,milk,yogurt,…,processed_food` with `1`/`0` cells. Import also reads the
long form `date,items` with `Milk;Fruit;Chicken` (separated by `;` or `|`), and JSON as either the
entries object or `{ "entries": { … } }`.

## Run it locally

```bash
open index.html                 # works straight from disk
python3 -m http.server 5173     # or serve the folder, then visit http://localhost:5173
```

`.claude/launch.json` defines a server named `food-group-log` for Claude Code's preview browser.
Installing to a home screen and offline caching need `http(s)` (or `localhost`), not `file://`.

Python's simple server lets the browser cache CSS, so add `?v=2` or hard-reload after editing.
While editing, run `localStorage.setItem('foodGroupLog.noSW','1')` in the console and reload twice:
that keeps the service worker from serving the last cached copy of files you just changed.

## Deploy to GitHub Pages

1. Create a repository and push this folder:

   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. In the repository, open **Settings → Pages** and set **Source: Deploy from a branch**,
   **Branch: `main` / `/ (root)`**. The site appears at `https://<you>.github.io/<repo>/`.

Every path in the app is relative, so it works from a sub-folder. `.nojekyll` keeps Pages from
running Jekyll over the files. Netlify (drag the folder onto app.netlify.com/drop) and Vercel
(`vercel deploy`, framework preset "Other", no build command) work the same way.

### Add it to your home screen

- **iPhone/iPad (Safari):** open the Pages URL → Share → *Add to Home Screen*.
- **Android (Chrome):** open the URL → menu → *Install app* / *Add to Home screen*.

It then launches full-screen, with its own icon, and keeps working with no connection.
Data lives in that browser's storage, so use Export/Import to move it between devices.

## Project structure

| File | Responsibility |
|---|---|
| `index.html` | Shell: top bar, four `<section class="view">` containers, toast root, script tags. A small inline script applies the saved theme before first paint. `BUILD:` comment markers let a script inline everything into one file. |
| `css/styles.css` | Design tokens (light, plus dark twice), base, components, views and responsive rules. |
| `js/core.js` | `window.FT`, `FT.views`, the event bus, `FT.esc()`, `FT.toast()`, `FT.token()`. |
| `js/icons.js` | Icon dictionary, `FT.icon()`, `FT.hydrateIcons()`. |
| `js/items.js` | `FT.ITEMS`, `FT.ITEM_IDS`, `FT.itemById`, `FT.normalizeItem`. |
| `js/dates.js` | `FT.dates`: local-midnight helpers and en-US formatting. |
| `js/store.js` | `FT.store`: read/write/clean localStorage, subscribers, settings, cross-tab sync. |
| `js/components/modal.js` | `FT.modal.open/choose/confirm` — in-page dialogs with a focus trap. |
| `js/components/day-editor.js` | `FT.dayEditor()` — toolbar plus the 13 tiles for one date. |
| `js/components/day-modal.js` | `FT.openDay()` — a day editor in a modal with day arrows. |
| `js/views/*.js` | `today`, `calendar` (also `FT.level()`), `analytics`, `settings` (`FT.views.preferences`, `FT.loadSampleData()`). |
| `js/app.js` | Hash routing, theme handling, `FT.app.go()`, init, service-worker registration. Loads last. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable-app pieces: offline cache, name and icons. |
| `vendor/chart.umd.js` | Chart.js 4.4.1 (UMD), kept local so charts work offline. |

Script order matters: chart → core → icons → items → dates → store → modal → day-editor →
day-modal → today → calendar → analytics → settings → app.

## Making common changes

**Add, remove or rename a food group**

1. Edit `FT.ITEMS` in `js/items.js` (id in snake_case, name, icon key, color). Array position sets
   the display order.
2. Add a new icon's path to the dictionary in `js/icons.js` (24×24, stroke only).
3. Add the id's probability to `ODDS` in `js/views/settings.js`.
4. If you rename or remove an id, add an alias in `normalizeItem` so saved data still loads.
5. Update the table above. Counts, badges, CSV columns and charts adapt on their own.

**Colors** live as CSS custom properties in `:root` and in *both* dark blocks of `css/styles.css`;
per-item colors live only in `js/items.js`. Keep them dark enough to read on white — dark mode
lightens item icons by `--lift`.

**After changing any file**, bump `CACHE` in `sw.js` so installed copies refresh promptly.

## Known limitations

- Data lives in one browser on one device; moving it relies on export and import.
- The Manrope webfont comes from Google Fonts and is not precached; opened offline on a device that
  has never loaded it, the app falls back to the system sans-serif.
- Dates and labels are always US English (en-US), whatever the browser locale.
- There are no automated tests; the checks in the specification's testing checklist were run by hand.
