// invoice.js — Invoice / Receipt print-PDF view (§24). Renders a printable
// financial document for one income record (a Sale or an outgoing StudService),
// covering all five cash income types (deposit, balance, transport, deferred
// boarding, stud fee). Like the Puppy Record, "download" is the browser's own
// Print → Save as PDF — no vendored PDF library.
//
// Query params:
//   source = 'sale' | 'stud'   which income record this bills
//   id     = <record id>
//   doc    = 'invoice' | 'receipt'  (default 'invoice')
//   items  = comma-list of component keys to include (omitted = all cash lines)
//   autoprint = 1  → open the print dialog once rendered (the modal's flow)
//
// Reads only, through the repos (layering rule §2). The line items come from
// incomeView.incomeLineItems so a document can never show a component the Income
// view wouldn't. Configurable fields (payment method / reference / document # /
// notes) are persisted on the record by the Financials generator modal and read
// back here verbatim.
import { saleRepo } from '../data/saleRepo.js';
import { studServiceRepo } from '../data/studServiceRepo.js';
import { dogRepo } from '../data/dogRepo.js';
import { contactRepo } from '../data/contactRepo.js';
import { litterRepo } from '../data/litterRepo.js';
import { kennelRepo } from '../data/kennelRepo.js';
import { incomeLineItems } from '../data/incomeView.js';
import { getMyContactId } from '../data/kennelSetup.js';
import { PLACEMENT_TYPE, SALE_STATUS, STUD_SERVICE_STATUS, FEE_STRUCTURE, descriptor } from '../data/vocab.js';
import { esc, param, fmtMoney } from '../assets/ui.js';

const root = document.getElementById('inv-root');

// This page's own date format (mm/dd/yyyy) — the print-document convention the
// Puppy Record uses too, deliberately not ui.js's localized fmtDate.
function fmtDateMDY(ymd) {
  if (!ymd) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

const todayYMD = () => new Date().toISOString().slice(0, 10);
const money = (v) => fmtMoney(v) || '$0.00';

// A "label: value" row inside the payment-details box — omitted when empty.
function payRow(label, value) {
  if (value == null || value === '') return '';
  return `<div class="inv-row"><span class="inv-k">${esc(label)}</span><span>${value}</span></div>`;
}

// A party (issuer / recipient) card. `lines` are already-escaped HTML strings;
// blanks are dropped.
function partyCard(role, name, lines) {
  const detail = lines.filter(Boolean).join('<br>');
  return `<div class="inv-party">
    <div class="inv-party-role">${esc(role)}</div>
    <div class="inv-name">${name || '<span class="inv-empty">—</span>'}</div>
    ${detail ? `<div class="inv-detail">${detail}</div>` : ''}
  </div>`;
}

async function main() {
  const source = param('source') === 'stud' ? 'stud' : 'sale';
  const doc = param('doc') === 'receipt' ? 'receipt' : 'invoice';
  const id = param('id');
  const itemsParam = param('items');
  const wanted = itemsParam ? new Set(itemsParam.split(',').filter(Boolean)) : null;
  const isReceipt = doc === 'receipt';

  if (!id) { root.innerHTML = '<p class="inv-empty">No record specified.</p>'; return; }

  const record = source === 'sale' ? await saleRepo.getById(id) : await studServiceRepo.getById(id);
  if (!record) { root.innerHTML = '<p class="inv-empty">Record not found.</p>'; return; }
  document.getElementById('inv-back').href = source === 'sale'
    ? `sale.html?id=${encodeURIComponent(id)}`
    : `stud-service.html?id=${encodeURIComponent(id)}`;

  const dogId = source === 'sale' ? record.dog_id : record.our_dog_id;
  const recipientId = source === 'sale' ? record.buyer_contact_id : record.partner_contact_id;
  const [dog, recipient, kennels, myContact] = await Promise.all([
    dogId ? dogRepo.getById(dogId) : null,
    recipientId ? contactRepo.getById(recipientId) : null,
    kennelRepo.getAll({ includeArchived: true }),
    (() => { const cid = getMyContactId(); return cid ? contactRepo.getById(cid) : null; })()
  ]);
  const litter = source === 'sale' && dog && dog.litter_id ? await litterRepo.getById(dog.litter_id) : null;

  // Which own kennel issues this — the dog's own kennel if it's one of ours,
  // else the first own kennel on record (the same fallback puppy-record uses).
  const ownKennel = (dog && dog.kennel_id && kennels.find((k) => k.id === dog.kennel_id))
    || kennels.find((k) => k.is_own_kennel && !k.is_archived)
    || null;

  // Line items: all cash components on the record, optionally narrowed to the
  // set the generator modal checked.
  let items = incomeLineItems(source, record);
  if (wanted) items = items.filter((it) => wanted.has(it.component));

  const subtotal = items.reduce((t, it) => t + it.amount, 0);
  const paid = items.reduce((t, it) => (it.state === 'earned' ? t + it.amount : t), 0);
  const balanceDue = Math.max(subtotal - paid, 0);

  // Document number: the persisted one, or a stable fallback from the id + date.
  const docNumber = (record.invoice_number || '').trim()
    || `${isReceipt ? 'RCT' : 'INV'}-${todayYMD().replace(/-/g, '')}-${String(id).slice(0, 6).toUpperCase()}`;

  // Dates that matter per document type.
  const paymentDate = source === 'sale'
    ? (record.balance_paid_date || record.deposit_date || record.sale_date || '')
    : (record.returned_date || record.sent_date || '');
  const dueDate = source === 'sale' ? (record.balance_due_date || '') : '';

  // --- Issuer / recipient blocks ---
  const issuerLines = [
    myContact && myContact.name && myContact.name !== ownKennel?.kennel_name ? esc(myContact.name) : '',
    ownKennel?.location ? esc(ownKennel.location) : '',
    myContact?.email ? esc(myContact.email) : '',
    myContact?.phone ? esc(myContact.phone) : '',
    ownKennel?.website ? esc(ownKennel.website) : ''
  ];
  const issuerName = esc(ownKennel?.kennel_name || 'Kennel');
  const logoHtml = ownKennel?.logo_data_url
    ? `<img class="inv-logo" src="${esc(ownKennel.logo_data_url)}" alt="${issuerName} logo">`
    : '';

  const recipientLines = recipient ? [
    recipient.address ? esc(recipient.address) : '',
    recipient.email ? esc(recipient.email) : '',
    recipient.phone ? esc(recipient.phone) : ''
  ] : [];

  // "Re:" line — what this document is about.
  const reText = source === 'sale'
    ? `Re: ${dog?.call_name || 'Puppy'}${dog?.registered_name ? ` (${dog.registered_name})` : ''} — ${descriptor(PLACEMENT_TYPE, record.placement_type).label} placement`
    : `Re: Stud service — ${dog?.call_name || 'our dog'} × ${recipient?.name || 'partner'}${record.fee_structure ? ` (${descriptor(FEE_STRUCTURE, record.fee_structure).label})` : ''}`;

  const statusLabel = source === 'sale'
    ? descriptor(SALE_STATUS, record.status).label
    : descriptor(STUD_SERVICE_STATUS, record.status).label;

  // --- Line-item table ---
  const showStatusCol = !isReceipt;
  const itemsBody = items.length
    ? items.map((it) => `<tr>
        <td>${esc(it.label)}</td>
        ${showStatusCol ? `<td class="${it.state === 'earned' ? 'inv-status-paid' : 'inv-status-due'}">${it.state === 'earned' ? 'Paid' : 'Due'}</td>` : ''}
        <td class="num">${esc(money(it.amount))}</td>
      </tr>`).join('')
    : `<tr><td colspan="${showStatusCol ? 3 : 2}" class="inv-empty">No line items selected.</td></tr>`;

  const colSpanLabel = showStatusCol ? 2 : 1;
  const foot = isReceipt
    ? `<tr class="total"><td colspan="${colSpanLabel}">Total paid</td><td class="num">${esc(money(subtotal))}</td></tr>`
    : `<tr><td colspan="${colSpanLabel}">Subtotal</td><td class="num">${esc(money(subtotal))}</td></tr>
       ${paid > 0 ? `<tr><td colspan="${colSpanLabel}">Amount paid</td><td class="num">−${esc(money(paid))}</td></tr>` : ''}
       <tr class="total"><td colspan="${colSpanLabel}">${paid > 0 ? 'Balance due' : 'Total due'}</td><td class="num">${esc(money(paid > 0 ? balanceDue : subtotal))}</td></tr>`;

  // --- Payment details box ---
  const payRows = [
    payRow('Payment method', record.payment_method ? esc(record.payment_method) : ''),
    payRow('Reference', record.payment_reference ? esc(record.payment_reference) : ''),
    isReceipt
      ? payRow('Payment date', paymentDate ? esc(fmtDateMDY(paymentDate)) : '')
      : payRow('Payment due', dueDate ? esc(fmtDateMDY(dueDate)) : '')
  ].filter(Boolean).join('');
  const payNote = isReceipt
    ? (record.payment_method ? `Paid via ${esc(record.payment_method)}. Thank you!` : 'Thank you for your payment!')
    : (record.payment_method ? `Please remit payment via ${esc(record.payment_method)}.` : '');
  const payBox = (payRows || payNote)
    ? `<div class="inv-pay">
        <h3>${isReceipt ? 'Payment received' : 'Payment'}</h3>
        ${payRows}
        ${payNote ? `<p class="inv-detail" style="margin:6px 0 0;">${payNote}</p>` : ''}
      </div>`
    : '';

  document.title = `${isReceipt ? 'Receipt' : 'Invoice'} ${docNumber} — KennelOS`;

  root.innerHTML = `
    <div class="inv-top">
      <div class="inv-issuer">
        ${logoHtml}
        <div>
          <h1>${issuerName}</h1>
          ${issuerLines.filter(Boolean).length ? `<div class="inv-sub">${issuerLines.filter(Boolean).join('\n')}</div>` : ''}
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-doctype">${isReceipt ? 'Receipt' : 'Invoice'}</div>
        <div class="inv-line"><strong>#${esc(docNumber)}</strong></div>
        <div class="inv-line">Date ${esc(fmtDateMDY(todayYMD()))}</div>
        <div class="inv-line">Status: ${esc(statusLabel)}</div>
        ${isReceipt ? '<div class="inv-paid-stamp">Paid</div>' : ''}
      </div>
    </div>

    <div class="inv-parties">
      ${partyCard(isReceipt ? 'Received from' : 'Bill to', recipient ? esc(recipient.name) : '', recipientLines)}
    </div>

    <p class="inv-re">${esc(reText)}</p>

    <table class="inv-items">
      <thead>
        <tr>
          <th>Description</th>
          ${showStatusCol ? '<th>Status</th>' : ''}
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsBody}</tbody>
      <tfoot>${foot}</tfoot>
    </table>

    ${payBox}

    ${record.invoice_notes ? `<div class="inv-notes">${esc(record.invoice_notes)}</div>` : ''}

    <div class="inv-generated">Generated ${esc(fmtDateMDY(todayYMD()))} · KennelOS</div>
  `;

  if (param('autoprint')) setTimeout(() => window.print(), 200);
}

document.getElementById('inv-print').addEventListener('click', () => window.print());

main();
