# CLAUDE.md — Dog Breeding Management App

A local-first, static, **multi-page** records app for a dog breeding program. No backend, no build step. Hosted as a URL on GitHub Pages; data lives in the user's browser.

## Read first, every session
- `Data_Model_Architecture_Proposal_v2.md` — the data model, entities, storage, integrity rules.
- `Stage1_Stage2_Build_Brief_v2.md` — how the app behaves: validation, screens, conventions, build order.

**These two docs are the source of truth.** If a request conflicts with them, stop and flag it — don't silently diverge. If a decision genuinely isn't covered, ask before inventing one.

## Scope right now: Stages 1–2 only
Foundation + Core Dogs (Dogs, Contacts, Kennels, Import/Export). **Do not build ahead:**
- No dashboard (Stage 5), no pairings/litters/sales/stud-services yet.
- **No photos / attachments** — descoped. No `attachments` table, no `attachmentRepo`, no Photos tab, no thumbnails. (Reintroduction path is documented but out of scope.)

## Architecture non-negotiables
- **Multi-page static**: one `.html` per section, shared JS via `nav.js` / `db.js` / repos. No SPA router.
- **ES modules over HTTPS.** Dev against a static server (`python3 -m http.server`, `npx serve`) — **never open via `file://`** (module imports are CORS-blocked there).
- **No CDN deps.** Vendor everything into `/vendor` (Dexie, PapaParse, any charting lib) and load by relative path. Offline must work after first load.
- **Layering is strict**: pages → repo modules → Dexie. Pages never call `db.*` directly.
- Each entity has one thin repo (`getById`, `getAll({includeArchived})`, `create`, `update`, `archive`, `hardDelete`). Adding an entity later = new repo + page, don't touch existing ones.

## The two decisions that must not be re-litigated
- **One `Dog` table** for breeding stock, puppies, and external dogs. Life-stage changes are `status` updates on the same record — never a new/duplicate record.
- **One `Event` table** for all dated history (polymorphic `subject_type`/`subject_id`). Don't add per-type history tables. **Name the JS module `HistoryEvent`/`LogEntry`, never `Event`** (DOM global collision).

## Data conventions
- `id`: `crypto.randomUUID()` string, client-side. No auto-increment.
- Soft delete only: `is_archived`. Archiving hides from active lists/pickers, never cascades, never destroys history.
- **Date-only fields** (`date_of_birth`, `event_date`, …) stored as `YYYY-MM-DD` strings and compared lexicographically. Only `created_at`/`updated_at` carry a time component (full ISO).
- Dexie schema is **additive**: new tables go in a new `db.version(N).stores({...})` block. **Never edit `version(1)`.**
- Pickers exclude archived by default (toggle to include). Status/type values render as colored badges.

## Referential integrity
- Driven by `referenceRegistry.js` (a declared list of every FK pointing at an entity).
- **Hard delete is blocked whenever a reference exists** — only archive is allowed then. The guard checks (and the blocking message lists) **only tables that exist at the current stage**. At Stage 2 that means a Dog's blockers are: sire/dam of another dog, and subject or `related_dog_id` of an Event.

## CSV import
- Match-or-create by human-readable natural key, never UUID. Every import is a dry-run preview (create / update / needs-review) before commit.
- **Keyless or partial-key rows are never auto-matched and never silently created** — they go to "needs review." Name matching is case-insensitive and trimmed; DOB matches exactly.

## Working style
- Prefer focused, mechanical changes. When a change builds on a design decision, surface the decision and **invite pushback before implementing**.
- Keep docs as one living reference each with a changelog section — not delta-only docs per change.
- Build order is in the brief; front-load what makes the app *usable* (schema → repos → Dog List/Detail → Events) before what makes it *complete*.
