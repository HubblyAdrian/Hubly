// Test candidate CSS safety-nets against broken pages (must fix) and correct pages
// (must not change). Renders original vs patched, re-measures the squeeze signature
// and horizontal overflow.
const { chromium } = require('/Users/adriansmithee/Projects/Hubly/node_modules/playwright');
const fs = require('fs');

const MEASURE = () => {
  function longestWordPx(el, words){const cs=getComputedStyle(el);const c=document.createElement('canvas').getContext('2d');c.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;let m=0;for(const w of words){const x=c.measureText(w).width;if(x>m)m=x;}return m;}
  const bad=[];
  for(const el of document.querySelectorAll('p, li')){
    if(el.closest('button,a,nav,header,[role="button"]'))continue;
    const cs=getComputedStyle(el); if(parseFloat(cs.fontSize)>22)continue;
    const txt=(el.innerText||'').replace(/\s+/g,' ').trim(); const words=txt?txt.split(' ').filter(Boolean):[];
    if(words.length<5)continue;
    const rect=el.getBoundingClientRect(); if(rect.width<1||rect.width>=200)continue;
    let col=el,host=null; for(let u=0;u<6&&col.parentElement;u++){if(/(flex|grid)/.test(getComputedStyle(col.parentElement).display)){host=col.parentElement;break;}col=col.parentElement;}
    if(!host)continue;
    const contentW=rect.width-parseFloat(cs.paddingLeft||'0')-parseFloat(cs.paddingRight||'0');
    const lw=longestWordPx(el,words); if(lw<1)continue;
    let sibW=0;for(const s of host.children){if(s!==col)sibW=Math.max(sibW,s.getBoundingClientRect().width);}
    if(contentW<=lw*1.7 && sibW>col.getBoundingClientRect().width*1.4) bad.push(Math.round(rect.width));
  }
  return {squeezed:bad.length, minTextW: bad.length?Math.min(...bad):null, overflow: document.documentElement.scrollWidth-window.innerWidth};
};

// Deterministic post-process: wrap bare `Nfr` grid tracks in minmax(0, Nfr) so a
// track can shrink below its content's min-content instead of collapsing a sibling.
// Skip any grid-template-columns value that already uses minmax() (avoid nesting).
function frToMinmax(html) {
  return html.replace(/grid-template-columns\s*:\s*([^;{}"']+)/gi, (m, val) => {
    if (/minmax/i.test(val)) return m;
    const fixed = val.replace(/(\d*\.?\d+)fr/g, 'minmax(0,$1fr)');
    return m.replace(val, fixed);
  });
}
const PATCHES = {
  'star-min-width-0': (h) => h.includes('</body>') ? h.replace('</body>', `<style id="hubly-net">*{min-width:0}</style></body>`) : h + `<style>*{min-width:0}</style>`,
  'fr-to-minmax': (h) => frToMinmax(h),
};

(async () => {
  const corpus = Object.fromEntries(JSON.parse(fs.readFileSync(__dirname+'/corpus.json','utf8')).filter(p=>p.html).map(p=>[p.slug,p.html]));
  const broken = ['mobile-detailing-in-lehi-849a2','aviation-lessons-in-lehi','mobile-detailing-in-lehi-74738','mobile-detailer-supplies'];
  const correct = ['el-nopalito','tidepool-coffee','clearwater-kayak-rentals','fernwick-bakehouse'];
  const browser = await chromium.launch({channel:'chrome'});
  async function render(html,w){
    const ctx=await browser.newContext({viewport:{width:w,height:900}});
    await ctx.route('**/*',r=>{const t=r.request().resourceType();(t==='image'||t==='font'||t==='media')?r.abort():r.continue();});
    const pg=await ctx.newPage(); await pg.setContent(html,{waitUntil:'load',timeout:15000}); await pg.waitForTimeout(120);
    const m=await pg.evaluate(MEASURE); await ctx.close(); return m;
  }
  for(const pname of Object.keys(PATCHES)){
    console.log(`\n########## PATCH: ${pname} ##########`);
    for(const [label,list] of [['BROKEN (want squeezed->0)',broken],['CORRECT (want NO change)',correct]]){
      console.log(`=== ${label} ===`);
      for(const slug of list){
        const html=corpus[slug]; if(!html){console.log(slug,'(missing)');continue;}
        const patched=PATCHES[pname](html);
        const o=await render(html,1440), f=await render(patched,1440);
        const op=await render(html,390), fp=await render(patched,390);
        console.log(`  ${slug}: desk squeezed ${o.squeezed}->${f.squeezed} (minW ${o.minTextW}->${f.minTextW}) ovf ${o.overflow}->${f.overflow} | phone sq ${op.squeezed}->${fp.squeezed} ovf ${op.overflow}->${fp.overflow}`);
      }
    }
  }
  await browser.close();
})();
