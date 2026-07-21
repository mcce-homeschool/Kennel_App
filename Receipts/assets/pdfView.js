// pdfView.js — "Save as PDF" for receipt photos. No PDF library: it builds a
// clean, one-receipt-per-page printable view in the current document and calls
// window.print(), so the user saves it via the browser's own Print → Save as
// PDF (same posture as KennelOS's invoice/puppy-record print docs, and iOS-safe
// because nothing is opened in a popup). Fully offline.
//
// Each page shows the receipt image plus its details (receipt #, date, amount,
// vendor, category, business, subject, notes) — a self-documenting archive for
// tax time. Entries with no photo are skipped.
import { photoRepo } from '../data/photoRepo.js';
import { effectiveAmount } from '../data/entryRepo.js';
import { categoryLabel, subjectTypeLabel } from '../data/vocab.js';
import { esc, fmtMoney, fmtDate, toast } from './ui.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function detailRows(e) {
  const subj = e.subject_type === 'dog'
    ? (e.subject_name || 'Dog')
    : (e.subject_name || 'Kennel');
  const rows = [
    ['Receipt #', e.receipt_number],
    ['Date', fmtDate(e.entry_date)],
    ['Amount', fmtMoney(effectiveAmount(e))],
    e.kind === 'trip' ? ['Mileage', `${e.miles ?? '?'} mi × ${fmtMoney(e.mileage_rate)}/mi`] : ['Vendor', e.vendor],
    ['Category', categoryLabel(e.category)],
    ['Attached to', `${subjectTypeLabel(e.subject_type)}${subj ? ` — ${subj}` : ''}`],
    ['Business', e.business],
    ['Notes', e.notes]
  ].filter(([, v]) => v != null && v !== '');
  return rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
}

// Build the print view for the given entries and trigger Print → Save as PDF.
// `title` labels the run (e.g. the business name) in the document header.
export async function printReceiptsPdf(entries, title = 'Receipts') {
  const withPhotos = entries.filter((e) => e.photo_id);
  if (!withPhotos.length) { toast('No photos in this selection', 'err'); return; }

  const pages = [];
  for (const e of withPhotos) {
    const p = await photoRepo.get(e.photo_id);
    if (!p?.blob) continue;
    let dataUrl = '';
    try { dataUrl = await blobToDataUrl(p.blob); } catch { continue; }
    pages.push({ e, dataUrl });
  }
  if (!pages.length) { toast('No photos in this selection', 'err'); return; }

  const root = document.createElement('div');
  root.className = 'pdf-root';
  root.innerHTML = pages.map(({ e, dataUrl }) => `
    <section class="pdf-page">
      <div class="pdf-head">
        <span class="pdf-title">${esc(title)}</span>
        <span class="pdf-rcpt">${esc(e.receipt_number || '')}</span>
      </div>
      <div class="pdf-imgwrap"><img src="${dataUrl}" alt="receipt"></div>
      <table class="pdf-meta">${detailRows(e)}</table>
    </section>`).join('');

  document.body.appendChild(root);
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Give the images a tick to lay out before the print dialog snapshots them.
  setTimeout(() => window.print(), 60);
  // Safety net if afterprint never fires (some mobile browsers).
  setTimeout(cleanup, 120000);
}
