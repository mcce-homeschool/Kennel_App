// eventRepo.js — all Dexie access for the single polymorphic Event table
// (vaccinations, heat cycles, surgeries, titles, notes… — one dated occurrence
// attached to a dog / pairing / litter via subject_type + subject_id).
//
// NOTE the module/variable naming: we use `eventRepo` / `HistoryEvent`, never a
// bare `Event`, which would collide with the DOM global (CLAUDE.md).
//
// Events are leaf records — nothing points at an Event — so there is no reference
// registry and hardDelete is always allowed.
import { db } from './db.js';
import { makeRepo } from './repoBase.js';

const base = makeRepo('events', null);

const REQUIRED_FIELDS = ['subject_type', 'subject_id', 'event_type', 'event_date', 'title'];
const SUBJECT_TYPES = ['dog', 'pairing', 'litter'];

function validateEvent(candidate) {
  for (const f of REQUIRED_FIELDS) {
    if (candidate[f] == null || candidate[f] === '') {
      throw new Error(`Event: "${f}" is required.`);
    }
  }
  if (!SUBJECT_TYPES.includes(candidate.subject_type)) {
    throw new Error(`Event: subject_type must be one of ${SUBJECT_TYPES.join(', ')}.`);
  }
  // event_date MAY be in the future (e.g. a scheduled surgery) — not blocked.
  // reminder_date < event_date is a soft warning owned by the Stage 2 UI.
}

export const HistoryEvent = {
  ...base,

  async create(data) {
    validateEvent(data);
    return base.create(data);
  },

  async update(id, changes) {
    const existing = await db.events.get(id);
    if (!existing) throw new Error(`events: no record with id ${id}`);
    validateEvent({ ...existing, ...changes });
    return base.update(id, changes);
  },

  // Timeline for one subject, newest first — the core read this table exists for.
  // Uses the [subject_type+subject_id] compound index.
  async getForSubject(subjectType, subjectId, { includeArchived = false } = {}) {
    const rows = await db.events
      .where('[subject_type+subject_id]')
      .equals([subjectType, subjectId])
      .toArray();
    const visible = includeArchived ? rows : rows.filter((r) => !r.is_archived);
    // Sort by event_date desc (YYYY-MM-DD lexicographic), then created_at desc as
    // a stable tiebreak for same-day events.
    return visible.sort((a, b) => {
      if (a.event_date !== b.event_date) return a.event_date < b.event_date ? 1 : -1;
      return (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1;
    });
  }
};

// Alias so pages that prefer the generic name can import either.
export { HistoryEvent as eventRepo };
