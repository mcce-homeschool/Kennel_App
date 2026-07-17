// sales.js — Sales hub: breeding-style cards, each carrying its linked
// Contract(s) inline (Buckets & Direct Contract Linking Plan v1, Work Area 1A).
// Contract owns the link (`related_sale_id`) — linking/unlinking here is always
// one write to the contract via contractRepo.update, never a field on Sale.
import { saleRepo } from '../data/saleRepo.js';
import { contractRepo } from '../data/contractRepo.js';
import { dogRepo } from '../data/dogRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { PLACEMENT_TYPE, SALE_STATUS, CONTRACT_TYPE, CONTRACT_STATUS, descriptor } from '../data/vocab.js';
import { esc, badge, fmtDate } from '../assets/ui.js';

const PAGE_SIZE = 5; // recent sales shown before "Show more"

const body = document.getElementById('sale-list');
const errorBox = document.getElementById('page-error');

function showError(msg) { errorBox.innerHTML = `<div class="inline-error">${esc(msg)}</div>`; }

// Best available date for "recent", newest first.
function recencyKey(s) {
  return s.sale_date || (s.created_at || '').slice(0, 10) || '';
}

function contractRowHtml(c) {
  return `<div class="row-between" style="padding:6px 0;">
      <span>${badge(CONTRACT_TYPE, c.contract_type)} <a href="contract.html?id=${encodeURIComponent(c.id)}"><strong>${esc(c.title || '(untitled)')}</strong></a> ${badge(CONTRACT_STATUS, c.status)}${c.signed_date ? ` <span class="faint">signed ${esc(fmtDate(c.signed_date))}</span>` : ''}</span>
      <button type="button" class="btn btn-sm" data-act="unlink" data-contract="${esc(c.id)}">✕ Unlink</button>
    </div>`;
}

// The Contract block nested under a sale card — the `litterHtml` sub-block
// equivalent (breeding.js): dashed top border, linked contracts + a picker.
function contractBlockHtml(saleId, linkedContracts, linkableContracts) {
  const items = linkedContracts.length
    ? linkedContracts.map(contractRowHtml).join('')
    : `<div class="muted" style="font-size:13px;">No contracts linked yet.</div>`;
  const options = linkableContracts
    .map((c) => `<option value="${esc(c.id)}">${esc(c.title || '(untitled)')} — ${esc(descriptor(CONTRACT_TYPE, c.contract_type).label)}</option>`)
    .join('');
  return `<div class="sub-block" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border);">
      ${items}
      <div class="pill-row" style="margin-top:8px; align-items:center;">
        ${linkableContracts.length ? `<select class="link-contract-select" data-act="link" data-sale="${esc(saleId)}">
            <option value="">+ Link contract…</option>
            ${options}
          </select>` : ''}
        <a class="btn btn-sm" href="contract.html?new=1&sale=${encodeURIComponent(saleId)}">+ Create contract</a>
      </div>
    </div>`;
}

function saleCard(s, dogsById, contactsById, contractsBySale, linkableContracts) {
  const dog = dogsById.get(s.dog_id);
  const buyer = contactsById.get(s.buyer_contact_id);
  const linked = contractsBySale.get(s.id) || [];
  return `<section class="card" style="margin-top:14px;">
      <div class="row-between">
        <div>
          <a href="sale.html?id=${encodeURIComponent(s.id)}"><strong>${esc(dog?.call_name || '—')} → ${esc(buyer?.name || '—')}</strong></a>
          ${badge(PLACEMENT_TYPE, s.placement_type)} ${badge(SALE_STATUS, s.status)}
          <div class="muted" style="font-size:13px; margin-top:2px;">
            ${s.sale_date ? `Sale date ${esc(fmtDate(s.sale_date))}` : '<span class="faint">No sale date</span>'}
          </div>
        </div>
        <a class="btn btn-sm" href="sale.html?id=${encodeURIComponent(s.id)}">Open sale</a>
      </div>
      ${contractBlockHtml(s.id, linked, linkableContracts)}
    </section>`;
}

async function main() {
  const [sales, dogs, contacts, contracts] = await Promise.all([
    saleRepo.getAll({ includeArchived: false }),
    dogRepo.getAll({ includeArchived: true }),
    contactRepo.getAll({ includeArchived: true }),
    contractRepo.getAll({ includeArchived: false })
  ]);
  const dogsById = new Map(dogs.map((d) => [d.id, d]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const contractsBySale = new Map();
  for (const c of contracts) {
    if (!c.related_sale_id) continue;
    if (!contractsBySale.has(c.related_sale_id)) contractsBySale.set(c.related_sale_id, []);
    contractsBySale.get(c.related_sale_id).push(c);
  }
  for (const list of contractsBySale.values()) {
    list.sort((a, b) => (b.signed_date || b.created_at || '').localeCompare(a.signed_date || a.created_at || ''));
  }
  // Candidates for "+ Link contract": tied to no sale and no stud service.
  const linkableContracts = contracts.filter((c) => !c.related_sale_id && !c.related_stud_service_id);

  if (!sales.length) {
    body.innerHTML = `<div class="card empty-state">No sales yet. Click “+ Add Sale” to record the first placement.</div>`;
    return;
  }

  const sorted = sales.slice().sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)));
  const shown = sorted.slice(0, PAGE_SIZE);
  const rest = sorted.slice(PAGE_SIZE);

  const cardHtml = (s) => saleCard(s, dogsById, contactsById, contractsBySale, linkableContracts);
  const shownHtml = shown.map(cardHtml).join('');
  const restHtml = rest.length
    ? `<div id="sales-more" hidden>${rest.map(cardHtml).join('')}</div>
       <div style="margin-top:14px;"><button class="btn" id="show-more-btn">Show ${rest.length} more sale${rest.length === 1 ? '' : 's'} ▾</button></div>`
    : '';

  body.innerHTML = shownHtml + restHtml;

  const btn = document.getElementById('show-more-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      document.getElementById('sales-more').hidden = false;
      btn.remove();
    });
  }
}

// Delegated on the container (not per-card) so re-renders never leak listeners.
body.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act="unlink"]');
  if (!btn) return;
  try {
    await contractRepo.update(btn.dataset.contract, { related_sale_id: null });
    await main();
  } catch (err) { showError(err.message || String(err)); }
});

body.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-act="link"]');
  if (!sel || !sel.value) return;
  const contractId = sel.value;
  const saleId = sel.dataset.sale;
  try {
    const existing = await contractRepo.getById(contractId);
    await contractRepo.update(contractId, { related_sale_id: saleId, contract_type: existing.contract_type || 'sale' });
    await main();
  } catch (err) { showError(err.message || String(err)); }
});

main().catch((e) => showError(e.message || String(e)));
