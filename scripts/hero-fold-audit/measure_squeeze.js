// Squeezed / min-content text-column sweep. Renders each stored page at desktop
// (1440) and phone (390) and flags text-bearing flex/grid children that collapsed
// to ~one-word-per-line. Also flags page horizontal overflow at phone.
// Run: node measure_squeeze.js   (reads corpus.json in this folder)
const { chromium } = require('/Users/adriansmithee/Projects/Hubly/node_modules/playwright');
const fs = require('fs');

const MEASURE = () => {
  // The defect: a TEXT COLUMN in a multi-column grid/flex row that collapsed to
  // min-content — barely wider than its own longest word, so its text stacks and a
  // sibling (usually a photo) eats the rest of the row. Measured the README way:
  // canvas-measure the longest word against the column's content width.
  function longestWordPx(el, words) {
    const cs = getComputedStyle(el);
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d');
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
    let max = 0;
    for (const w of words) { const m = ctx.measureText(w).width; if (m > max) max = m; }
    return max;
  }
  const bad = [];
  // Target BODY COPY: paragraphs and list items (running sentences). A display
  // headline wrapping to two words a line is a style choice, not this defect — so
  // we measure <p>/<li>, and skip anything whose own font is display-sized.
  for (const el of document.querySelectorAll('p, li')) {
    if (el.closest('button, a, nav, header, [role="button"]')) continue;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.fontSize) > 22) continue;   // body copy, not display type
    const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const words = txt ? txt.split(' ').filter(Boolean) : [];
    if (words.length < 5) continue;               // a real sentence, not a label
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (rect.width >= 200) continue;              // a genuinely narrow body column
    // Which ancestor actually IS the flex/grid child that sets this width? Walk up to
    // the nearest child of a flex/grid container; that column is what collapsed.
    let col = el, host = null;
    for (let up = 0; up < 6 && col.parentElement; up++) {
      const pd = getComputedStyle(col.parentElement).display;
      if (/(flex|grid)/.test(pd)) { host = col.parentElement; break; }
      col = col.parentElement;
    }
    if (!host) continue;
    const colRect = col.getBoundingClientRect();
    const contentW = rect.width - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
    const lw = longestWordPx(el, words);
    if (lw < 1) continue;
    const collapsed = contentW <= lw * 1.7;       // barely wider than its longest word
    let sibW = 0;
    for (const sib of host.children) { if (sib !== col) sibW = Math.max(sibW, sib.getBoundingClientRect().width); }
    const multiCol = sibW > colRect.width * 1.4;  // a sibling (usually the photo) eats the row
    if (collapsed && multiCol) {
      const hs = getComputedStyle(host);
      bad.push({ w: Math.round(rect.width), colW: Math.round(colRect.width), longestWord: Math.round(lw),
        words: words.length, colMinWidth: getComputedStyle(col).minWidth, hostDisplay: hs.display,
        gridCols: (hs.gridTemplateColumns || '').slice(0, 70), sibW: Math.round(sibW), sample: txt.slice(0, 55) });
    }
  }
  return { squeezed: bad, docW: document.documentElement.scrollWidth, innerW: window.innerWidth };
};

(async () => {
  const pages = JSON.parse(fs.readFileSync(__dirname + '/corpus.json', 'utf8')).filter(p => p.format === 'html' && p.html);
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];
  for (const [i, p] of pages.entries()) {
    const row = { slug: p.slug, kind: p.kind };
    for (const [w, label] of [[1440, 'desktop'], [390, 'phone']]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      // Abort external image/font requests — layout is fixed by width/height attrs,
      // and this keeps the sweep fast and offline-stable.
      await ctx.route('**/*', r => {
        const t = r.request().resourceType();
        (t === 'font' || t === 'media') ? r.abort() : r.continue();
      });
      const page = await ctx.newPage();
      try {
        await page.setContent(p.html, { waitUntil: 'load', timeout: 20000 }); try{ await page.waitForLoadState('networkidle', { timeout: 6000 }); }catch(e){}
        await page.waitForTimeout(300);
        const m = await page.evaluate(MEASURE);
        row[label] = { squeezed: m.squeezed, overflow: m.docW - m.innerW };
      } catch (e) { row[label] = { err: String(e).slice(0, 60) }; }
      await ctx.close();
    }
    results.push(row);
    if ((i + 1) % 20 === 0) console.error(`  ...${i + 1}/${pages.length}`);
  }
  await browser.close();
  fs.writeFileSync(__dirname + '/squeeze_results.json', JSON.stringify(results, null, 1));

  // Aggregate
  const deskBad = results.filter(r => r.desktop && r.desktop.squeezed && r.desktop.squeezed.length);
  const phoneBad = results.filter(r => r.phone && r.phone.squeezed && r.phone.squeezed.length);
  const phoneOverflow = results.filter(r => r.phone && r.phone.overflow > 2);
  console.log(`\n=== SQUEEZED-COLUMN SWEEP (${results.length} freeform pages) ===`);
  console.log(`desktop (1440) pages with a squeezed text column: ${deskBad.length}`);
  console.log(`phone   (390)  pages with a squeezed text column: ${phoneBad.length}`);
  console.log(`phone   (390)  pages with horizontal overflow:    ${phoneOverflow.length}`);
  console.log(`\n--- desktop offenders (up to 15) ---`);
  for (const r of deskBad.slice(0, 15)) {
    const s = r.desktop.squeezed[0];
    console.log(`  ${r.slug}  [${r.kind}]  worst: ${s.w}px ${s.words}w/${s.lines}L "${s.sample}"`);
  }
})();
