# Stage 3 Build Brief — v1
### Breeding Workflow: Pairings & Litters

**How to use this doc:** hand this to Claude Code alongside `Data_Model_Architecture_Proposal_v2.md` and `Stage1_Stage2_Build_Brief_v2.md`. Those two docs already define the Pairing and Litter entities (data model §5.3–5.4) and the app conventions this brief builds on — this doc only adds what's new: schema wiring, validation rules, and screens for the two tables that don't exist yet. It slots in once Stage 1–2's Suggested Build Order is complete and the app has real dogs, events, and contacts in it to pair and litter.

**Scope:** the two tables the discovery doc's Stage 3 calls for — Pairing and Litter — plus the UI work needed to make "puppy" a first-class part of the workflow. There is no separate Puppy table (data model §3.1, §5.1) — a puppy is a Dog record with `status = "puppy"` and `litter_id` set, so "puppy management" in this brief means the Litter-side UI that creates and lists those Dog records, not a new entity. Buyers, Sales, Contracts, and StudService are Stage 4+ and out of scope here, including the `Pairing.stud_service_id` field that already exists in the schema — it stays present but unused/hidden until StudService lands.

---

## 1. What's Already Decided (recap, not re-litigated here)

The data model doc settled all of this already; this brief just builds it:

- **Pairing** (§5.3): `sire_id`, `dam_id`, `pairing_type`, `status`, dates, and an unused `stud_service_id` for now. `resulting_litter_id` was deliberately removed — the Pairing→Litter link is a derived query (`Litter WHERE pairing_id = this.id`), never stored.
- **Litter** (§5.4): `pairing_id` is the canonical, nullable link (nullable so historical litters can be imported without a formal pairing record). `dam_id`/`sire_id` on Litter are authoritative for the litter itself and get validated against the linked Pairing's parents on write — mismatch warns, doesn't block.
- **Puppy roster** is derived (`Dog WHERE litter_id = this.id`), never stored on Litter.
- **Event** already supports `subject_type: pairing` and `subject_type: litter` in its enum (§5.2), and the catalog already has `breeding_tie`, `progesterone_test`, `ultrasound`, `pregnancy_update` (pairing-subject) and `whelping_summary` (litter-subject). No Event schema change is needed — Stage 1's generic Event table already anticipated this.
- **`dogs.litter_id`** is already an indexed field in the Stage 1 Dexie schema (`Stage1_Stage2_Build_Brief_v2.md` §A2) — it's simply been unused until now, since no Litter record could exist to point at.

---

## 2. Dexie Schema Addition

New `db.version(2).stores({...})` block — additive, per the migration model both prior docs establish:

```js
db.version(2).stores({
  pairings: 'id, sire_id, dam_id, status, pairing_type, is_archived',
  litters:  'id, pairing_id, sire_id, dam_id, status, whelp_date, is_archived'
});
```

- No changes to the `dogs` or `events` version-1 definitions — both already carry the indexes this stage needs (`litter_id` on dogs; `[subject_type+subject_id]` on events).
- New repo modules, same shape as the existing ones: `pairingRepo.js`, `litterRepo.js` — plain `getById` / `getAll({includeArchived})` / `create` / `update` / `archive` / `hardDelete`. Pages call these, never `db.pairings.*` / `db.litters.*` directly.

### 2.1 Reference registry updates

Two new registry arrays alongside `DOG_REFERENCES`, plus two new entries appended to `DOG_REFERENCES` itself:

```js
// referenceRegistry.js additions

// New entries on the existing array (data-model doc §10 anticipated these):
export const DOG_REFERENCES = [
  // ...Stage 2 entries unchanged...
  { table: 'pairings', field: 'sire_id', label: 'sire in a pairing' },
  { table: 'pairings', field: 'dam_id',  label: 'dam in a pairing' },
  { table: 'litters',  field: 'sire_id', label: 'sire of a litter' },
  { table: 'litters',  field: 'dam_id',  label: 'dam of a litter' },
  // Stage 4+ still to come: sales.dog_id, stud_services.our_dog_id/partner_dog_id
];

export const LITTER_REFERENCES = [
  { table: 'dogs', field: 'litter_id', label: 'puppy roster member' },
];

export const PAIRING_REFERENCES = [
  { table: 'litters', field: 'pairing_id', label: 'linked litter' },
  { table: 'events', field: 'subject_id', label: 'subject of an event', whereType: { subject_type: 'pairing' } },
  // Stage 4+: stud_services.pairing_id
];
```

- `canHardDelete()` for Dog now genuinely checks pairings and litters, not just dogs/events — the Stage 2 blocking message in Dog Detail automatically picks up the new blockers with no UI change, since it already renders whatever the registry returns.
- Litter's own hard-delete guard uses `LITTER_REFERENCES` — this is the "can't delete a litter while a dog still points at it" rule from data model §10, now actually implemented.
- Pairing's hard-delete guard uses `PAIRING_REFERENCES`.

---

## 3. Business & Validation Rules

### Pairing
- Required to save: `sire_id`, `dam_id`, `pairing_type`, `status`.
- `sire_id` cannot equal `dam_id` (hard block).
- `sire_id` pointing at a Dog with `sex = female` (or `dam_id` at `sex = male`): **warn, don't block** — same posture as the Dog `sire_id`/`dam_id` rule in Stage 2 (B1), for the same reason (bad legacy/imported data shouldn't become unfixable).
- `expected_due_date`, if set, should be ≥ `planned_date` — soft warning, same pattern as Event's `reminder_date` rule.
- Status is **not a locked state machine** — `planned / bred / confirmed_pregnant / not_pregnant / whelped / failed / cancelled` can move in any direction without confirmation dialogs, consistent with the Dog status philosophy in Stage 2. No transition gets special friction here (unlike Dog's "leaving deceased" case) — pairings get reclassified as `failed`/`cancelled` often enough that adding friction would be counterproductive.
- Archiving always allowed. Hard delete blocked by `PAIRING_REFERENCES` (a linked Litter, or any Event with `subject_type: pairing`).

### Litter
- Required to save: `dam_id`, `sire_id`, `status`.
- Same sex warn-don't-block rule as Pairing/Dog for `sire_id`/`dam_id`.
- **Sync-and-warn against a linked Pairing** (data model §5.4): if `pairing_id` is set, on every save compare `litter.dam_id`/`litter.sire_id` to `pairing.dam_id`/`pairing.sire_id`. Mismatch shows a warning banner ("this litter's dam doesn't match the linked pairing's dam") but never blocks the save — historical/imported litters need to be enterable even when messy.
- `whelp_date`: no hard block on a future date (a litter can be `status: expected` with a projected date) — but if `status` is `whelped` or later (`weaning`/`ready`/`placed`/`closed`) and `whelp_date` is in the future, warn.
- `puppies_born_alive + puppies_born_deceased` exceeding `puppies_born_total`: soft warning, not a block (counts are sometimes corrected after the fact as puppies are individually entered).
- Status is not a locked state machine, same reasoning as Pairing.
- Archiving always allowed. Hard delete blocked by `LITTER_REFERENCES` — any Dog with `litter_id` pointing at it.

### Puppy roster (Dog records, not a new entity)
- "Add Puppy" from Litter Detail creates a Dog record through `dogRepo.create()` exactly like every other dog — no separate creation path, no separate validation rules. Pre-filled and locked-by-default (editable if needed): `litter_id`, `dam_id`, `sire_id` (from the litter), `breed` (from the dam), `status: "puppy"`, `ownership_type: "owned"`. `call_name` and `sex` are the only fields the user is prompted for per-puppy at minimum, matching Stage 2's "required to save" list for Dog.
- A **"Add N Puppies"** bulk variant creates several placeholder puppy records at once (e.g., "Puppy 1", "Puppy 2" as temporary call names) for litters where the exact roster is entered progressively — each is still a normal, individually editable Dog record afterward, not a batch object.
- The puppy roster shown on Litter Detail is the derived query, `dogRepo.getAll()` filtered by `litter_id`, never a stored list — matches data model §5.4 exactly.
- Promoting a puppy to breeding stock is unchanged from Stage 2: it's a `status` edit on the same Dog record, done from Dog Detail. Nothing in this stage adds a separate "promote" action — the Sample Data brief's Birch record already demonstrates this is a status change, not a new record.

### Event (extension, not a schema change)
- Wire the type-specific short forms (Stage 2's B1 pattern) for the pairing/litter-subject types already in the catalog: `breeding_tie`, `progesterone_test`, `ultrasound`, `pregnancy_update` (pairing), `whelping_summary` (litter). Same approach as Stage 2's dog-subject forms — one small layout per `event_type`.
- The "Add Event" launcher, when opened from Pairing Detail or Litter Detail, offers only the `event_type`s valid for that `subject_type` (plus the universal `note` type) — not the full catalog. This was implicit in Stage 2 (only `dog` subjects existed) and needs to become an explicit filter now that three subject types exist.
- **New catalog entry proposed for this stage:** `evaluation` (`subject_type: dog`, `details: {evaluator, temperament_notes, structure_notes}`). The discovery doc's Epic 5 explicitly calls for puppy "Evaluations" and nothing in the current catalog covers structured temperament/structure assessments — `milestone` and `note` are near misses but not the same thing. Since the catalog is documented as extensible rather than hard-coded (data model §5.2), this is a pure addition: one new enum value, one new form, no migration.

---

## 4. Screens

| Screen | Purpose / key behavior |
|---|---|
| **Pairing List** | Search/filter by status, pairing_type, sire, dam; archived toggle (off by default) — same shared list component as Dog/Contact List (Stage 2, B3). "Add Pairing" button. |
| **Pairing Detail** | Edit-in-place profile; **Timeline** tab (Event list, `subject_type: pairing`, pairing-specific "Add Event" filter); **Linked Litter** panel — shows the derived litter if one exists, or a "Create Litter from this Pairing" action if not (pre-fills the new litter's `pairing_id`, `sire_id`, `dam_id`). Archive / Delete (blocked message from `PAIRING_REFERENCES`). |
| **Add/Edit Pairing** | Sire/dam pickers (exclude archived by default, per Stage 2's cross-cutting picker rule), pairing_type, method, status, dates. |
| **Litter List** | Search/filter by status, dam, sire, whelp_date range; archived toggle. "Add Litter" button. |
| **Litter Detail** | Edit-in-place profile (whelping counts, dates, linked Pairing picker); **Puppy Roster** panel — derived list of Dog records with this `litter_id`, each row linking to Dog Detail; "Add Puppy" / "Add N Puppies"; **Timeline** tab (Event list, `subject_type: litter`). Archive / Delete (blocked message from `LITTER_REFERENCES`, i.e. "3 dogs are in this litter's roster"). |
| **Add/Edit Litter** | Dam/sire pickers, optional Pairing picker (auto-fills dam/sire from the pairing if one is chosen, still editable), whelp_date, counts, status. |
| **Dog Detail (extended)** | Profile section gains a live `litter_id` picker (schema already had the field; it's simply been inert until now). New **"Pairings"** read-only panel — dogs with `status` implying breeding age get a derived list of Pairings where they appear as sire or dam, each linking out. |
| **Active Breeding (report)** | A second exercise of the Stage 1 reporting framework (A4) alongside Active Roster — non-archived pairings and litters in one filterable/exportable view, reachable from its own nav entry. Not required by the discovery doc's Stage 3 scope, but cheap given the framework already exists, and it's the kind of report a breeder actually wants mid-season. |

Nav update: `nav.js` gains **Pairings** and **Litters** entries (`stageIntroduced: 3`) — this is the one-file change the Stage 1 nav design was built for.

---

## 5. CSV Import Extensions

Same generic engine from Stage 1 (A3), two new mapping configs — no engine changes.

- **Pairing CSV columns:** `sire_registered_name, dam_registered_name, pairing_type, status, planned_date, expected_due_date, notes`. Natural key: `sire + dam + planned_date`, all three required to form a key — a row missing any of them is keyless and goes to needs-review, same posture as Dog/Contact in Stage 2.
- **Litter CSV columns:** `dam_registered_name, sire_registered_name, whelp_date, litter_registration_number, puppies_born_total, puppies_born_alive, puppies_born_deceased, status, notes`. Natural key: `dam + sire + whelp_date`. `dam_registered_name`/`sire_registered_name` are relationship columns resolved against existing Dog records at import time (data model §8, point 2) — unresolved names are flagged for the user to fix or create inline, never silently dropped or auto-created as new dogs.
- Both follow the same case-insensitive/trimmed name matching and exact-match date rule as Dog/Contact import.

---

## 6. Sample Data

`Sample_Data_and_Reset_Brief_v2.md` supersedes the original Stage 1–2-only sample data brief entirely: it defines one unified packet across all six tables through Stage 3 (Dog, Event, Contact, Kennel, Pairing, Litter), seeded and cleared together as a single set. `sampleDataManifest` carries `pairings` and `litters` arrays alongside the Stage 1–2 ones, and the contamination check covers `PAIRING_REFERENCES`/`LITTER_REFERENCES` as well as `DOG_REFERENCES`. The existing Thornfield pedigree's obvious pairing — Juniper × Gunnar producing Fern/Birch/Hazel — is wired up exactly as a sample Litter (`status: whelped`, linked via `pairing_id`) plus the Pairing that produced it, and a second `status: planned` pairing with no litter exercises the "Create Litter from this Pairing" empty state. See that doc for the full packet contents.

---

## 7. Suggested Build Order (within Stage 3)

1. `db.js` version(2) block + `pairingRepo.js` / `litterRepo.js` + registry additions (`DOG_REFERENCES` entries, new `PAIRING_REFERENCES`/`LITTER_REFERENCES`) — testable from the console, same pattern as Stage 1 step 1.
2. `nav.js` update (Pairings, Litters).
3. Pairing List + Pairing Detail (profile only, no timeline/litter panel yet).
4. Litter List + Litter Detail (profile + derived, read-only puppy roster).
5. Pairing/litter-subject Event forms (`breeding_tie`, `progesterone_test`, `ultrasound`, `pregnancy_update`, `whelping_summary`) + the `evaluation` dog-subject form + subject-type-aware "Add Event" filtering; wire Timeline tabs into both Detail screens.
6. "Add Puppy" / "Add N Puppies" flow from Litter Detail.
7. Pairing↔Litter linking (Litter's Pairing picker with sync-and-warn; Pairing Detail's "Create Litter from this Pairing" action).
8. Dog Detail extensions: live `litter_id` picker, derived "Pairings" panel.
9. CSV import: Pairing mapping, then Litter mapping.
10. Active Breeding report.

Steps 1–6 make the stage functionally usable (a breeder can record a pairing and its resulting puppies end-to-end); 7–10 round it out, mirroring how Stage 1–2's build order front-loaded usability before completeness.

All ten steps above are built, including the optional Active Breeding report. Stage 4 (Buyers, Sales, Contracts, StudService) is next per the discovery doc's stage plan.

---

## 8. Open Questions / Assumptions (resolved)

- **`evaluation` event type:** implemented as a new catalog entry (`vocab.js`) covering Epic 5's "Evaluations" requirement — `{evaluator, temperament_notes, structure_notes}`, exercised live in the sample data via Fern's evaluation event.
- **Bulk puppy creation:** built alongside one-at-a-time "Add Puppy" — the "Add N Puppies" placeholder-record flow (`puppyForm.js`) is live on Litter Detail.
- **Active Breeding report:** built as the optional/cheap second exercise of the Stage 1 reporting framework this section anticipated, reachable from its own nav entry.
