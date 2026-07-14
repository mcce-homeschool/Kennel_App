// dogs.js — Dog List screen. Uses the shared listView component with dog-specific
// filters, columns, and row navigation.
import { dogRepo } from '../data/dogRepo.js';
import { createListView } from '../assets/listView.js';
import { badge, fmtDate, esc } from '../assets/ui.js';
import { SEX, DOG_STATUS, OWNERSHIP_TYPE } from '../data/vocab.js';

const mount = document.getElementById('dog-list');

async function init() {
  // Breed filter options come from the data (free-text breeds already entered).
  const breeds = await dogRepo.getBreeds();

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
    columns: [
      { header: 'Call name', cell: (d) => `<strong>${esc(d.call_name)}</strong>` },
      { header: 'Registered name', cell: (d) => d.registered_name ? esc(d.registered_name) : '<span class="faint">—</span>' },
      { header: 'Sex', cell: (d) => badge(SEX, d.sex) },
      { header: 'Breed', cell: (d) => esc(d.breed || '—') },
      { header: 'DOB', cell: (d) => d.date_of_birth ? esc(fmtDate(d.date_of_birth)) : '<span class="faint">—</span>' },
      { header: 'Status', cell: (d) => badge(DOG_STATUS, d.status) }
    ],
    onRowClick: (d) => { location.href = `dog.html?id=${encodeURIComponent(d.id)}`; },
    load: (o) => dogRepo.getAll(o),
    emptyText: 'No dogs yet. Click “+ Add Dog” to create the first record.'
  });
}

init();
