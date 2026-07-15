// contracts.js — Contract List screen.
import { contractRepo } from '../data/contractRepo.js';
import { createListView } from '../assets/listView.js';
import { badge, esc } from '../assets/ui.js';
import { CONTRACT_TYPE, CONTRACT_STATUS } from '../data/vocab.js';

const mount = document.getElementById('contract-list');

createListView({
  mount,
  search: {
    placeholder: 'Search title, terms…',
    text: (c) => `${c.title || ''} ${c.terms_summary || ''}`
  },
  filters: [
    { id: 'type', label: 'Type', options: CONTRACT_TYPE, match: (c, v) => c.contract_type === v },
    { id: 'status', label: 'Status', options: CONTRACT_STATUS, match: (c, v) => c.status === v }
  ],
  columns: [
    { header: 'Title', cell: (c) => `<strong>${esc(c.title || '(untitled)')}</strong>` },
    { header: 'Type', cell: (c) => badge(CONTRACT_TYPE, c.contract_type) },
    { header: 'Status', cell: (c) => badge(CONTRACT_STATUS, c.status) },
    { header: 'Signed date', cell: (c) => c.signed_date ? esc(c.signed_date) : '<span class="faint">—</span>' }
  ],
  onRowClick: (c) => { location.href = `contract.html?id=${encodeURIComponent(c.id)}`; },
  load: (o) => contractRepo.getAll(o),
  emptyText: 'No contracts yet. Click “+ Add Contract” to create the first one.'
});
