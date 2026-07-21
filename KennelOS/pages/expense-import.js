// expense-import.js — wires the Expense CSV importer using the shared import
// view. Feeds the Financials ledger from an external receipts/mileage app (or
// any spreadsheet); returns to the Financials hub's Expenses view on completion.
import { createImportView } from '../assets/importView.js';

createImportView({
  mount: document.getElementById('import-root'),
  entity: 'expense',
  listHref: 'financials.html?view=expenses',
  listLabel: 'Financials'
});
