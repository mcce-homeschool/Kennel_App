# CLAUDE.md — Dog Breeding Management App

Local-first, static, multi-page records app for a dog breeding program. No backend, no build step. Hosted on GitHub Pages; data lives in browser.

## Read first, every session
- `Data_Model_Architecture_Proposal_v2.md` — data model, entities, storage, integrity rules
- `Stage1_Stage2_Build_Brief_v2.md` — validation, screens, conventions, build order (Stages 1–2)
- `Stage3_Build_Brief_v1.md` — Pairings & Litters schema, validation, screens, build order (Stage 3)

These docs are source of truth. Conflict → stop and flag, don't diverge silently. Undocumented decision → ask, don't invent.

## Scope: Stages 1–3 only
Dogs, Contacts, Kennels, Import/Export (1–2) + Pairings, Litters (3).
Do NOT build: dashboard (5), sales/stud-services (4+), photos/attachments (no `attachments` table, `attachmentRepo`, Photos tab, thumbnails — descoped).

## Architecture non-negotiables
- Multi-page static: one `.html` per section, shared JS (`nav.js`/`db.js`/repos). No SPA router.
- ES modules over HTTPS. Serve via `python3 -m http.server` or `npx serve` — never `file://` (CORS-blocks module imports).
- No CDN deps — vendor everything into `/vendor`, load by relative path. Must work offline after first load.
- Strict layering: pages → repos → Dexie. Pages never call `db.*` directly.
- One thin repo per entity: `getById`, `getAll({includeArchived})`, `create`, `update`, `archive`, `hardDelete`. New entity = new repo + page; don't touch existing ones.

## Two decisions — do not re-litigate
- One `Dog` table for breeding stock, puppies, external dogs. Life-stage change = `status` update on same record, never a new record.
- One `Event` table for all dated history (polymorphic `subject_type`/`subject_id`), no per-type tables. JS module named `HistoryEvent`/`LogEntry` — never `Event` (DOM collision).

## Data conventions
- `id`: `crypto.randomUUID()`, client-side. No auto-increment.
- Soft delete only (`is_archived`). Never cascades, never destroys history.
- Date-only fields (`date_of_birth`, `event_date`, …) as `YYYY-MM-DD` strings, compared lexicographically. Only `created_at`/`updated_at` are full ISO.
- Dexie schema additive only: new tables → new `db.version(N).stores({...})`. Never edit `version(1)`.
- Pickers exclude archived by default (toggle to include). Status/type = colored badges.

## Referential integrity
- Driven by `referenceRegistry.js` (declared list of FKs pointing at each entity).
- Hard delete blocked if any reference exists — archive only. Guard/blocking message covers only tables that exist at current stage (Stage 2: sire/dam of another dog, subject/`related_dog_id` of an Event).

## CSV import
- Match-or-create by natural key, never UUID. Every import is dry-run preview (create/update/needs-review) before commit.
- Keyless/partial-key rows → always "needs review," never auto-matched or silently created. Name match case-insensitive + trimmed; DOB exact.

## Working style
- Focused, mechanical changes. Design-decision-adjacent change → surface it, invite pushback before implementing.
- Docs are living references with a changelog section, not delta-only.
- Build order per brief: schema → repos → Dog List/Detail → Events, before completeness features.