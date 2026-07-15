// contacts.js — Contact List screen, using the shared listView component.
// "Buyers" is a filtered Contact view (?buyer=1), not a separate table/repo/page
// (Data Model v3 §5.5) — a contact with a `buyer` role and/or a non-null
// waitlist_status.
import { contactRepo } from '../data/contactRepo.js';
import { kennelRepo } from '../data/kennelRepo.js';
import { createListView } from '../assets/listView.js';
import { badges, badge, esc, param } from '../assets/ui.js';
import { CONTACT_TYPE, WAITLIST_STATUS } from '../data/vocab.js';

const mount = document.getElementById('contact-list');
const buyerView = !!param('buyer');

function isBuyer(c) {
  return (c.contact_type || []).includes('buyer') || (c.waitlist_status && c.waitlist_status !== 'none');
}

function renderViewToggle() {
  const toggle = document.getElementById('contacts-view-toggle');
  toggle.innerHTML = buyerView
    ? `<a class="btn btn-sm" href="contacts.html">← All contacts</a>`
    : `<a class="btn btn-sm" href="contacts.html?buyer=1">Buyers only →</a>`;
  if (buyerView) {
    document.getElementById('contacts-title').textContent = 'Buyers';
    document.getElementById('contacts-subtitle').textContent =
      'Contacts with a buyer role or a waitlist status — a filtered view of Contacts, not a separate table.';
  }
}

async function init() {
  renderViewToggle();
  const kennels = await kennelRepo.getAll({ includeArchived: true });
  const kennelName = (id) => kennels.find((k) => k.id === id)?.kennel_name || '';

  createListView({
    mount,
    baseFilter: buyerView ? isBuyer : () => true,
    search: {
      placeholder: 'Search name, email, phone…',
      text: (c) => `${c.name || ''} ${c.email || ''} ${c.phone || ''}`
    },
    filters: [
      { id: 'type', label: 'Type', options: CONTACT_TYPE, match: (c, v) => (c.contact_type || []).includes(v) },
      { id: 'waitlist', label: 'Waitlist', options: WAITLIST_STATUS.filter((w) => w.value !== 'none'), match: (c, v) => c.waitlist_status === v }
    ],
    columns: [
      { header: 'Name', cell: (c) => `<strong>${esc(c.name)}</strong>` },
      { header: 'Type', cell: (c) => badges(CONTACT_TYPE, c.contact_type) },
      { header: 'Waitlist', cell: (c) => c.waitlist_status && c.waitlist_status !== 'none' ? badge(WAITLIST_STATUS, c.waitlist_status) : '<span class="faint">—</span>' },
      { header: 'Kennel', cell: (c) => c.kennel_id ? esc(kennelName(c.kennel_id)) : '<span class="faint">—</span>' },
      { header: 'Phone', cell: (c) => c.phone ? esc(c.phone) : '<span class="faint">—</span>' },
      { header: 'Email', cell: (c) => c.email ? esc(c.email) : '<span class="faint">—</span>' }
    ],
    onRowClick: (c) => { location.href = `contact.html?id=${encodeURIComponent(c.id)}`; },
    load: (o) => contactRepo.getAll(o),
    emptyText: buyerView ? 'No buyers yet.' : 'No contacts yet. Click “+ Add Contact” to create the first one.'
  });
}

init();
