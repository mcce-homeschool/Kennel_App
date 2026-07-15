// stud-services.js — Stud Service List screen.
import { studServiceRepo } from '../data/studServiceRepo.js';
import { dogRepo } from '../data/dogRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { createListView } from '../assets/listView.js';
import { badge, esc } from '../assets/ui.js';
import { STUD_SERVICE_DIRECTION, STUD_SERVICE_STATUS } from '../data/vocab.js';

const mount = document.getElementById('stud-service-list');

async function init() {
  const [dogs, contacts] = await Promise.all([
    dogRepo.getAll({ includeArchived: true }),
    contactRepo.getAll({ includeArchived: true })
  ]);
  const dogsById = new Map(dogs.map((d) => [d.id, d]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  const dogName = (id) => dogsById.get(id)?.call_name || '';
  const contactName = (id) => contactsById.get(id)?.name || '';

  createListView({
    mount,
    search: {
      placeholder: 'Search by dog or partner contact…',
      text: (s) => `${dogName(s.our_dog_id)} ${dogName(s.partner_dog_id)} ${contactName(s.partner_contact_id)}`
    },
    filters: [
      { id: 'direction', label: 'Direction', options: STUD_SERVICE_DIRECTION, match: (s, v) => s.direction === v },
      { id: 'status', label: 'Status', options: STUD_SERVICE_STATUS, match: (s, v) => s.status === v }
    ],
    columns: [
      { header: 'Our dog', cell: (s) => `<strong>${esc(dogName(s.our_dog_id) || '—')}</strong>` },
      { header: 'Partner dog', cell: (s) => esc(dogName(s.partner_dog_id) || '—') },
      { header: 'Partner contact', cell: (s) => esc(contactName(s.partner_contact_id) || '—') },
      { header: 'Direction', cell: (s) => badge(STUD_SERVICE_DIRECTION, s.direction) },
      { header: 'Status', cell: (s) => badge(STUD_SERVICE_STATUS, s.status) }
    ],
    onRowClick: (s) => { location.href = `stud-service.html?id=${encodeURIComponent(s.id)}`; },
    load: (o) => studServiceRepo.getAll(o),
    emptyText: 'No stud services yet. Click “+ Add Stud Service” to record the first one.'
  });
}

init();
