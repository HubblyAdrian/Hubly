import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const SNIP = "Set up your public page, booking, and the tools to take jobs";
const b = await chromium.launch();
for (const slug of ["aquaspeed", "graefs-autocare", "lugnuts-regulators"]) {
  const p = await b.newPage({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  try {
    await p.goto(`https://${slug}.myhubly.app/`, { waitUntil: "networkidle", timeout: 60000 });
    await p.waitForTimeout(4000);
    const r = await p.evaluate((SNIP) => {
      const vis = (document.body.innerText || "").replace(/\s+/g, " ").trim();   // what a reader sees
      const all = (document.body.textContent || "").replace(/\s+/g, " ").trim(); // present, hidden included
      const h1s = [...document.querySelectorAll("h1")].map((h) => ({
        t: (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48),
        shown: !!(h.offsetParent || h.getClientRects().length),
      }));
      return {
        visLen: vis.length, allLen: all.length,
        snipVisible: vis.includes(SNIP), snipPresent: all.includes(SNIP),
        onboardVisible: vis.includes("Tell Hubly about your business"),
        onboardPresent: all.includes("Tell Hubly about your business"),
        h1shown: h1s.filter((h) => h.shown).map((h) => h.t),
        h1count: h1s.length,
        desc: (document.querySelector('meta[name=description]') || {}).content || null,
        title: document.title,
        first120: vis.slice(0, 120),
      };
    }, SNIP);
    console.log(`═══ ${slug}`);
    console.log(`  title=${JSON.stringify(r.title)}  desc=${JSON.stringify(r.desc)}`);
    console.log(`  rendered text: ${r.visLen} chars VISIBLE / ${r.allLen} present   (${r.h1count} h1 nodes, ${r.h1shown.length} shown: ${JSON.stringify(r.h1shown)})`);
    console.log(`  the ranking snippet:  visible=${r.snipVisible}  present-in-DOM=${r.snipPresent}`);
    console.log(`  "Tell Hubly about…":  visible=${r.onboardVisible}  present-in-DOM=${r.onboardPresent}`);
    console.log(`  page opens: ${JSON.stringify(r.first120)}`);
  } catch (e) { console.log(`═══ ${slug}  COULD NOT LOAD: ${e.message.slice(0,70)}`); }
  await p.close();
}
await b.close();
