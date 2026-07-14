// contacts.js — Contact List screen, using the shared listView component.
import { contactRepo } from '../data/contactRepo.js';
import { kennelRepo } from '../data/kennelRepo.js';
import { createListView } from '../assets/listView.js';
import { badges, esc } from '../assets/ui.js';
import { CONTACT_TYPE } from '../data/vocab.js';

const mount = document.getElementById('contact-list');

async function init() {
  const kennels = await kennelRepo.getAll({ includeArchived: true });
  const kennelName = (id) => kennels.find((k) => k.id === id)?.kennel_name || '';

  createListView({
    mount,
    search: {
      placeholder: 'Search name, email, phone…',
      text: (c) => `${c.name || ''} ${c.email || ''} ${c.phone || ''}`
    },
    filters: [
      { id: 'type', label: 'Type', options: CONTACT_TYPE, match: (c, v) => (c.contact_type || []).includes(v) }
    ],
    columns: [
      { header: 'Name', cell: (c) => `<strong>${esc(c.name)}</strong>` },
      { header: 'Type', cell: (c) => badges(CONTACT_TYPE, c.contact_type) },
      { header: 'Kennel', cell: (c) => c.kennel_id ? esc(kennelName(c.kennel_id)) : '<span class="faint">—</span>' },
      { header: 'Phone', cell: (c) => c.phone ? esc(c.phone) : '<span class="faint">—</span>' },
      { header: 'Email', cell: (c) => c.email ? esc(c.email) : '<span class="faint">—</span>' }
    ],
    onRowClick: (c) => { location.href = `contact.html?id=${encodeURIComponent(c.id)}`; },
    load: (o) => contactRepo.getAll(o),
    emptyText: 'No contacts yet. Click “+ Add Contact” to create the first one.'
  });
}

init();
