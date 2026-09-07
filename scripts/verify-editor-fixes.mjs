import { readFileSync } from 'node:fs';
// The functions under test are lifted VERBATIM out of public/hubly.html at run
// time by scripts/lift-editor-fixes.mjs, so this never drifts from what ships.
import { slimBizPayload, svcDesc, addDesc, TOASTS, SLIM_MAX_PORTFOLIO, SLIM_MAX_ALBUM } from './.editor-fixes.generated.mjs';
let fail=0; const ok=(c,l,d='')=>{console.log((c?'  PASS  ':'  FAIL  ')+l+(d?'   '+d:''));if(!c)fail++;};

console.log('\n=== F1 — the description fallback, three cases ===');
// the shape hydration produces: BOTH keys, both '' for a service with no description
ok(svcDesc({desc:'TESTEDIT1', description:''})==='TESTEDIT1',
   'owner types text (desc set, description stale-empty)', JSON.stringify(svcDesc({desc:'TESTEDIT1',description:''})));
ok(svcDesc({desc:'', description:'OLD TEXT'})==='',
   'owner CLEARS text — must NOT resurrect description', JSON.stringify(svcDesc({desc:'',description:'OLD TEXT'})));
ok(svcDesc({description:'FROM RECORD'})==='FROM RECORD',
   'object never through the editor (no desc key) falls back');
ok(svcDesc({desc:null, description:'X'})==='', 'desc present but null -> empty, not resurrection');
ok(addDesc({desc:'ADDON TEXT', description:''})==='ADDON TEXT', 'add-on twin: same fix');
ok(addDesc({desc:'', description:'OLD'})==='', 'add-on twin: clear does not resurrect');
console.log('  (the OLD expression returned '+JSON.stringify('')+' for case 1 — that was the shipped bug)');

console.log('\n=== F2 — the ceilings, against GRAEF\'S REAL EXPORTED META ===');
const row=JSON.parse(readFileSync('/Users/adriansmithee/Projects/Hubly/exports/graefs-autocare-2026-09-07T18-05-36/01-businesses-row.json','utf8'));
const meta=JSON.parse(row.meta);
const before={portfolio:meta.portfolioUrls.length, albums:meta.website.galleryAlbums.map(a=>(a.urls||[]).length)};
console.log('  his real record in:  portfolio '+before.portfolio+', albums ['+before.albums+']');
TOASTS.length=0;
const out=slimBizPayload({meta:JSON.parse(JSON.stringify(meta))});
const after={portfolio:out.meta.portfolioUrls.length, albums:out.meta.website.galleryAlbums.map(a=>(a.urls||[]).length)};
console.log('  after slimBizPayload: portfolio '+after.portfolio+', albums ['+after.albums+']');
ok(after.portfolio===26, 'all 26 portfolio URLs survive (old cap 16 dropped 10)');
ok(JSON.stringify(after.albums)===JSON.stringify(before.albums), 'every album unchanged');
ok(TOASTS.length===0, 'no owner notification when nothing was dropped');

// the case Adrian asked for: an album pushed past the OLD ceiling of 12
const m13=JSON.parse(JSON.stringify(meta));
m13.website.galleryAlbums[0].urls.push('https://example.com/thirteenth.jpg');
const o13=slimBizPayload({meta:m13});
ok(o13.meta.website.galleryAlbums[0].urls.length===13, 'album pushed to 13 keeps all 13 (old cap would drop the 13th)');
ok(o13.meta.website.galleryAlbums[0].urls.includes('https://example.com/thirteenth.jpg'), 'the 13th photo specifically survives');

console.log('\n=== F2 — the notification path, by exceeding the NEW ceilings ===');
const big=JSON.parse(JSON.stringify(meta));
big.portfolioUrls=Array.from({length:SLIM_MAX_PORTFOLIO+3},(_,i)=>'https://example.com/p'+i+'.jpg');
big.website.galleryAlbums[0].urls=Array.from({length:SLIM_MAX_ALBUM+2},(_,i)=>'https://example.com/a'+i+'.jpg');
TOASTS.length=0;
const ob=slimBizPayload({meta:big});
ok(ob.meta.portfolioUrls.length===SLIM_MAX_PORTFOLIO, 'portfolio trims at the new ceiling ('+SLIM_MAX_PORTFOLIO+')');
ok(ob.meta.website.galleryAlbums[0].urls.length===SLIM_MAX_ALBUM, 'album trims at the new ceiling ('+SLIM_MAX_ALBUM+')');
ok(TOASTS.length===1, 'the owner IS told, exactly once');
console.log('  toast: '+JSON.stringify(TOASTS[0]));
ok(/3 portfolio photos/.test(TOASTS[0])&&/2 photos from "Interior"/.test(TOASTS[0]), 'the message names the counts and the album');

console.log('\n=== F2 — the data:image protection is UNCHANGED (the reason the function exists) ===');
const blob=JSON.parse(JSON.stringify(meta));
blob.website.ownerPhotoUrl='data:image/jpeg;base64,AAAA';
blob.portfolioUrls=[...blob.portfolioUrls,'data:image/png;base64,BBBB'];
const ob2=slimBizPayload({meta:blob});
ok(!JSON.stringify(ob2.meta).includes('data:image'), 'no data:image survives — the original defence still holds');

console.log(fail?('\n'+fail+' CHECK(S) FAILED'):'\nALL CHECKS PASSED');
process.exit(fail?1:0);
