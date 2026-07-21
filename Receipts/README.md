# Receipts — a capture-and-export companion for KennelOS

A small, **local-first, offline** web app for a dog-breeding business: snap a photo
of a receipt or log a mileage trip on your phone, let it **pull the details off the
photo** (offline OCR), and **export a CSV you load straight into KennelOS's Expense
ledger**. It shares KennelOS's philosophy — no backend, no build step, all data in
the browser, works offline as an installable PWA.

## What it does

- **📷 Receipts** — capture a photo (camera on mobile, file picker on desktop). The
  image is stored on-device, and offline OCR pre-fills **amount, date, and vendor**
  for you to confirm. Pick a category (the same categories KennelOS uses) and whether
  the cost is kennel-wide overhead or for a specific dog.
- **🚗 Trips** — log mileage (miles × rate). The dollar amount is figured the same way
  KennelOS figures it, so a trip becomes a clean deductible-mileage expense.
- **⬆ Export to KennelOS** — download a CSV of everything (or just what you haven't
  exported yet). Load it in KennelOS under **Import / Export → Import expenses (CSV)**,
  which shows a dry-run preview before saving. Re-importing the same file **updates
  rather than duplicates**.

**The photos stay here.** KennelOS stores no images by design, so this app is your
archive of the original receipt pictures; only the extracted numbers cross over.

## How the pieces fit

```
Receipts/
  index.html        the whole app (a list + capture/edit/export/settings modals)
  app.js            the controller (pages → repos, never db.* directly)
  sw.js             service worker (offline; app shell precached, OCR runtime-cached)
  manifest.json     PWA manifest
  data/
    db.js           Dexie schema — entries + photos tables
    entryRepo.js    CRUD for captured costs (receipts + trips)
    photoRepo.js    image storage (Blob + thumbnail) — the photo archive
    csvExport.js    builds the KennelOS-compatible CSV (columns match the importer)
    ocr.js          offline receipt reading via vendored Tesseract.js
    vocab.js        categories/subjects — MIRRORS KennelOS's vocab (keep in sync)
    settings.js     default kennel name + mileage rate (localStorage)
  assets/ui.js      esc/format/modal/toast helpers
  vendor/           dexie + tesseract.js (all offline, no CDN)
```

### The export contract (keep in sync with KennelOS)

The CSV columns are exactly KennelOS's `expense` importer headers:

```
subject_type, subject_name, expense_date, amount, category, vendor, miles, mileage_rate, notes
```

- A **receipt** row sets `amount` and `category`; `miles`/`mileage_rate` are blank.
- A **trip** row sets `miles` + `mileage_rate` and leaves `amount` blank — KennelOS
  derives it (miles × rate) and forces the category to `mileage`.
- `subject_type` is `kennel` (default — program overhead, matched by kennel name, or
  KennelOS's own configured kennel when the name is blank) or `dog` (matched by name).

If KennelOS renames or adds an expense category, mirror the change in
`data/vocab.js` here (an unknown category still imports — KennelOS soft-defaults it
to "Other" — but you lose the clean mapping).

## Run it

Static files, served over HTTP (never `file://`, which blocks ES module imports):

```bash
cd Receipts
python3 -m http.server 8000     # or: npx serve
# open http://localhost:8000/
```

On a phone, install it (Add to Home Screen) to use the camera and work offline. The
~7 MB OCR engine is fetched once on your first scan, then cached for offline use.

## Notes

- **No build, test runner, or linter** (same as KennelOS). Verify with
  `node --check <file>.js`, serving locally, and exercising the flow in a browser.
- **Service worker:** if you add/rename/remove a precached file, update
  `PRECACHE_URLS` and bump `CACHE_NAME` in `sw.js` (the vendored OCR assets are
  deliberately runtime-cached, not precached, to keep install fast).
- OCR is **progressive enhancement** — if it can't load (old device, no wasm SIMD),
  the app still works fully with manual entry.
