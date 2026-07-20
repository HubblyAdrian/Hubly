import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['hubly.html','public/hubly.html'];
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
