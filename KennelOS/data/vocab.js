// vocab.js — controlled vocabularies (the enums from the data model) in one place,
// each value carrying a human label and a badge color class (assets/app.css).
// Dropdowns and badges both read from here so they never drift apart.

export const SEX = [
  { value: 'male',    label: 'Male',    badge: 'badge-blue' },
  { value: 'female',  label: 'Female',  badge: 'badge-purple' },
  { value: 'unknown', label: 'Unknown', badge: 'badge-gray' }
];

export const OWNERSHIP_TYPE = [
  { value: 'owned',      label: 'Owned',      badge: 'badge-green' },
  { value: 'co_owned',   label: 'Co-owned',   badge: 'badge-green' },
  { value: 'external',   label: 'External',   badge: 'badge-gray' },
  { value: 'leased_in',  label: 'Leased in',  badge: 'badge-amber' },
  { value: 'leased_out', label: 'Leased out', badge: 'badge-amber' }
];

export const DOG_STATUS = [
  { value: 'puppy',              label: 'Puppy',              badge: 'badge-blue' },
  { value: 'active_breeding',    label: 'Active breeding',    badge: 'badge-green' },
  { value: 'retired_breeding',   label: 'Retired breeding',   badge: 'badge-amber' },
  { value: 'pet_home',           label: 'Pet home',           badge: 'badge-neutral' },
  { value: 'deceased',           label: 'Deceased',           badge: 'badge-gray' },
  { value: 'external_reference', label: 'External reference', badge: 'badge-gray' }
];

// --- Pairing & Litter vocabularies (Data Model doc §5.3–5.4) ---------------
export const PAIRING_TYPE = [
  { value: 'planned', label: 'Planned', badge: 'badge-blue' },
  { value: 'actual',  label: 'Actual',  badge: 'badge-green' }
];

export const PAIRING_METHOD = [
  { value: 'natural',     label: 'Natural',        badge: 'badge-neutral' },
  { value: 'ai_fresh',    label: 'AI — fresh',     badge: 'badge-neutral' },
  { value: 'ai_chilled',  label: 'AI — chilled',   badge: 'badge-neutral' },
  { value: 'ai_frozen',   label: 'AI — frozen',    badge: 'badge-neutral' },
  { value: 'surgical_ai', label: 'Surgical AI',    badge: 'badge-neutral' }
];

export const PAIRING_STATUS = [
  { value: 'planned',            label: 'Planned',            badge: 'badge-blue' },
  { value: 'bred',               label: 'Bred',               badge: 'badge-purple' },
  { value: 'confirmed_pregnant', label: 'Confirmed pregnant', badge: 'badge-green' },
  { value: 'not_pregnant',       label: 'Not pregnant',       badge: 'badge-amber' },
  { value: 'whelped',            label: 'Whelped',            badge: 'badge-green' },
  { value: 'failed',             label: 'Failed',             badge: 'badge-red' },
  { value: 'cancelled',          label: 'Cancelled',          badge: 'badge-gray' }
];

export const LITTER_STATUS = [
  { value: 'expected', label: 'Expected', badge: 'badge-blue' },
  { value: 'whelped',  label: 'Whelped',  badge: 'badge-green' },
  { value: 'weaning',  label: 'Weaning',  badge: 'badge-amber' },
  { value: 'ready',    label: 'Ready',    badge: 'badge-green' },
  { value: 'placed',   label: 'Placed',   badge: 'badge-neutral' },
  { value: 'closed',   label: 'Closed',   badge: 'badge-gray' }
];

export const CONTACT_TYPE = [
  { value: 'breeder',        label: 'Breeder',        badge: 'badge-green' },
  { value: 'vet',            label: 'Vet',            badge: 'badge-blue' },
  { value: 'groomer',        label: 'Groomer',        badge: 'badge-purple' },
  { value: 'buyer_referrer', label: 'Buyer referrer', badge: 'badge-amber' },
  { value: 'co_owner',       label: 'Co-owner',       badge: 'badge-neutral' },
  { value: 'other',          label: 'Other',          badge: 'badge-gray' }
];

// Look up the {value,label,badge} descriptor for a value in a vocab list.
export function descriptor(vocab, value) {
  return vocab.find((v) => v.value === value) || { value, label: value ?? '—', badge: 'badge-gray' };
}

// --- Event type catalog (Data Model doc §5.2) ----------------------------
// Each type carries a badge color and the type-specific `details` fields shown
// as a short form (Build Brief B1: one small form per event_type, not a generic
// key/value editor). `subjects` limits where a type can be logged; at Stage 2
// only `dog` subjects exist, so pairing/litter-only types are intentionally
// absent and get added with their tables in later stages.
//
// Field `type` is one of: text | textarea | date | number.
export const EVENT_TYPES = [
  { value: 'vaccination',        label: 'Vaccination',        badge: 'badge-blue',    subjects: ['dog'],
    fields: [{ key: 'vaccine', label: 'Vaccine', type: 'text' }, { key: 'lot_number', label: 'Lot #', type: 'text' }, { key: 'next_due', label: 'Next due', type: 'date' }] },
  { value: 'preventative',       label: 'Preventative',       badge: 'badge-blue',    subjects: ['dog'],
    fields: [{ key: 'product', label: 'Product', type: 'text' }, { key: 'dose', label: 'Dose', type: 'text' }] },
  { value: 'genetic_test',       label: 'Genetic test',       badge: 'badge-purple',  subjects: ['dog'],
    fields: [{ key: 'panel_name', label: 'Panel', type: 'text' }, { key: 'lab', label: 'Lab', type: 'text' }, { key: 'result', label: 'Result', type: 'text' }] },
  { value: 'ofa_pennhip',        label: 'OFA / PennHIP',      badge: 'badge-purple',  subjects: ['dog'],
    fields: [{ key: 'joint', label: 'Joint', type: 'text' }, { key: 'method', label: 'Method', type: 'text' }, { key: 'rating', label: 'Rating', type: 'text' }] },
  { value: 'breed_specific_test', label: 'Breed-specific test', badge: 'badge-purple', subjects: ['dog'],
    fields: [{ key: 'test_name', label: 'Test', type: 'text' }, { key: 'result', label: 'Result', type: 'text' }] },
  { value: 'illness',            label: 'Illness',            badge: 'badge-red',     subjects: ['dog'],
    fields: [{ key: 'diagnosis', label: 'Diagnosis', type: 'text' }, { key: 'treatment', label: 'Treatment', type: 'textarea' }] },
  { value: 'medication',         label: 'Medication',         badge: 'badge-blue',    subjects: ['dog'],
    fields: [{ key: 'drug', label: 'Drug', type: 'text' }, { key: 'dose', label: 'Dose', type: 'text' }, { key: 'frequency', label: 'Frequency', type: 'text' }, { key: 'end_date', label: 'End date', type: 'date' }] },
  { value: 'surgery',            label: 'Surgery',            badge: 'badge-red',     subjects: ['dog'],
    fields: [{ key: 'procedure', label: 'Procedure', type: 'text' }, { key: 'vet', label: 'Vet', type: 'text' }, { key: 'outcome', label: 'Outcome', type: 'textarea' }] },
  { value: 'vet_visit',          label: 'Vet visit',          badge: 'badge-blue',    subjects: ['dog'],
    fields: [{ key: 'reason', label: 'Reason', type: 'text' }, { key: 'vet', label: 'Vet', type: 'text' }, { key: 'findings', label: 'Findings', type: 'textarea' }] },
  { value: 'injury',             label: 'Injury',             badge: 'badge-red',     subjects: ['dog'],
    fields: [{ key: 'description', label: 'Description', type: 'textarea' }, { key: 'severity', label: 'Severity', type: 'text' }] },
  { value: 'weight_check',       label: 'Weight check',       badge: 'badge-neutral', subjects: ['dog'],
    fields: [{ key: 'weight_lbs', label: 'Weight (lbs)', type: 'number' }] },
  { value: 'milestone',          label: 'Milestone',          badge: 'badge-green',   subjects: ['dog'],
    fields: [{ key: 'description', label: 'Description', type: 'text' }] },
  { value: 'title_earned',       label: 'Title earned',       badge: 'badge-green',   subjects: ['dog'],
    fields: [{ key: 'title_abbreviation', label: 'Title', type: 'text' }, { key: 'organization', label: 'Organization', type: 'text' }] },
  { value: 'heat_cycle',         label: 'Heat cycle',         badge: 'badge-amber',   subjects: ['dog'],
    fields: [{ key: 'cycle_start', label: 'Cycle start', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' }] },
  { value: 'evaluation',         label: 'Evaluation',         badge: 'badge-neutral', subjects: ['dog'],
    fields: [{ key: 'evaluator', label: 'Evaluator', type: 'text' }, { key: 'temperament_notes', label: 'Temperament notes', type: 'textarea' }, { key: 'structure_notes', label: 'Structure notes', type: 'textarea' }] },
  // Pairing-subject types (Stage 3) — the pairing's timeline is built from these.
  { value: 'breeding_tie',       label: 'Breeding tie',       badge: 'badge-purple',  subjects: ['pairing'],
    fields: [{ key: 'tie_date', label: 'Tie date', type: 'date' }, { key: 'method', label: 'Method', type: 'text' }] },
  { value: 'progesterone_test',  label: 'Progesterone test',  badge: 'badge-blue',    subjects: ['pairing'],
    fields: [{ key: 'value', label: 'Value (ng/mL)', type: 'number' }, { key: 'lab', label: 'Lab', type: 'text' }] },
  { value: 'ultrasound',         label: 'Ultrasound',         badge: 'badge-blue',    subjects: ['pairing'],
    fields: [{ key: 'confirmed', label: 'Confirmed?', type: 'text' }, { key: 'estimated_count', label: 'Estimated count', type: 'number' }] },
  { value: 'pregnancy_update',   label: 'Pregnancy update',   badge: 'badge-green',   subjects: ['pairing'],
    fields: [{ key: 'note', label: 'Note', type: 'textarea' }] },
  // Litter-subject type (Stage 3).
  { value: 'whelping_summary',   label: 'Whelping summary',   badge: 'badge-green',   subjects: ['litter'],
    fields: [{ key: 'total_born', label: 'Total born', type: 'number' }, { key: 'live_born', label: 'Live born', type: 'number' }, { key: 'notes', label: 'Notes', type: 'textarea' }] },
  { value: 'note',               label: 'Note',               badge: 'badge-gray',    subjects: ['dog', 'pairing', 'litter'],
    fields: [] }
];

// Event types loggable against a given subject_type.
export function eventTypesFor(subjectType) {
  return EVENT_TYPES.filter((t) => t.subjects.includes(subjectType));
}
