import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['hubly.html','public/hubly.html'];
const need=[
  'data-theme',
  'hubly_theme',
  'function toggleHublyTheme',
  'function setHublyTheme',
  'function syncThemeToggleUI',
  'theme-btn-app',
  'theme-bar-btn',
  'html[data-theme="night"]',
  'color-scheme:dark',
  'theme-btn-float',
];
let failed=false;
for(const rel of files){
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  console.log('Checking',rel);
  for(const n of need){
    if(!html.includes(n)){console.error('  MISS',n);failed=true;}
    else console.log('  OK',n);
  }
  if(!html.includes(".app-bar .theme-bar-btn{display:inline-flex!important}")){
    console.error('  MISS mobile theme button keep-visible rule');
    failed=true;
  } else console.log('  OK mobile theme button visible');
}
process.exit(failed?1:0);
