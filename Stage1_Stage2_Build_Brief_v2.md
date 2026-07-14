# Stage 1 & 2 Build Brief — v2
### Foundation + Core Dogs

**How to use this doc:** hand this to Claude Code alongside `Data_Model_Architecture_Proposal_v2.md`. That doc defines *what the data looks like*; this one defines *how the app should behave* — validation rules, screens, and conventions — so implementation decisions get made once, deliberately, instead of invented fresh each session. Scope is deliberately limited to Stages 1–2. Stage 3 onward gets its own brief once these are built and the shape of the app is real rather than theoretical.

Architecture is a **true multi-page static app** — separate `.html` files per section (`dogs.html`, `contacts.html`, etc.), not a single-page app with client-side routing. There's no need for a router when every page load is instant and local. Navigation and DB initialization are shared across pages via common JS files (see below), keeping pages decoupled per the "minimal coupling" principle.

---

## Changes in v2

- **Distribution & runtime:** the app is hosted on **GitHub Pages** (a URL), served over HTTPS. That means shared code is loaded as **ES modules** (`<script type="module">` with relative `import`s) — no classic-script/global-namespace workaround. Develop against a **static server** (`python3 -m http.server`, `npx serve`), never `file://` (module imports are CORS-blocked there).
- **Dexie is vendored** into `/vendor` and loaded by relative path, not from a CDN (offline + no-external-deps).
- **Photos/attachments removed** from Stage 1–2: no `attachments` table, no `attachmentRepo.js`, no Photos tab, no thumbnails, and the JSON backup carries pure records only.
- **Hard-delete guard** is driven by the shared reference registry from the data-model doc, and its user-facing message lists only blockers that actually exist at this stage.
- **CSV import** defines explicit behavior for keyless/partial-key rows (never auto-match, never silently create).
- **Optional service worker** for offline app-shell caching (may land in Stage 1 or be deferred; no data-model impact).

---

## Part A — Stage 1: Foundation

### A1. Application Shell & Navigation

- `nav.js`: single source of truth for the nav menu, injected into a `<div id="app-nav"></div>` present on every page. Adding a new section in a later stage means editing one array in one file, not every HTML file.
- Nav shows only sections that exist yet: **Dogs, Contacts, Import/Export, Settings** at the end of Stage 2. (Structure the nav data as a list of `{label, href, stageIntroduced}` so it's trivial to extend.)
- A minimal landing page (`index.html`): quick links into Dogs and Contacts, a "last backup" indicator (see A3), nothing more. The full dashboard is an explicit Stage 5 feature — don't build it early.
- **(Optional) `sw.js` service worker:** cache the app shell (HTML/JS/CSS + vendored Dexie) so repeat visits work offline. Self-contained; can be deferred without touching anything else.

### A2. Local Database (Dexie)

`db.js` defines the schema from the data model doc, importing the vendored Dexie (`/vendor/dexie.min.js`). Concrete table/index definitions for Stage 1–2 tables (attachments removed; `*co_owner_contact_ids` multi-entry index and `breed` filter index added):

```js
db.version(1).stores({
  dogs: 'id, sire_id, dam_id, litter_id, owner_contact_id, *co_owner_contact_ids, status, ownership_type, sex, breed, is_archived',
  events: 'id, [subject_type+subject_id], event_type, event_date, related_dog_id, is_archived',
  contacts: 'id, kennel_id, is_archived',
  kennels: 'id, is_archived'
});
```

- `[subject_type+subject_id]` is a **compound index** — required for fast "give me the timeline for this dog" lookups; don't substitute two separate single-field indexes.
- `*co_owner_contact_ids` is a **multi-entry index** so the Contact Detail screen can list co-owned dogs, not just solely-owned ones.
- Later stages add `.version(2).stores({...})` blocks for the remaining tables (pairings, litters, buyers, sales, contracts, stud_services) rather than editing version 1 — Dexie's migration model expects additive versioning. (Attachments, if ever reintroduced, arrive the same way — see the data-model doc §12.)
- Each table gets a matching repo module (`dogRepo.js`, `eventRepo.js`, `contactRepo.js`, `kennelRepo.js`) exposing plain functions (`getById`, `getAll({includeArchived})`, `create`, `update`, `archive`, `hardDelete`). Pages call repos; pages never call `db.dogs.*` directly.
- `referenceRegistry.js` (from the data-model doc §10) is created in Stage 1 and drives every repo's `hardDelete` guard.

### A3. Import / Export Framework

- **JSON backup/restore**: generic — serializes every table in the schema (whatever exists at that point) into the format from the data model doc §9. Works correctly with only 4 tables now and all 10 later without changes, since it iterates the schema rather than a hardcoded table list. With attachments gone, the export is pure JSON records — no base64, no blob handling.
- Store `lastBackupDate` in `localStorage` (not IndexedDB) — this is exactly the small-settings use case localStorage is right for.
- On first run, call `navigator.storage.persist()` and give the Dexie DB an app-specific name (data-model doc §2.1) so records aren't evicted and can't collide with anything else on the same `github.io` origin.
- Surface JSON export as the **migration path** if the app is ever moved to a custom domain/host — IndexedDB data doesn't follow an origin change.
- **CSV import**: build the generic engine now (file parsing via **vendored PapaParse**, not CDN; match-or-create resolution; dry-run preview screen showing create/update/needs-review counts; commit step) but wire in only the **Dog** and **Contact** mappings in Stage 2. Later stages add their own mapping config to the same engine — don't rebuild it per entity.
  - **Keyless/partial-key rows** (per data-model doc §8): a row that can't form a non-empty natural key is placed in **"needs review,"** never auto-matched and never silently created. Name matching is case-insensitive and trimmed; DOB must match exactly.

### A4. Reporting Framework

- A single reusable component: takes a list of records + column config + filters, renders a table, offers "export visible rows to CSV." Stage 2 proves it out with one real report (see B2, Active Roster). Every later stage's reports plug into this same component rather than getting bespoke rendering.

---

## Part B — Stage 2: Core Dogs

### B1. Business & Validation Rules

**Dog**
- Required to save: `call_name`, `sex`, `breed`, `ownership_type`, `status`. Everything else (registered name, DOB, registration number) is commonly unavailable at entry time in real breeding workflows — allow saving without it and filling in later.
- `breed`: free-text field with autocomplete suggestions drawn from breeds already entered — don't lock it to a fixed dropdown; breeding programs cross breeds and use variant naming.
- `date_of_birth` cannot be in the future.
- `date_of_death`, if set, must be ≥ `date_of_birth`. Setting it should *suggest* `status = deceased` via a prompt, not force it — let the user override.
- `sire_id` / `dam_id`: cannot equal the dog's own `id` (hard block). Cannot create a cycle — before saving, walk the proposed parent's ancestor chain to confirm the dog being edited isn't already in it (hard block; an undetected cycle would infinite-loop the pedigree tree renderer later).
- `sire_id` pointing at a Dog with `sex = female` (or vice versa for `dam_id`): **warn, don't block** — imported/historical data sometimes has incomplete sex data, and blocking would make bad legacy records unfixable.
- `owner_contact_id` required when `ownership_type` is `external` or `leased_in`.
- Status transitions are **not a locked state machine** — breeders need to correct mistakes freely. The only transition that gets a confirmation dialog rather than a silent save: moving *away from* `deceased` ("this dog is marked deceased — are you sure you want to change that?"). Everything else saves without friction.
- Archiving is always allowed, even if referenced elsewhere (archiving only hides from active pickers, never deletes). **Hard delete** is blocked whenever any reference exists, using the `DOG_REFERENCES` registry (data-model doc §10). The blocking message lists only references that exist **at this stage** — as sire/dam of another dog, or as the subject or related dog of an Event. (Litter/Sale/StudService references get added to the registry — and thus to this message — when those tables arrive.)

**Event**
- Required: `subject_type`, `subject_id`, `event_type`, `event_date`, `title`.
- `event_date` **may be in the future** (e.g., a scheduled surgery) — don't block it, just render future-dated events visually distinct ("upcoming") from past ones in the timeline.
- `details` fields are **type-specific short forms**, not one generic key/value editor — build one small form layout per `event_type` matching the catalog table in the data model doc (e.g. the `vaccination` form shows vaccine/lot/next-due fields; the `surgery` form shows procedure/vet/outcome). This keeps data entry fast and keeps `details` genuinely structured rather than becoming a free-text dumping ground.
- `reminder_date`, if set, should be ≥ `event_date` (soft warning, not a hard block).

**Contact / Kennel**
- Contact requires only `name`. `contact_type` is multi-select with no restriction on combinations.
- Kennel is lightweight enough that it doesn't need its own full CRUD screen in Stage 2 — support "add new kennel" inline from within the Contact form (small add-on-the-fly control), plus a bare-bones standalone Kennel list for cleanup/renaming. Don't over-build this entity yet.

**Cross-cutting**
- Every dropdown/picker that references another entity (sire/dam pickers, `owner_contact_id`, etc.) excludes archived records **by default**, with a "show archived" toggle in the picker — needed because historical litters legitimately reference deceased/archived dogs.
- All date-only fields are stored and compared as `YYYY-MM-DD` strings (data-model doc §2).

### B2. Screens

| Screen | Purpose / key behavior |
|---|---|
| **Dog List** | Search by name; filter by status, sex, breed, ownership type; archived-records toggle (off by default). Row shows call name, registered name, sex, DOB, status badge. (No thumbnail — photos are out of scope; an initial/monogram avatar is an optional nicety.) Click → Dog Detail. "Add Dog" button. |
| **Dog Detail** | Sectioned single page (not separate edit page): **Profile** (edit-in-place — click Edit to unlock fields, Save/Cancel appear), **Health Timeline** (Event list for this dog, newest first, "Add Event" opens the type-specific form from B1), **Pedigree** (spatial tree centered on this dog — see below). Archive action available; Delete only enabled when zero references exist, otherwise shows what's blocking it (from the registry). *(No Photos tab in v2.)* |
| **Add/Edit Event** | Modal or inline panel launched from the Health Timeline tab. First choose `event_type`, which swaps in the matching short form from the catalog. |
| **Pedigree View** | Full-screen spatial family-tree chart — nodes are dogs, edges are parent/child, clicking a node's name navigates to that dog and re-centers the tree. Dogs with unknown parents render as a visible placeholder node, not a truncated branch. Reachable both from Dog Detail and as its own top-level page for free exploration. Charting library is **vendored**, not CDN. |
| **Contacts List** | Search by name; filter by contact type; archived toggle. Click → Contact Detail. "Add Contact" button. |
| **Contact Detail** | Edit-in-place fields; list of Dogs owned **or co-owned** by this contact (derived via `owner_contact_id` and the `*co_owner_contact_ids` index; read-only here — edit ownership from the Dog record itself); Archive action. |
| **Kennel management** | Minimal: inline "add new" from the Contact form's kennel field, plus a simple standalone list/rename screen. |
| **Dog CSV Import** | Upload → dry-run preview (create / update / needs-review rows, matched on `registered_name + date_of_birth`, falling back to `call_name + date_of_birth`; keyless rows go to needs-review) → commit. |
| **Contact CSV Import** | Same pattern, matched on `name` (case-insensitive, trimmed); nameless rows go to needs-review. |
| **Import/Export (Settings)** | JSON backup download, JSON restore upload (merge vs. replace choice), last-backup-date display, entry points into the two CSV importers above. |
| **Active Roster (report)** | First real use of the reporting framework: all non-archived dogs, filterable/exportable. Proves the framework before later stages build on it. |

### B3. UI Conventions (establish now, reused every later stage)

- **List screens**: search + filter row + archived toggle is a standard, reusable pattern — build it once as a shared component, apply to Dog List and Contact List now, reuse for Litters/Buyers/etc. later.
- **Detail screens**: edit-in-place, not separate add/edit pages. One less page type to maintain per entity.
- **Status/type values**: shown as colored badges throughout, not plain text — consistent visual language across Dog status, Event type, Contact type.
- **Confirmations required for**: archive, hard delete, and the one flagged status transition (leaving `deceased`) above. Not required for ordinary saves — don't make routine data entry annoying.
- **Pickers** (sire/dam/owner/etc.): exclude archived by default, toggle to include.

---

## Suggested Build Order (within Stage 1–2)

1. `db.js` schema + `referenceRegistry.js` + all repo modules (no UI yet — testable from the console)
2. App shell + `nav.js` + landing page (optional `sw.js`)
3. Dog List + Dog Detail (Profile section only) — this alone makes the app usable for basic record-keeping
4. Event: type-specific forms + Health Timeline tab
5. Contacts + Kennels
6. Pedigree View
7. JSON backup/restore
8. CSV import (Dog, then Contact)
9. Active Roster report

This order front-loads the pieces that make the app *usable* (steps 1–4) before the pieces that make it *complete* (5–9), so there's a working tool early rather than a big-bang finish at the end of Stage 2. *(The former "Photos/Attachments" step is removed; see data-model doc §12 for clean reintroduction if it ever returns.)*
