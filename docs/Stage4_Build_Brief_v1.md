# Stage 4 Build Brief — v1
### Sales & Stud Services

**How to use this doc:** hand this to Claude Code alongside `Data_Model_Architecture_Proposal_v2.md`, `Stage1_Stage2_Build_Brief_v2.md`, `Stage3_Build_Brief_v1.md`, and `Sample_Data_and_Reset_Brief_v2.md`. The data model doc already defines the Buyer, Sale, Contract, and StudService entities (data model §5.5–5.8) and the app conventions the prior briefs established — this doc only adds what's new: schema wiring, validation rules, and screens for the four tables that don't exist yet. It slots in once Stage 3's Suggested Build Order is complete and the app has real dogs, pairings, and litters to sell and service.

**Scope:** the four tables the discovery doc's Stage 4 calls for — Buyer, Sale, Contract, StudService — plus the UI work needed to connect them to existing Dog, Contact, and Pairing records. "Puppy placement" from the discovery doc's Stage 4 list maps directly onto the Sale entity (data model §5.6, labeled "Placement" there) — there is no separate placement concept beyond a Sale record linking a Dog to a Buyer. "Wait list" maps onto Buyer's existing `waitlist_status` field (§5.5, already documented as "extension point for future wait-list feature") plus a filtered view — no new table. Genetic analysis, COI, analytics, dashboards, and the reminder engine remain Stage 5+ and out of scope here.

---

## 1. What's Already Decided (recap, not re-litigated here)

The data model doc settled all of this already; this brief just builds it:

- **Buyer** (§5.5): only `name` is required. `waitlist_status` (`none` / `active` / `fulfilled`) already exists in the schema as a forward-looking field — this stage is what turns it into a real feature, via a filter on Buyer List rather than a new table (see §8).
- **Sale** (§5.6, "Placement"): deliberately a separate table from Dog, not a field on it — "a dog can be reserved, returned, and re-placed, and each of those is a fact worth keeping." A dog can accumulate several Sale records over its life; that's expected, not an error state.
- **Contract** (§5.7): "generic enough to cover sale, stud service, co-ownership, and lease agreements — one table instead of four." `contract_type` discriminates the four kinds, but only `sale` and `stud_service` carry a linking FK (`related_sale_id` / `related_stud_service_id`). `co_own` / `lease` / `other` contracts stand alone, described entirely by `title` / `terms_summary` / `notes` — there's no separate table for those relationship types, by design.
- **StudService** (§5.8): `direction` (`outgoing` / `incoming`) distinguishes "our dog is the stud" from "our dog is the dam." It optionally links to a Pairing via `pairing_id`, echoing — but not identical to — the Litter↔Pairing relationship from Stage 3.
- **Event's `subject_type` enum** (§5.2) stays `dog` / `pairing` / `litter`. This stage adds no new subject type and no new catalog entries — sales, contracts, and stud services are transactional records, not history-log subjects, so nothing here needs a timeline of its own.
- **Two-way pointers that stay two-way:** `Sale.contract_id` ↔ `Contract.related_sale_id`, `StudService.contract_id` ↔ `Contract.related_stud_service_id`, and `Pairing.stud_service_id` ↔ `StudService.pairing_id`. Unlike `Pairing.resulting_litter_id`, which the data model's v2 pass removed in favor of a single canonical side, none of these three pairs gets collapsed here — see the cross-cutting rule in §3 for why, and how they're kept consistent instead.

---

## 2. Dexie Schema Addition

New `db.version(3).stores({...})` block — additive, per the migration model all prior docs establish:

```js
db.version(3).stores({
  buyers:        'id, waitlist_status, is_archived',
  sales:         'id, dog_id, buyer_id, status, placement_type, is_archived',
  contracts:     'id, contract_type, related_sale_id, related_stud_service_id, is_archived',
  stud_services: 'id, our_dog_id, partner_dog_id, partner_contact_id, direction, status, pairing_id, is_archived'
});
```

- No changes to the `dogs` / `events` / `contacts` / `kennels` (v1) or `pairings` / `litters` (v2) definitions — all indexes this stage needs on those tables (`litter_id`, `[subject_type+subject_id]`, etc.) already exist.
- New repo modules, same shape as the existing ones: `buyerRepo.js`, `saleRepo.js`, `contractRepo.js`, `studServiceRepo.js` — plain `getById` / `getAll({includeArchived})` / `create` / `update` / `archive` / `hardDelete`. Pages call these, never `db.buyers.*` / `db.sales.*` / `db.contracts.*` / `db.stud_services.*` directly.

### 2.1 Reference registry updates

Three appends to existing registries, plus four new registries:

```js
// referenceRegistry.js additions

// Appended to the existing DOG_REFERENCES array:
export const DOG_REFERENCES = [
  // ...Stage 1–3 entries unchanged...
  { table: 'sales',         field: 'dog_id',         label: 'placed via a sale' },
  { table: 'stud_services', field: 'our_dog_id',     label: 'our dog in a stud service' },
  { table: 'stud_services', field: 'partner_dog_id', label: 'partner dog in a stud service' },
];

// Appended to PAIRING_REFERENCES (Stage 3 flagged this exact entry as "Stage 4+: stud_services.pairing_id"):
export const PAIRING_REFERENCES = [
  // ...Stage 3 entries unchanged...
  { table: 'stud_services', field: 'pairing_id', label: 'linked stud service' },
];

// Appended to CONTACT_REFERENCES (guarding Contact since Stage 1, for owner_contact_id / co_owner_contact_ids):
export const CONTACT_REFERENCES = [
  // ...Stage 1–2 entries unchanged...
  { table: 'stud_services', field: 'partner_contact_id', label: 'partner contact in a stud service' },
];

export const BUYER_REFERENCES = [
  { table: 'sales', field: 'buyer_id', label: 'buyer of a sale' },
];

export const SALE_REFERENCES = [
  { table: 'contracts', field: 'related_sale_id', label: 'documented by a contract' },
];

export const CONTRACT_REFERENCES = [
  { table: 'sales',         field: 'contract_id', label: 'attached to a sale' },
  { table: 'stud_services', field: 'contract_id', label: 'attached to a stud service' },
];

export const STUD_SERVICE_REFERENCES = [
  { table: 'pairings',  field: 'stud_service_id',        label: 'linked from a pairing' },
  { table: 'contracts', field: 'related_stud_service_id', label: 'documented by a contract' },
];
```

- `canHardDelete()` for Dog now also checks `sales` and `stud_services` — the Dog Detail blocking message picks this up automatically, same no-UI-change pattern Stage 3 established.
- Buyer's, Sale's, Contract's, and StudService's own hard-delete guards use their respective new registries above.

---

## 3. Business & Validation Rules

### Buyer
- Required to save: `name`.
- `waitlist_status` defaults to `none`; no locked transitions. Creating a Sale for a buyer whose `waitlist_status` is `active` should *suggest* setting it to `fulfilled` via a prompt, not force it — same soft-suggestion pattern as Dog's `date_of_death` → `deceased` prompt (Stage 2, B1).
- Archiving always allowed. Hard delete blocked by `BUYER_REFERENCES` (a Sale pointing at them as buyer).

### Sale (Placement)
- Required to save: `dog_id`, `buyer_id`, `placement_type`, `status`.
- `dog_id` pointing at a Dog with `ownership_type = external`: **warn, don't block** — same posture as the sex-mismatch warnings elsewhere; you don't normally sell a dog you don't own, but historical/imported data can be messy.
- Creating a new Sale for a `dog_id` that already has another Sale in status `reserved` / `deposit_paid` / `paid_in_full` / `delivered` (i.e., not `returned`/`cancelled`): **warn, don't block** — surfaces likely duplicate entry, while still allowing the legitimate return-then-re-sell workflow the data model explicitly calls out.
- `balance_paid_date`, if set, should be ≥ `deposit_date` when both are present — soft warning, same `YYYY-MM-DD` lexicographic-comparison pattern used everywhere else.
- A Sale with `placement_type: co_own` reaching `status: paid_in_full` or `delivered` can *suggest* updating the dog's own `ownership_type` to `co_owned` — same soft-suggestion pattern as the waitlist prompt above, never forced.
- Status is **not a locked state machine**, consistent with Dog/Pairing/Litter — except one transition gets a confirmation dialog, mirroring Dog's "leaving deceased" friction point: moving to `returned` or `cancelled` **from** `paid_in_full` or `delivered` (unwinding a completed placement). Everything else saves without friction.
- Archiving always allowed. Hard delete blocked by `SALE_REFERENCES` (a Contract's `related_sale_id` pointing at it).

### Contract
- Required to save: `contract_type` only — matches the data model exactly (`title` is optional there). The UI can auto-suggest a default title from `contract_type` + the linked party's name as a convenience, but doesn't require one.
- `contract_type: sale` with no `related_sale_id` set, or `contract_type: stud_service` with no `related_stud_service_id` set: **warn, don't block** — a contract can legitimately be drafted before the record it documents is finalized. `co_own` / `lease` / `other` contracts have no linking field at all (§5.7) and never trigger this warning.
- `signed_date`, if set in the future: **warn, don't block** — unusual for a signed document, but not worth hard-blocking, consistent with the app's general date-validation posture (Event's `event_date` and Pairing's `expected_due_date` are similarly non-blocking).
- Archiving always allowed. Hard delete blocked by `CONTRACT_REFERENCES` (a Sale or StudService whose `contract_id` points at it).

### StudService
- Required to save: `direction`, `our_dog_id`, `partner_dog_id`, `partner_contact_id`, `status`.
- `our_dog_id` cannot equal `partner_dog_id` (hard block — same as Pairing's `sire_id` ≠ `dam_id` rule).
- Sex consistency with `direction` (`outgoing` → `our_dog_id` expected male, `partner_dog_id` expected female; `incoming` → reversed): **warn, don't block** — same posture as every other sire/dam-style sex check in this app (Stage 2 B1, Stage 3 §3).
- `partner_contact_id` auto-suggests from the partner dog's `owner_contact_id` once a partner dog is picked, but stays editable — the dog's registered owner and the person actually handling the arrangement aren't always the same.
- Status is **not a locked state machine**, same reasoning as Pairing — `arranged` / `completed` / `failed` / `cancelled` move freely, no confirmation dialogs.
- Archiving always allowed. Hard delete blocked by `STUD_SERVICE_REFERENCES` (a linked Pairing, or a Contract's `related_stud_service_id`).

### Cross-cutting: two-way pointer sync
Three field pairs in this stage's schema point at each other rather than one side being canonical and the other derived: `Sale.contract_id` ↔ `Contract.related_sale_id`, `StudService.contract_id` ↔ `Contract.related_stud_service_id`, and `Pairing.stud_service_id` ↔ `StudService.pairing_id`. None of these collapses to a single stored side the way `Pairing.resulting_litter_id` did in the data model's v2 pass, because either record in each pair can legitimately be created first (a contract drafted ahead of a finalized sale; a stud service arranged before a pairing exists). Instead, the repo layer keeps both sides in sync **inside a single write**: "Attach Contract" (on Sale Detail or Stud Service Detail), "Create Pairing from this Stud Service," and "Link Existing Pairing" all update both FK fields in the same transaction, so the user performs the linking action once, from either side. If the two sides are ever found to disagree (e.g. after a JSON restore/merge with hand-edited data), treat it as **warn, don't block** — same posture as the Litter↔Pairing dam/sire sync-and-warn from Stage 3 — and show both values rather than silently picking one.

- All pickers exclude archived records by default (cross-cutting rule from Stage 2, B1), with a toggle to include them.

---

## 4. Screens

| Screen | Purpose / key behavior |
|---|---|
| **Buyer List** | Search by name; filter by `waitlist_status`; archived toggle (off by default) — same shared list component as Dog/Contact/Pairing/Litter List. "Add Buyer" button. |
| **Buyer Detail** | Edit-in-place fields, including the `waitlist_status` picker; list of Sales for this buyer (derived via `buyer_id`, read-only, links to Dog); Archive / Delete (blocked message from `BUYER_REFERENCES`). |
| **Sale List** | Search/filter by status, placement_type, dog, buyer; archived toggle. "Add Sale" button. |
| **Sale Detail** | Edit-in-place profile (dates, price/deposit, placement_type, status); linked Dog and Buyer shown as read-only links; **Contract** panel — shows the linked contract if one exists, or "Create Contract" / "Attach Existing Contract" if not; Archive / Delete (blocked message from `SALE_REFERENCES`). |
| **Add/Edit Sale** | Dog picker (excludes archived by default), Buyer picker, placement_type, status, dates, price/deposit fields. Also reachable as **"Place this Dog"** directly from Dog Detail, pre-filling `dog_id`. |
| **Contract List** | Search/filter by contract_type; archived toggle. "Add Contract" button — the primary entry point for standalone `co_own` / `lease` / `other` contracts that aren't tied to a Sale or StudService. |
| **Contract Detail** | Edit-in-place fields (title, signed_date, terms_summary); shows the linked Sale or StudService if any (read-only); Archive / Delete (blocked message from `CONTRACT_REFERENCES`). |
| **Stud Service List** | Search/filter by direction, status; archived toggle. "Add Stud Service" button. |
| **Stud Service Detail** | Edit-in-place profile (fee fields, status); **Linked Pairing** panel — shows the linked pairing if one exists, or "Create Pairing from this Stud Service" / "Link Existing Pairing" if not (mirrors Pairing Detail's "Create Litter from this Pairing" panel from Stage 3); **Contract** panel, same pattern as Sale Detail; Archive / Delete (blocked message from `STUD_SERVICE_REFERENCES`). |
| **Add/Edit Stud Service** | Direction toggle, our-dog picker, partner-dog picker, partner-contact picker (auto-suggested, editable), fee_amount / fee_structure, status. |
| **Dog Detail (extended)** | New **"Sales History"** panel — derived list of Sale records where `dog_id` = this dog, each linking to Sale Detail. New **"Stud Services"** panel — derived list where `our_dog_id` or `partner_dog_id` = this dog. Both read-only here, same treatment as the "Pairings" panel Stage 3 added. |
| **Pairing Detail (extended)** | `stud_service_id` becomes live: a read-only **"Linked Stud Service"** line when one exists, set from the Stud Service side per the two-way sync rule above — no direct edit control here. |
| **Contact Detail (extended)** | New **"Stud Services (as partner)"** panel — derived list where `partner_contact_id` = this contact. |
| **Placements & Stud Services (report)** | Optional: a third exercise of the Stage 1 reporting framework (A4), alongside Active Roster and Active Pairings & Litters — non-archived sales and stud services in one filterable/exportable view. |

Nav update: `nav.js` gains **Buyers**, **Sales**, **Contracts**, and **Stud Services** entries (`stageIntroduced: 4`) — the one-file change the Stage 1 nav design was built for.

---

## 5. CSV Import Extensions

Same generic engine from Stage 1 (A3), new mapping configs — no engine changes.

- **Buyer CSV columns:** `name, phone, email, address, referral_source, waitlist_status, notes`. Natural key: `name` (case-insensitive, trimmed) — same single-field posture as Contact import in Stage 2, since Buyer is structurally similar (a person record). Nameless rows go to needs-review.
- **Sale CSV columns:** `dog_call_name, dog_registered_name, buyer_name, sale_date, price, deposit_amount, placement_type, status, notes`. Natural key: `dog + buyer + sale_date`, all three required to form a key — same three-part posture as Litter's `dam + sire + whelp_date` in Stage 3. `dog_*` / `buyer_name` are relationship columns resolved against existing Dog/Buyer records at import time; unresolved references are flagged for the user to fix or create inline, never silently dropped or auto-created.
- **Stud Service CSV columns:** `direction, our_dog_registered_name, partner_dog_registered_name, partner_contact_name, fee_amount, fee_structure, status, notes`. Natural key: `our_dog + partner_dog + direction`, all three required. Same relationship-column resolution as Sale.
- **Contract CSV: deferred.** Contracts are typically entered one at a time through the "Attach Contract" flow on Sale/Stud Service Detail, not bulk-migrated from a spreadsheet the way dogs or sales are — build this mapping only if a real need surfaces. The generic engine already supports adding it later at zero engine cost, same as every other entity.
- All three built mappings follow the same case-insensitive/trimmed name matching and exact-match date rule as Dog/Contact/Pairing/Litter import.

---

## 6. Sample Data — Follow-Up Needed (not built here)

`Sample_Data_and_Reset_Brief_v2.md` explicitly scoped itself to the six tables through Stage 3 and said Buyer/Sale/Contract/StudService "get their own extension when their stage lands, following the same pattern this doc establishes." That stage has now landed. A short addendum to that doc is the natural next step, not folded into this brief:

- Extend `sampleDataManifest` with `buyers: []`, `sales: []`, `contracts: []`, and `stud_services: []` arrays.
- Extend the contamination check (§5 of that doc) to also cover `BUYER_REFERENCES`, `SALE_REFERENCES`, `CONTRACT_REFERENCES`, and `STUD_SERVICE_REFERENCES`.
- The delete order needs a new pass inserted **before** the existing one: `sales / stud_services / contracts → events → litters → pairings → dogs → contacts → kennels` — these four tables sit above the Stage 1–3 tables in the dependency graph and would otherwise block a dog/pairing hard-delete.
- Content suggestions that retroactively connect the existing Thornfield packet, mirroring how Stage 3's own follow-up note connected Juniper × Gunnar: a sample StudService (`direction: incoming`, `our_dog: Juniper`, `partner_dog: Gunnar`, `partner_contact: Dana Ruiz`, `status: completed`) linked to Pairing P1 would explain how that pairing came about in the first place. A sample Sale for Hazel (already `status: pet_home`) to a new sample Buyer would close the loop on her placement, and that Buyer could demonstrate `waitlist_status: fulfilled`. A second sample Buyer with `waitlist_status: active` and no Sale yet would exercise the non-empty waitlist filter.

Flagging this rather than speccing it fully here, same restraint Stage 3 showed with its own sample-data follow-up note.

---

## 7. Suggested Build Order (within Stage 4)

1. `db.js` version(3) block + `buyerRepo.js` / `saleRepo.js` / `contractRepo.js` / `studServiceRepo.js` + registry additions (`DOG_REFERENCES`, `PAIRING_REFERENCES`, `CONTACT_REFERENCES` appends; new `BUYER_REFERENCES` / `SALE_REFERENCES` / `CONTRACT_REFERENCES` / `STUD_SERVICE_REFERENCES`) — console-testable, same pattern as Stage 1/3 step 1.
2. `nav.js` update (Buyers, Sales, Contracts, Stud Services).
3. Buyer List + Buyer Detail (profile only).
4. Sale List + Sale Detail (profile only, no contract panel yet) + "Place this Dog" launcher from Dog Detail.
5. Contract List + Contract Detail (profile only) + the two-way sync logic behind "Attach Contract" (shared by Sale Detail and Stud Service Detail).
6. Stud Service List + Stud Service Detail (profile only, no pairing panel yet).
7. Stud Service ↔ Pairing linking: Stud Service Detail's "Create Pairing" / "Link Existing Pairing" actions; Pairing Detail's new read-only "Linked Stud Service" line.
8. Dog Detail extensions: derived "Sales History" and "Stud Services" panels.
9. Contact Detail extension: derived "Stud Services (as partner)" panel.
10. Waitlist filter on Buyer List.
11. CSV import: Buyer mapping, then Sale mapping, then Stud Service mapping.
12. (Optional) Placements & Stud Services report.

Steps 1–6 make the stage functionally usable (a breeder can record a buyer, place a dog, and log a stud service arrangement end-to-end); 7–12 round it out, mirroring how Stage 1–2 and Stage 3 both front-loaded usability before completeness.

---

## 8. Open Questions / Assumptions (flag if wrong)

- **Two-way pointer sync, not canonical-direction removal:** `Sale.contract_id` / `Contract.related_sale_id`, `StudService.contract_id` / `Contract.related_stud_service_id`, and `Pairing.stud_service_id` / `StudService.pairing_id` are kept as live, synced pairs rather than collapsing one side to a derived query the way `Pairing.resulting_litter_id` was removed in the data model's v2 pass. This was a judgment call (§3) based on either side being a legitimate creation-order starting point; easy to revisit toward a single canonical direction if the sync logic proves fragile in practice.
- **Waitlist as a filter, not a screen:** "Wait list" from the discovery doc's Stage 4 scope is treated as a `waitlist_status` filter on the existing Buyer List rather than a dedicated screen, matching the restraint Stage 2 applied to Kennel management. Easy to promote to its own view (e.g. with manual ordering/priority) if a real workflow needs more than filtering.
- **Contract CSV import deferred:** assumed contracts are low-volume, one-at-a-time records entered via the "Attach Contract" flow rather than bulk-migrated; the mapping can be added later at no cost to the generic engine if that assumption is wrong.
- **Sale "duplicate active placement" warning:** included as a soft warning to catch likely data-entry mistakes; drop it if it proves noisy against real return/re-sell workflows.
- **Standalone Contract List:** kept as its own screen (rather than folding Contract access entirely into Sale/Stud Service Detail) specifically so `co_own` / `lease` / `other` contracts — which have no other screen to live on — have a home.
