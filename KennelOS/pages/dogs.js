// dogs.js — Dog List screen. Uses the shared listView component with dog-specific
// filters, columns, and row navigation.
import { dogRepo } from '../data/dogRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { createListView } from '../assets/listView.js';
import { badge, fmtDate, esc } from '../assets/ui.js';
import { descriptor, SEX, DOG_STATUS, OWNERSHIP_TYPE } from '../data/vocab.js';

const mount = document.getElementById('dog-list');

// Compact single-letter badge (M/F/U) — Call name, Sex, and Status are the only
// columns that stay visible on a narrow screen, so Sex has to fit in that space.
function sexBadge(sex) {
  const d = descriptor(SEX, sex);
  const letter = d.label ? d.label[0].toUpperCase() : '?';
  return `<span class="badge ${d.badge}" title="${esc(d.label)}">${letter}</span>`;
}

async function init() {
  // Breed filter options come from the data (free-text breeds already entered).
  const [breeds, contacts] = await Promise.all([
    dogRepo.getBreeds(),
    contactRepo.getAll({ includeArchived: true })
  ]);
  const contactName = (id) => contacts.find((c) => c.id === id)?.name || '';
  const label = (vocab, v) => (v ? descriptor(vocab, v).label : '');

  createListView({
    mount,
    search: {
      placeholder: 'Search by name…',
      text: (d) => `${d.call_name || ''} ${d.registered_name || ''}`
    },
    filters: [
      { id: 'status', label: 'Status', options: DOG_STATUS, match: (d, v) => d.status === v },
      { id: 'sex', label: 'Sex', options: SEX, match: (d, v) => d.sex === v },
      { id: 'ownership', label: 'Ownership', options: OWNERSHIP_TYPE, match: (d, v) => d.ownership_type === v },
      { id: 'breed', label: 'Breed', options: breeds.map((b) => ({ value: b, label: b })), match: (d, v) => d.breed === v }
    ],
    // Call name, Sex, and Status stay visible at every width; Registered name,
    // Breed, and DOB collapse behind the row's "more details" toggle on phones
    // so the table never forces horizontal scroll.
    columns: [
      { header: 'Call name', cell: (d) => `<strong>${esc(d.call_name)}</strong>` },
      { header: 'Registered name', collapse: true, cell: (d) => d.registered_name ? esc(d.registered_name) : '<span class="faint">—</span>' },
      { header: 'Sex', cell: (d) => sexBadge(d.sex) },
      { header: 'Breed', collapse: true, cell: (d) => esc(d.breed || '—') },
      { header: 'DOB', collapse: true, cell: (d) => d.date_of_birth ? esc(fmtDate(d.date_of_birth)) : '<span class="faint">—</span>' },
      { header: 'Status', cell: (d) => badge(DOG_STATUS, d.status) }
    ],
    onRowClick: (d) => { location.href = `dog.html?id=${encodeURIComponent(d.id)}`; },
    load: (o) => dogRepo.getAll(o),
    emptyText: 'No dogs yet. Click “+ Add Dog” to create the first record.',
    // Roster's CSV export (Navigation Consolidation Plan v1 §3/§6) — same column
    // set as roster.html, now available directly from the Dogs hub.
    csv: {
      filename: `dogs-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { header: 'Call name', value: (d) => d.call_name || '' },
        { header: 'Registered name', value: (d) => d.registered_name || '' },
        { header: 'Sex', value: (d) => label(SEX, d.sex) },
        { header: 'Breed', value: (d) => d.breed || '' },
        { header: 'DOB', value: (d) => d.date_of_birth || '' },
        { header: 'Status', value: (d) => label(DOG_STATUS, d.status) },
        { header: 'Ownership', value: (d) => label(OWNERSHIP_TYPE, d.ownership_type) },
        { header: 'Owner', value: (d) => contactName(d.owner_contact_id) }
      ]
    }
  });
}

init();
