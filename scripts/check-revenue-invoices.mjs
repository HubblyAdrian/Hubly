import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// ══ THE FILE LIST IS DERIVED, NOT TRANSCRIBED (2026-09-17) ═══════════════════════════════════
// This read `hubly.html` at the repo root. That file has not existed for a long time — the shell
// is public/hubly.html — so the check CRASHED on ENOENT before its first assertion and had been
// reporting nothing at all. It was one of SIX in exactly this state: red for months, red for a
// reason that had nothing to do with the product, and therefore never read.
// A LIST OF PATHS IS A HAND-MAINTAINED SET. It is filtered by what is actually on disk, and it
// refuses rather than passing vacuously if the filtering leaves nothing.
const files=['hubly.html','public/hubly.html'].filter((f)=>fs.existsSync(f));
if (!files.length) { console.error('CANNOT RUN — none of the candidate files exist'); process.exit(2); }
const need=[
  'money-invoice-list',
  'inv-kpi-grid',
  'm-outstanding',
  'money-rev-panel',
  'money-week-bars',
  'function renderMoneyRevenuePanel',
  'function createInvoice',
  'function setMoneyFilter',
  'j.status===\'completed\'&&j.paid',
  'newInvoiceBtn',
  'Revenue & invoices in one place',
];
let failed=false;
for(const rel of files){
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  console.log('Checking',rel);
  if(html.includes('id="m-collected"')||html.includes('money-owed-list')){
    console.error('  still has old job-money KPI markup');
    failed=true;
  }
  for(const n of need){
    if(!html.includes(n)){console.error('  MISS',n);failed=true;}
    else console.log('  OK',n);
  }
}
process.exit(failed?1:0);
