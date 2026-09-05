import { chromium } from "playwright";
import fs from "node:fs";
const SP = process.env.SP, TAG = process.argv[2];
const rows = JSON.parse(fs.readFileSync(SP + "/claimed.json", "utf8"));
const b = await chromium.launch();
const out = {};
for (const r of rows) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  let text = "", pills = [], err = "";
  try {
    await p.goto(`https://${r.slug}.myhubly.app/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(3000);
    text = await p.evaluate(() => document.body.innerText);
    pills = await p.evaluate(() => [...document.querySelectorAll(".ws-trust-pill")].map((e) => e.innerText.trim()));
  } catch (e) { err = String(e).slice(0, 50); }
  out[r.slug] = { kind: r.account_kind, err, text, pills,
    ticker: /just booked|Someone in/i.test(text),
    stars: /★[^\n]{0,40}\d|(\d[.,]\d)\s*★|\b\d+\s*REVIEWS?\b/i.test(text) };
  await p.close();
}
await b.close();
fs.writeFileSync(`${SP}/cap-${TAG}.json`, JSON.stringify(out, null, 1));
const v = Object.values(out);
console.log(`[${TAG}] pages ${v.length}, errors ${v.filter(x=>x.err).length}`);
console.log(`  ticker visible : ${Object.entries(out).filter(([,x])=>x.ticker).map(([s])=>s).join(", ")||"none"}`);
console.log(`  stars visible  : ${Object.entries(out).filter(([,x])=>x.stars).map(([s])=>s).join(", ")||"none"}`);
console.log(`  pages with trust pills: ${Object.entries(out).filter(([,x])=>x.pills.length).map(([s,x])=>s+"("+x.pills.length+")").join(", ")||"none"}`);
