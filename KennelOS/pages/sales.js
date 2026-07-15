// sales.js — Sale List screen. Shared listView with placement/status filters.
import { saleRepo } from '../data/saleRepo.js';
import { dogRepo } from '../data/dogRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { createListView } from '../assets/listView.js';
import { badge, esc } from '../assets/ui.js';
import { PLACEMENT_TYPE, SALE_STATUS } from '../data/vocab.js';

const mount = document.getElementById('sale-list');

async function init() {
  const [dogs, contacts] = await Promise.all([
    dogRepo.getAll({ includeArchived: true }),
    contactRepo.getAll({ includeArchived: true })
  ]);
  const dogsById = new Map(dogs.map((d) => [d.id, d]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  const dogName = (id) => dogsById.get(id)?.call_name || '';
  const buyerName = (id) => contactsById.get(id)?.name || '';

  createListView({
    mount,
    search: {
      placeholder: 'Search by dog or buyer name…',
      text: (s) => `${dogName(s.dog_id)} ${buyerName(s.buyer_contact_id)}`
    },
    filters: [
      { id: 'placement', label: 'Placement', options: PLACEMENT_TYPE, match: (s, v) => s.placement_type === v },
      { id: 'status', label: 'Status', options: SALE_STATUS, match: (s, v) => s.status === v }
    ],
    columns: [
      { header: 'Dog', cell: (s) => `<strong>${esc(dogName(s.dog_id) || '—')}</strong>` },
      { header: 'Buyer', cell: (s) => esc(buyerName(s.buyer_contact_id) || '—') },
      { header: 'Placement', cell: (s) => badge(PLACEMENT_TYPE, s.placement_type) },
      { header: 'Status', cell: (s) => badge(SALE_STATUS, s.status) },
      { header: 'Sale date', cell: (s) => s.sale_date ? esc(s.sale_date) : '<span class="faint">—</span>' }
    ],
    onRowClick: (s) => { location.href = `sale.html?id=${encodeURIComponent(s.id)}`; },
    load: (o) => saleRepo.getAll(o),
    emptyText: 'No sales yet. Click “+ Add Sale” to record the first placement.'
  });
}

init();
