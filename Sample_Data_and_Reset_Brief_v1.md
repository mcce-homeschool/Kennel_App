# Dog Breeding Management App
## Sample Data & Reset — Midbuild Insertion Brief — v1

**How to use this doc:** hand this to Claude Code alongside `Data_Model_Architecture_Proposal_v2.md` and `Stage1_Stage2_Build_Brief_v2.md`. This is a small, self-contained addition, not a revision to either — it slots in once Stage 1–2 is functionally complete (after step 9, Active Roster report, in that brief's Suggested Build Order) and before the app goes in front of anyone exploring it for the first time.

**Scope:** only the four tables that exist at Stage 1–2 (Dog, Event, Contact, Kennel). Nothing here references Pairing/Litter/Sale/etc. — those get their own sample data when their stages land.

---

## 1. Why This Exists

An empty app doesn't demonstrate anything — a first-time user (or a family member testing it out) needs dogs to click on, a pedigree to look at, and a timeline with real entries before any of it means something. But that demo data can't become a trap: it has to be trivially and completely removable the moment someone's ready to start entering their own kennel's real records, without corrupting anything real they may have already typed in alongside it.

## 2. Design Principles

- **Seed through the repo layer, not around it.** Sample records are created by calling `dogRepo.create()`, `eventRepo.create()`, etc. — the same functions real data goes through. This guarantees sample data can never violate a validation rule that real data can't, and it never drifts from the schema.
- **Track sample records by ID, not by tagging them.** No `is_sample` field on Dog — that's a schema change for a temporary concern. Instead, every ID created during seeding is recorded in one manifest object. This is what makes "clear the sample data" possible without a scan or a heuristic.
- **Clearing is a real delete, not an archive.** Sample data should vanish completely — it's not part of anyone's breeding history. But it must refuse to delete anything a real record now depends on (see §5).

## 3. The Sample Manifest

One `localStorage` key, alongside the existing `lastBackupDate` (same small-settings use case):

```js
// key: 'sampleDataManifest'
{
  seededAt: "2026-07-14T00:00:00Z",
  dogs:     ["<uuid>", "<uuid>", ...],
  events:   ["<uuid>", ...],
  contacts: ["<uuid>", ...],
  kennels:  ["<uuid>", ...]
}
```

Absence of this key means either sample data was never loaded, or it already was cleared — both cases where the app should behave as "real data only."

## 4. First-Run Flow

On the very first load — no rows in `dogs`, `contacts`, or `kennels`, and no `sampleDataManifest` / `sampleDataCleared` flag in `localStorage` — show a single choice before anything else:

> **"Explore with sample data"** vs. **"Start with a blank kennel"**

- *Explore*: runs the seed routine (§6), writes the manifest, and shows a persistent small banner ("Viewing sample data — [Clear Sample Data]") on every page until it's cleared.
- *Blank*: sets `sampleDataCleared = true` in `localStorage` immediately, so the prompt never reappears and no banner shows.

The same "Clear Sample Data" action is also reachable any time from Settings, not just the banner — someone might seed it, poke around for a week, and only then be ready to switch over.

## 5. Clearing Sample Data

`clearSampleData()` (new module, `sampleData.js`, alongside `importExport.js`):

1. Read the manifest. If none exists, there's nothing to do.
2. **Contamination check** — before deleting anything, confirm no record *outside* the manifest now points at a record *inside* it (e.g., the user added their own real dog and set a sample dog as its sire). This reuses the same `DOG_REFERENCES` registry from the data-model doc §10, scoped to just the manifest's dog IDs, checking only for referencers not themselves in the manifest.
   - If clean → proceed.
   - If blocked → show exactly which real records are affected and offer to archive the conflicting sample dogs instead of deleting them (archiving is always safe, per the existing hard-delete rules).
3. Delete in dependency order — children before parents — using `bulkDelete` on the manifest's ID lists: **events → dogs → contacts → kennels**.
4. Remove the `sampleDataManifest` key; set `sampleDataCleared = true`.
5. Return a short summary (counts removed) for the confirmation screen.

This is a hard delete of *known, self-contained, unreferenced* records — it deliberately bypasses the normal single-dog hard-delete guard rather than reusing it, since that guard is designed to protect one record a user is actively trying to remove, not to bulk-clear a whole known set at once.

## 6. Sample Packet Contents

A small fictional kennel — "Thornfield Kennels" — sized to be explorable in a few minutes, not exhaustive. Every entity and index gets exercised at least once.

**Kennels (2)**
| Name | Notes |
|---|---|
| Thornfield Kennels | prefix `THORN` — the user's own kennel |
| Meadow Ridge Kennels | affiliation for an outside contact, below |

**Contacts (5)**
| Name | Type | Demonstrates |
|---|---|---|
| Dr. Patricia Nguyen | vet | plain contact |
| Dana Ruiz | breeder | `kennel_id` → Meadow Ridge; owns an external dog |
| Sam Okafor | co_owner | co-ownership index |
| Tessa Lin | co_owner, buyer_referrer | multi-select `contact_type` |
| Marcus Webb | buyer_referrer | **archived** — exercises the archived-contact toggle |

**Dogs (8)**
| Call name | Status | Ownership | Demonstrates |
|---|---|---|---|
| Juniper | active_breeding | owned | anchor breeding female |
| Gunnar | external_reference | external | `owner_contact_id` → Dana Ruiz; `dob_is_estimated = true` |
| Fern | puppy | owned | dam Juniper, sire Gunnar — standard puppy record |
| Birch | active_breeding | owned | **same littermate as Fern, but already promoted** — the one-record-not-a-copy rule made visible |
| Hazel | pet_home | owned | third littermate, placed out |
| Willow | retired_breeding | owned | **archived** — Juniper's dam; still resolves in the pedigree tree despite being archived |
| Ash | deceased | owned | Juniper's sire; `date_of_death` set — status badge + deceased handling |
| Percy | co_owned | co_owned | `co_owner_contact_ids` → Sam Okafor + Tessa Lin; parents left unset to show the pedigree tree's placeholder node for unknown ancestry |

**Events (~16)**, all `subject_type: dog`, spread to cover most of the dog-facing catalog:
- Juniper — vaccination, heat_cycle, ofa_pennhip, title_earned
- Gunnar — genetic_test, title_earned
- Fern — milestone, weight_check, vaccination
- Birch — milestone, weight_check, vaccination, genetic_test (health-tested after promotion to breeding stock)
- Hazel — vaccination, note
- Percy — one **future-dated** vet_visit (tests the "upcoming" visual treatment from the build brief's B1 rules)

## 7. Acceptance Checklist

- [ ] Sample dogs form a real 3-generation pedigree (Ash/Willow → Juniper/Gunnar → Fern/Birch/Hazel) with one archived and one deceased ancestor still resolving correctly
- [ ] Percy renders a placeholder node for both unknown parents
- [ ] Birch (promoted littermate) confirms visually that promotion is a status change, not a new record
- [ ] Every dog-facing event_type shown in §6 renders in its correct type-specific form
- [ ] Marcus Webb (archived contact) is hidden by default and appears with the archived toggle on
- [ ] Clearing sample data with no real data present removes all of it and the banner disappears
- [ ] Clearing sample data *after* the user has linked a real dog to a sample dog is blocked with a clear, specific message, and offers archive-instead
- [ ] After clearing, reloading the app never re-offers the first-run seed prompt
