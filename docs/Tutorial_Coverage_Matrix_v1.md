# Tutorial Coverage Matrix (v1) — Phase 1 output

**Status:** Complete first pass. This is the **Phase 1** deliverable of the Tutorial
project (see `Tutorial_Sample_Data_Coverage_Spec_v1.md` §10): the §3.1 *Screen ×
Section coverage matrix*, filled in by **walking every page** rather than trusting the
spec's first-pass §4. Planning doc only — no code/data changes here.

**Method.** Every page's `.js`/`.html` in `KennelOS/pages/` (plus the shared
components `timeline.js`, `expensePanel.js`, `eventForm.js`, `pedigree.js`,
`listView.js`, `reportView.js`) was read to enumerate the *real* rendered sections and
expandable surfaces. The result was then verified in a browser: the app was served
locally, the "Thornfield Kennels" sample packet seeded via the first-run prompt, and
the hub pages screenshotted. **Zero page/console errors** across the walked pages; the
rendered section sets matched the source-derived inventory exactly (see §E).

**How to read the matrix.** One row per **(hub → screen → section / expandable
surface)**. Columns:
- **Teaches** — the one idea the tour conveys at this stop.
- **Anchor** — the seeded record/field the coach-mark points at.
- **Expandable** — the modal / toggle / "Show more" / collapsible the step must open
  (— = none).
- **Depends on** — the seed guarantee that must hold.
- **Status** — ✅ covered by today's seed · ⚠️ partial · ❌ gap (→ `Gn`/`D2` fix id
  from the spec §8) · 🎛️ teach-from-control (no record, taught from the dropdown).

Gap ids (`G1`–`G14`, `D2`) are the spec's (§1 / §8). This doc **classifies** each tour
stop against them; it does not renumber them.

---

## A. Corrections to the spec's first-pass §4 (what walking revealed)

The spec's §4 was written from the End-State page catalog and is **not** the shipped
information architecture. Walking the pages surfaced these structural facts the tour
plan must be built on — this was the main point of Phase 1.

1. **The six hubs land on consolidated pages, not the legacy per-table pages.**
   `nav.js` `NAV_ITEMS` + `HUB_CHILDREN`:
   - **Today → `today.html`** (a single consolidated home), **not**
     `dashboard`/`reminders`/`upcoming`/`board`. Those four (plus
     `scheduled-placements`) still exist by URL as `HUB_CHILDREN` but are **not** nav
     entries or tour stops. The Today hub's real stops are the **collapsible cards** of
     `today.html`.
   - **Breeding → `breeding.html`** (a consolidated pairing→litter→puppy *chain* view).
     `pairings`/`litters`/`active-breeding`/`live-births` are legacy `HUB_CHILDREN`.
   - **People → `contacts.html`**; `kennels`/`kennel` are also People (`HUB_CHILDREN`).
   - **Placements & Contracts → `sales.html`**; `stud-services` and `contracts` are the
     other two landing surfaces of the same hub (`HUB_CHILDREN`).
   - **Dogs → `dogs.html`** (the list now carries roster's CSV export, so `roster.html`
     is redundant); **Financials → `financials.html`**.
2. **"Nudges" is a card on `today.html`, not a page.** It renders **nothing** when no
   nudge fires — confirmed empty on a fresh seed (browser, §E). That is exactly G1.
3. **`today.html` card order** (DOM): Nudges · Reminders · Available puppies · Due outs
   & upcoming · Away from home · Kennel overview · This year. (Spec §4.1's ordering and
   "status tiles first" was wrong.)
4. **Dog Detail is far richer than §4.2 lists** — 12 sections, most collapsible, several
   **conditionally hidden** (Contracts/Sales/Stud Services/Pairings/Litters appear only
   when relevant or non-empty). Full list in §B-Dogs.
5. **Kennels have no detail-page editor.** Editing (incl. `preferred_tests`, promote-
   nudge config) happens **inline on `kennels.html`**; `kennel.html` is a read-only
   profile that only hosts the kennel Expenses ledger. **`preferred_breeds` has no UI
   editor at all** — it's set by seed/import only (matters for D2/G12).
6. **Contracts split across two surfaces.** Sale/stud-service contracts live inline on
   the `sales.html`/`stud-services.html` cards; `contracts.html` lists only the
   **"fallout"** (co_own / lease / other / unlinked). The lease/co-own teaching moment
   is on `contracts.html` + `contract.html`, not the sales card.
7. **The tour has a pre-hub entry**: the first-run "explore vs blank" prompt
   (`sampleDataUI`) and the kennel-setup wizard (`kennelSetupUI`). These bracket the
   whole tour (open) and the Import/Export backup closer.

---

## B. The coverage matrix

Shared components referenced below (each is an **expandable surface** the tour opens):
- **Event History / Timeline** (`timeline.js`): collapsible card; "Show archived";
  **"+ Add Event" → event modal** (`eventForm.js`); span events as date ranges; linked
  expense cost shown; per-row Edit/Archive/Delete.
- **Expenses** (`expensePanel.js`): collapsible; total badge; "Show archived";
  **"+ Add Expense" → expense modal**; "Log event →" (dog/litter/pairing); 🔗 event tag.
- **Pedigree** (`pedigree.js`): ancestor tree (depth-capped) + derived Offspring.

### B.1 Today → `today.html`

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Nudges | Derived suggestions; nothing changes until you act | (one live nudge per rule) | collapsible; per-nudge action + Dismiss | ≥1 live nudge of each rule on seed day | ❌ G1 |
| Reminders | Reminders live on events; snooze *is* a date edit | Juniper (overdue), Percy (due-soon), Birch (upcoming) | collapsible; inline **Snooze** date-swap; "Log new →"; Dismiss | overdue/due-soon/upcoming each ≥1 | ✅ |
| — Show dismissed | Dismissed reminders aren't gone | Fern (dismissed) | (reminder Show-dismissed) | ≥1 dismissed reminder | ✅ |
| Available puppies | `disposition='available'` feeds this + prospective bundle | Fern | collapsible; "Add sale →" | ≥1 available dog | ✅ |
| Due outs & upcoming | Deep-link into an event (edit-in-place) | Fern placement (+7d), Percy vet visit | collapsible; "Open →" (openEvent) | ≥1 future-dated event | ✅ |
| Away from home | Whereabouts = boarding ∪ in-person stud; location from partner address | Birch @ Ellen (Burlington) | collapsible; **expandable row** (Contact/Drop-off/Return/Open) | in-person stud w/ sent_date, partner address | ✅ |
| Kennel overview | Status vs. archive (deceased is a status, not archived) | dog roster | collapsible; status tiles | dogs across statuses | ✅ |
| This year | Year-scoped tallies | litters/pairings/sales this year | collapsible | records dated in current year | ⚠️ Litters/Sales = 0 → G2/G3 |

### B.2 Dogs → `dogs.html` (list) + `dog.html` (detail) + `pedigree.html`

**`dogs.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Bucket seg-tabs | puppies / breeding (by sex) / not_breeding (by status) / external | dogs across statuses | tab switch + grouping | populated statuses | ✅ |
| Filters | Status/Disposition/Sex/Ownership/Breed | — | filter dropdowns | breed filter needs >1 breed | ⚠️ Breed → D2 |
| Sortable columns | click-to-sort; phone-collapse cols | — | column sort; "more details" | — | ✅ |
| Show archived | archive ≠ delete | Willow (archived) | listView Show-archived | ≥1 archived dog | ✅ |
| CSV export / + Add Dog | roster export from the hub | — | — | — | ✅ |

**`dog.html` (detail)** — DOM card order; ⟨cond⟩ = conditionally hidden.

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Profile — identity | full identity field set | (a dog w/ registry/chip/color/url) | edit-in-place | identity fields set on ≥2 dogs | ❌ G6 |
| Profile — ownership/external | owner required for external/leased; kennel hides | Gunnar (external), a leased dog | edit warnings (owner-required) | a `leased_in`/`leased_out` dog | ❌ G5 |
| Profile — disposition | keeping vs offering; independent of status | Fern (available) / Birch (keeping) | — | disposition values present | ✅ |
| Profile — edit warnings | sex-mismatch, DOD/status, DOB-vs-litter (3 fixes) | (edit a linked-litter pup) | inline warn + fix buttons | a litter-linked pup | ✅ |
| Recorded COI | user-attested, never computed; method combobox | Juniper (genomic), Gunnar (pedigree) | collapsible; inline edit | recorded_coi on ≥2 dogs | ✅ |
| Planned Tests | undated intention; add/copy; advisory unlogged | (a dog w/ planned_tests) | collapsible; **"+ Plan a test"** add/copy toggle | planned_tests + kennel preferred_tests | ❌ G6/G12 |
| Health-Test Summary | read-only test events; no inference | (a dog w/ genetic/ofa/breed_specific) | collapsible | health-test events | ⚠️ thin |
| Event History | span vs instant; 🔗 cost; add/edit modal | (a dog w/ boarding + medication span) | **timeline** (see shared) | boarding/medication span example | ❌ G11 |
| Expenses | ledger-first entry; event-linked costs | (a dog w/ a vet_visit cost) | **expensePanel** (see shared) | ≥1 expense | ✅ |
| Pairings ⟨cond⟩ | derived; edited on own page | Juniper | collapsible; + Add Pairing | breeding dog w/ pairings | ✅ |
| Sales ⟨cond⟩ | derived placement history | Hazel→Priya | collapsible; + Add Sale | owned dog w/ sales | ✅ |
| Stud Services ⟨cond⟩ | derived; either side | Birch/Percy | collapsible; + Add Stud Service | breeding dog w/ stud svc | ✅ |
| Contracts ⟨cond⟩ | lease/co_own/other via related_dog_id | (a leased/co-own dog) | collapsible; + Add Contract | related_dog_id contract | ❌ G7 |
| Litters ⟨cond⟩ | derived; sire/dam | Juniper | collapsible; + Add Litter | dog w/ litters | ✅ |
| Pedigree | reverse (offspring) is derived, depth-capped | Juniper (Ash/Willow up; Fern/Birch/Hazel down) | collapsible; Open full view → | ancestry + offspring present | ✅ |
| Header actions | archive vs. delete-blocked-by-refs (registry msg) | any referenced dog | disabled Delete + tooltip | ≥1 referenced dog | ✅ |

**`pedigree.html`** — root picker + generations select + tree + derived Offspring.
Anchor Juniper. Status ✅.

### B.3 Breeding → `breeding.html` + `pairing.html` + `litter.html`

**`breeding.html` (chain view)**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Log heat cycle | dam picker → heat_cycle event | (a female dam) | **dam-picker modal → event modal** | a female on roster | ✅ (liveness → G1) |
| Pairing cards | pairing→litter→puppies all derived | existing pairings | "Open pairing/litter" | ≥1 pairing | ✅ |
| Show more | expanding window | (>5 pairings) | **"Show more" toggle** | >5 pairings (seed has 3) | ❌ G10 |
| Litters (nested) / orphan litters | derived litter + puppy chips | Autumn litter (new) | — | expected + whelped/ready litters | ❌ G3 |

**`pairing.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Profile | sire≠dam **hard block**; sex-mismatch warn; planned→due +63d prefill | a fresh/empty pairing | edit-in-place + warnings | an unwhelped pairing to show prefill | ⚠️ G3 (need fresh one) |
| Linked Litter | "+ Create Litter from this Pairing" | a pairing w/o litter | — | pairing without a litter | ✅ |
| Linked Stud Service ⟨cond⟩ | StudService owns pairing_id (derived reverse) | outgoing-stud pairing | — | stud svc linked to a pairing | ✅ |
| Timeline | pairing-subject events | — | timeline | pairing events | ✅ |
| Expenses | pairing-subject cost | — | expensePanel | a pairing-subject expense | ❌ G14 |

**`litter.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Profile | nickname title; whelp→ready +56d; **per-sex pricing** → sale/prospective | Autumn litter (priced, nickname) | edit-in-place; sync/count/future-whelp warns; save→"update pairing status?" modal | pricing + nickname on a litter | ❌ G4 |
| Puppy Roster | roster is derived (Dog WHERE litter_id), not stored | Autumn puppies | **+ Add Puppy / + Add N Puppies modals**; **"+ Log event for whole litter"** cascade | a litter w/ puppies + dam breed set | ⚠️ G3 |
| Timeline | litter-subject events incl. per-pup weight_check | — | timeline | litter events | ✅ |
| Expenses | litter-subject cost | — | expensePanel | ≥1 litter expense | ✅ |

Legacy `HUB_CHILDREN` (still reachable, not primary stops): `pairings.html`,
`litters.html` (breed col → D2), `active-breeding.html`, `live-births.html`.

### B.4 People → `contacts.html` + `contact.html` + `kennels.html` + `kennel.html`

**`contacts.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Group seg-tabs | buyers are Contacts (no Buyer table) | Priya (client), Ellen (network) | tab switch | contacts across role groups | ✅ |
| Filters / sort / Show archived | Type + Waitlist | — | filters; sortable cols | — | ✅ |

**`contact.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Profile | contact_type[] multi; companion_note ≠ private notes; +New kennel inline; auto-tag roles from referred_by | Priya (companion_note); Tessa/Dana (referrer) | edit-in-place; **inline "+ New" kennel modal** | groomer/other types; broad email/address/companion_note | ❌ G13 |
| Dogs owned/co-owned ⟨cond⟩ | derived ownership | Dana → Gunnar | collapsible | owner/co-owner links | ✅ |
| Sales (as buyer) ⟨cond⟩ | derived buyer history | Priya | collapsible | buyer w/ sales | ✅ |

**`kennels.html`** (inline management — no detail editor)

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Add / rows | own vs. outside is a flag | Thornfield (mine), Meadow Ridge (outside) | inline edit row | own + outside kennel | ✅ |
| Preferred tests panel | own-kennel test vocab; feeds combobox | Thornfield preferred_tests | **"Preferred tests" panel + nested "Apply to dogs…"** | preferred_tests set on Thornfield | ❌ G12 |
| Lifecycle nudges (edit row) | promote-nudge config | Thornfield promote_* | inline (own-kennel) | promote_nudge_enabled + a kept pup old enough | ❌ G12/G1 |
| Delete blocked | archive-only when referenced | Thornfield | disabled Delete + tooltip | referenced kennel | ✅ |

**Note:** `preferred_breeds` has **no editor** here — set via seed/import only (D2/G12).

**`kennel.html`** — read-only profile + **Kennel Expenses** panel (subject=kennel).
Anchor: Thornfield overhead expenses. Status ✅.

### B.5 Placements & Contracts → `sales.html` + `sale.html` + `stud-services.html` + `stud-service.html` + `contracts.html` + `contract.html`

**`sales.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Sale cards + inline contracts | placement_type & sale_status; Contract owns the link | existing sales | link/unlink/create contract; **"Show more" >5** | ≥1 open sale; >5 for pagination | ❌ G2/G10 |

**`sale.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Profile — fees then dates | price/deposit/transport/deferred; deposit→balance lifecycle | an **open** sale (deposit_paid, future balance_due) | edit-in-place; dog→price prefill; buyer→lead_source | open sale + transport/deferred set | ❌ G2/G9 |
| Profile — post-save prompts | co-own→co-owner, delivered→ownership, disposition, boarding, placement | (a delivered / new sale) | **prompt-chain modals** | sale transitions | ✅ |
| Contracts | governing = most-recent signed (derived) | Hazel sale contract | + Create Contract | a signed sale contract | ✅ |

**`stud-services.html` / `stud-service.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Cards + inline contracts | direction; inline contract link | existing stud svc | link/unlink/create; "Show more" >5 | incoming + outgoing | ❌ G8 |
| Profile | direction/type; fee_structure gates pick_status; in-person+sent→away board; +Create Pairing | Birch (outgoing/in-person); an **incoming/ai** svc | edit-in-place; pick field toggles on fee_structure | an incoming, ai stud service | ❌ G8 |
| Contracts | derived by related_stud_service_id | a stud contract | + Create Contract | stud contract | ⚠️ G8 |

**`contracts.html` / `contract.html`**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Fallout list | co_own/lease/other/unlinked live here | a lease + co_own contract | filters Type/Status; sortable | a lease + co_own contract | ❌ G7 |
| Profile — type-conditional | lease hides sale/stud, shows lease dates; related_dog/counterparty; document_url→companion; status moves freely | a lease (related_contact_id) | edit-in-place; fields swap on type | lease + a non-signed status example | ❌ G7 |

### B.6 Financials → `financials.html`

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Summary | grand total + per-category | existing expenses | — | expenses across categories | ✅ |
| Ledger | category/subject-type/year filters + CSV | kennel/dog/litter/event costs | filters; row→subject | costs across subject types | ⚠️ G14 (no pairing) |
| + Add Expense | log against any subject | — | **add-expense modal** (subject-type→subject) | — | ✅ |

### B.7 More → Reports / Companion / Import-Export

**Reports (`reports.html` tiles → reportViews)**

| Report | Teaches | Depends on | Status |
|---|---|---|---|
| litters-report | litters over time (Year/Status) | ≥2 litters | ⚠️ G3 |
| live-births | per-litter live % | litters w/ born counts | ✅ |
| placements-report | sales by type/status/year | ≥1 open + closed sale | ⚠️ G2 |
| stud-services-report | outgoing + incoming | both directions | ❌ G8 |
| health-tests-report | test events across dogs | test events | ⚠️ thin |
| roster / scheduled-placements | operational reportViews | — | ✅ |

**Companion (`companion.html`)**

| Section | Teaches | Anchor | Expandable | Depends on | Status |
|---|---|---|---|---|---|
| Seg-tabs + filter blurb | allow-list / one-way / no-revoke; membership rules | — | tab switch | — | ✅ |
| Message template | per-type Layer-1 copy | (kennel identity) | editable card | — | ✅ |
| Recipients — Prospective | active waitlist; price from litter | Owen | collapsible row; note editor; **Prepare link** | Owen + litter price | ⚠️ G4 (price) |
| Recipients — Current families | open sale membership; balance math | (open-sale buyer) | collapsible row; Prepare link | ≥1 open sale | ❌ G2 |
| Recipients — Partners | stud/lease/co_own membership | Ellen (stud); a lease partner | collapsible row; Prepare link | Ellen + a lease partner | ⚠️ G7 (lease path) |

**Import/Export (`import-export.html`)**

| Section | Teaches | Expandable | Status |
|---|---|---|---|
| JSON backup / restore | trust model; "back up your data" (tour closer) | restore **preview table** → Merge/Replace confirm | ✅ |
| CSV import (7 importers + kennel-tests) | match-or-create by natural key; dry-run preview | each = importView dry-run (create/update/needs-review) → commit | ✅ |
| Sample data / Kennel setup / Reset | clear demo; kennel-setup; reset (type RESET) | reset modal | ✅ |

---

## C. Gaps, classified & browser-confirmed

Every gap the seed still has, and whether it's **confirmed live** on a fresh seed
(browser walk, §E) or inferred from source. Fix ownership stays with spec §8 threads.

| Gap | Where it bites (tour stop) | Confirmed live? |
|---|---|---|
| G1 nudges | Today → Nudges card renders nothing | ✅ card absent in browser |
| G2 open sale | Sales lifecycle; Companion "Current families"; This-year Sales=0 | ✅ This-year Sales tile = 0 |
| G3 litters | Breeding chain sparse; This-year Litters=0; pairing/litter prefills | ✅ Litters-whelped tile = 0 |
| G4 litter pricing | Litter detail; Sale prefill; Prospective bundle price | source |
| G5 lease | Dog ownership "external/lease" teaching moment | source |
| G6 dog identity | Dog Profile identity fields; Planned Tests empty | ✅ Planned Tests card "empty" |
| G7 contracts | contracts.html fallout; Companion Partners lease path | source |
| G8 incoming/ai stud | Stud service direction/type; stud-services-report | source |
| G9 sale fees | family bundle balance math | source |
| G10 Show more | Breeding/Sales/Stud pagination | ✅ 3 pairing cards, no "Show more" |
| G11 medical spans | Dog timeline boarding/medication span | source |
| G12 kennel config | Preferred-tests panel; promote nudge | source |
| G13 contacts polish | groomer/other; email/address/companion_note breadth | source |
| G14 pairing expense | Financials subject-type filter; pairing Expenses | source |
| D2 Boxers | Dogs breed filter; litters breed col; reports >1 breed | source |

**Teach-from-control (🎛️, no record — spec §6/D3):** sale `cancelled`/`returned`,
contract `void`/`declined`, pairing `bred`/`not_pregnant`/`failed`/`cancelled`, litter
`sold`, and the second lease direction. The tour opens the dropdown and names these;
they are **not** matrix gaps.

---

## D. Expandable-surface inventory (every toggle/modal the tour must open)

The tour must drive these, not just point at them. Complete list found by walking:

- **Collapsible cards** (chevron): every `today.html` card; every `dog.html` card
  (except Profile); `contact.html` Dogs/Sales; Event History & Expenses everywhere.
- **Expandable table rows**: Today "Away from home" (tap row → Contact/Drop-off/Return).
- **"Show more" pagination**: `breeding.html`, `sales.html`, `stud-services.html`
  (PAGE_SIZE=5).
- **Modals**:
  - Event add/edit (`eventForm.js`) — from every timeline, litter cascade, sale
    post-save prompts, breeding "Log heat cycle" (via dam-picker modal first).
  - Expense add/edit — from every expensePanel + Financials "+ Add Expense".
  - Puppy add — "+ Add Puppy" / "+ Add N Puppies" on litter.
  - Prompt-chain modals on sale save (co-owner / ownership / disposition / boarding /
    placement) and litter save ("update pairing status?").
  - Inline "+ New contact" (contactPicker) on sale/stud-service pickers; inline "+ New
    kennel" on contact.
  - Confirm/alert/select/prompt modals (`ui.js`) for archive/delete/etc.
  - Reset-app "type RESET" modal; restore Merge/Replace confirm.
- **Inline edit toggles**: Dog Profile edit; Recorded COI edit; Planned Tests
  "+ Plan a test"; kennels inline edit + Preferred-tests + "Apply to dogs…"; companion
  recipient expand + note editor + Prepare link.
- **Datalists / comboboxes**: breed, COI method, planned-test token, lead source,
  first-contact source, pick status.

---

## E. Browser verification evidence

Served `KennelOS/` over HTTP, seeded Thornfield via the first-run prompt, walked the
hub pages headless. **No page/console errors.** Rendered sections matched source:

- **Today** cards present, in order: Reminders(3) [Overdue/Due-soon/Upcoming buckets] ·
  Available puppies(1)=Fern · Due outs & upcoming(2) · Away from home(1)=Birch,
  Burlington VT · Kennel overview tiles · This year (Litters 0 / Pairings 2 / Sales 0).
  **No Nudges card** → G1 live. This-year Litters/Sales = 0 → G3/G2 live.
- **Dog Detail** cards, in order: Profile · Recorded COI · Planned Tests *(empty)* ·
  Health-Test Summary · Event History · Expenses · Pairings · Sales *(empty)* · Stud
  Services *(empty)* · Litters · Pedigree. **Contracts card absent** (conditional
  render, no linked contract) — confirms the ⟨cond⟩ behavior. Planned Tests "empty"
  → G6/G12 live.
- **Breeding**: 3 pairing cards, **no "Show more"** → G10 live.
- **Financials**: "Total spent" summary renders.
- **Companion (family tab)**: Message template + Recipients render (recipients empty →
  G2).

Screenshots retained in the scratchpad (`shot-today.png`, `shot-dog.png`, etc.).

---

## F. The tour spine (ordered stop list — Phase 0 backbone this matrix implies)

The natural one-idea-per-stop sequence the seed must serve, hub by hub, in the shipped
IA. (Feeds Phase 0's "freeze the spine"; the wizard-runtime spec, Phase 5, consumes it.)

0. **Open** — first-run prompt → seed Thornfield; kennel-setup wizard.
1. **Today** — Reminders (+snooze/dismiss) → Available puppies → Due outs → Away board
   (expand row) → Kennel overview (status vs archive) → *Nudges* (needs G1).
2. **Dogs** — list (buckets/filters/Show archived) → Dog detail top-to-bottom (identity
   → ownership/external → disposition → COI → Planned Tests → Health tests → timeline
   span → expenses → derived panels → pedigree).
3. **Breeding** — chain view (Show more, Log heat) → Pairing (sire≠dam block, prefill)
   → Litter (pricing, roster derived, cascade event).
4. **People** — Contacts (groups, companion_note) → Kennels (preferred tests, promote
   config) → Kennel expenses.
5. **Placements** — Sales (open lifecycle, inline contracts) → Sale detail (fees→dates)
   → Stud services (incoming+ai, away-board link) → Contracts (lease/co_own).
6. **Financials** — summary → ledger filters → add expense against any subject.
7. **More** — Reports (four analytics) → Companion (all three tabs non-empty) →
   Import/Export (**backup = the closer**).

---

*Companion to `Tutorial_Sample_Data_Coverage_Spec_v1.md` (the gap catalog this matrix
classifies against) and the End-State guide §13 (page catalog) / §19 (nudges) / §20
(companion). When the seed or IA changes, update this matrix and the spec together.*
