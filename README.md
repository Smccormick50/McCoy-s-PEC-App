# PCE Estimator

A mobile- and desktop-friendly web app version of your Project Cost Estimate (PCE)
master form. Built from `000_PCE_-_Master_Form_5-3-19.xlsm` — all 23 cost-code
categories and 217 line items from the original BUDGET sheet are built in as the
starting template for every new project, along with the CSI Division list and
CapEx depreciation terms from the original workbook.

## What it does

- **Project list** — save and manage estimates for as many stores/jobs as you want, not just one at a time.
- **View page** — a clean, read-only summary of an estimate: header info, Subtotal/Tax/Total, Cost Categories, CSI Division Summary, CapEx Depreciation Summary, notes, and photos. Has a **Print / PDF** button (uses your browser's print dialog — on iPhone that gives you "Save to Files" as a PDF).
- **Edit page** — edit all header fields, expand any of the 23 categories to edit/add/remove line items (name, vendor, amount, taxable yes/no), add or remove whole categories, add notes, and add/remove photos. Subtotal/Tax/Total update live at the bottom as you type.
- **Photos** — attach general jobsite/document photos to a project (not tied to individual line items). Photos are automatically resized before saving so they don't take up much space.
- **Export / Import JSON** — export any single project, or all projects at once, as a `.json` file you can back up, email, or move to another device. Importing a file adds those project(s) to your list (it won't overwrite existing ones).
- **Works offline** once loaded — there's no server. Everything is stored locally in the browser you're using, via [localforage](https://localforage.github.io/localForage/) (the same storage library used by the McCoy's Inspection app), which automatically picks the best available storage method on your device and falls back gracefully if one is blocked.

## Important — what this is *not*

This is **not** a native iPhone App Store app (that requires Xcode/a Mac and Apple
developer account, which isn't something I can produce from this chat). It's a
real web app that works great on an iPhone and looks/feels like an app once
added to your home screen — but it's not distributed through the App Store.

It's also **not a multi-device sync tool**. Each device/browser keeps its own
local copy of your projects. To move data between your phone and a computer
(or back it up), use the **Export** / **Import** JSON buttons.

## How to host it

The app is just static files (HTML/CSS/JS) — no server-side code, no build step.
Pick whichever is easiest for you:

**Easiest — Netlify Drop**
1. Go to https://app.netlify.com/drop
2. Drag the whole `pce-app` folder onto the page
3. You'll get a live URL instantly (e.g. `something.netlify.app`) — open it on your iPhone

**GitHub Pages**
1. Create a new GitHub repo and upload the contents of `pce-app`
2. In the repo settings, enable GitHub Pages for the main branch
3. Use the `https://yourname.github.io/reponame/` URL it gives you

**Your own server / company intranet**
Just copy the `pce-app` folder to any static file host or web server. No
configuration needed — there's no database or backend to set up.

**Quick local test (e.g. on a laptop)**
```
cd pce-app
python3 -m http.server 8000
```
Then open `http://localhost:8000` in a browser.

> Opening `index.html` directly by double-clicking it (a `file://` URL) mostly
> works, but Safari on iPhone can be inconsistent about saving data from local
> files — hosting it (even just via Netlify Drop) is the most reliable option.

## Adding it to your iPhone home screen

1. Open the hosted URL in **Safari** on your iPhone (must be Safari, not Chrome)
2. Tap the Share icon → **Add to Home Screen**
3. It'll appear as its own icon and open full-screen, without Safari's address bar

## Backing up your data

Your projects live only in the browser you're using. To keep a safe copy:
- Open a project → **Export JSON**, or from the project list use **Export all**
- Save that `.json` file somewhere safe (email it to yourself, Dropbox, etc.)
- To restore, use the **import** icon on the project list and pick that file

## Folder contents

```
pce-app/
  index.html        the app shell
  styles.css         all styling
  app.js             routing, screens, and all interactivity
  model.js           calculations (subtotal/tax/total, summaries) + import/export
  db.js              local storage wrapper (built on localforage)
  data.js            the 23-category / 217-item master template + CSI division list
  manifest.json       iOS/Android "Add to Home Screen" config
  icon-180.png / icon-512.png   app icons
  data/categories.json, data/divisions.json   the same template data in plain JSON (reference)
```

## A couple of notes on how it calculates things

- **Subtotal** = sum of every line item amount across all categories
- **Tax** = sum of (amount × tax rate) for only the line items marked **Taxable**
- **Total** = Subtotal + Tax
- **CSI Division Summary** groups every line item by its division code (the same 01–33 codes from your CSI Div List sheet)
- **CapEx Depreciation Summary** groups by each category's depreciation term (Building 39.5/15/7 Yrs, WSRT 7/5 Yrs, FFE 7/5 Yrs, Expenses, Added Item) — matching your Main Summary sheet's accounting categories

## If the app gets stuck and won't save

At the bottom of the project list screen there's a small **"Erase All App Data (troubleshooting)"** link. It double-confirms before doing anything, then completely wipes this app's local storage in your browser and reloads — useful if a previous version of the app left behind data that's now causing conflicts. This deletes everything saved in this browser, so export anything important first if you can.
