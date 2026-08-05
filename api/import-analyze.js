/**
 * Hubly Session import analyzer (Rule #24)
 * Starts real analysis when a visitor pastes website / social URLs.
 * Website: server-side HTML fetch + structure extract.
 * Social: structured partial analysis (handle / listing signals) — deeper vendor import continues in Builder.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 900KB was sized for the original analysis (title/meta/h1s — all near the
// top of <head>). Structure extraction needs real <body> content, which on
// a bloated real-world page (inline design-system CSS, page-builder markup)
// can start well past 900KB — confirmed on a real fixture where <head>
// alone ran 1.57MB, so <body> never arrived at the old cap and every
// structural field came back an honest-looking but wrong "not found".
// Raised, not removed, to keep this bounded.
const MAX_BYTES = 3000000;
const TIMEOUT_MS = 8000;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      reject(new Error('invalid_url'));
      return;
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      reject(new Error('unsupported_protocol'));
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'HublyImportBot/1.0 (+https://hubly.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, parsed).toString();
          res.resume();
          fetchText(next).then(resolve, reject);
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size <= MAX_BYTES) chunks.push(c);
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            contentType: String(res.headers['content-type'] || ''),
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

function meta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i'
  );
  const m = html.match(re) || html.match(re2);
  return m ? decode(m[1]) : '';
}

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s) {
  return decode(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

// ---------------------------------------------------------------------------
// Stage 1 structural extraction (Typography / Navigation / Hero / Sections).
//
// Deliberately separate from analyzeWebsite() below and from its return
// value: this is exposed as a sibling top-level "structure" key in the API
// response, never nested inside "analysis" — the website.analyze capability
// handler (supabase/functions/_shared/hubly_capability_registry.ts) only
// ever forwards `r.analysis` to the model as `raw`, so `structure` never
// reaches a prompt by construction, not by convention. Not read by anything
// else yet — this is extraction only, unverified until proven on real
// fixtures, per the explicit scope for this pass.
//
// No AI, no screenshots, no rendering — regex/selector heuristics over the
// real fetched HTML plus a small, bounded number of same-origin linked CSS
// files. This does NOT resolve real CSS cascade/specificity or computed
// styles the way a browser would; every heuristic below is documented at
// the point it's used, and returns null rather than a best guess whenever
// the signal is genuinely ambiguous — per the honesty rule, a wrong answer
// is worse than an honest null.
// ---------------------------------------------------------------------------

const CSS_FETCH_TIMEOUT_MS = 3000;
const CSS_MAX_BYTES = 350000;
const CSS_MAX_FILES = 2;

const GENERIC_FONT_KEYWORDS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system',
  'blinkmacsystemfont', 'inherit', 'initial', 'unset', 'revert',
]);

const CTA_TEXT_RE = /\b(book( now)?|get started|contact( us)?|sign ?up|schedule|request a?n? (quote|estimate|appointment|callback|call)|get a? (quote|estimate)|buy now|shop now|call now|reserve|order now|start now|free (quote|estimate)|get in touch|learn more)\b/i;
const CTA_CLASS_RE = /\b(btn|button|cta)\b/i;

function fetchCssFile(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      resolve('');
      return;
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      resolve('');
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'HublyImportBot/1.0 (+https://hubly.app)', Accept: 'text/css,*/*' },
        timeout: CSS_FETCH_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, parsed).toString();
          res.resume();
          fetchCssFile(next).then(resolve);
          return;
        }
        if (res.statusCode >= 400) {
          res.resume();
          resolve('');
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size <= CSS_MAX_BYTES) chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.on('error', () => resolve(''));
    req.end();
  });
}

// Same-origin only — a cross-origin stylesheet (a CDN, a font host) isn't
// where a site's own header/hero/typography rules live, and fetching
// arbitrary third-party URLs on someone's behalf is its own can of worms.
async function fetchSameOriginCss(html, pageUrl) {
  let base;
  try { base = new URL(pageUrl); } catch (e) { return ''; }
  const hrefs = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    if (!/rel=["']?stylesheet["']?/i.test(tag)) continue;
    const hrefM = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefM) continue;
    let abs;
    try { abs = new URL(hrefM[1], base); } catch (e) { continue; }
    if (abs.hostname !== base.hostname) continue;
    hrefs.push(abs.toString());
    if (hrefs.length >= CSS_MAX_FILES) break;
  }
  if (!hrefs.length) return '';
  const bodies = await Promise.all(hrefs.map(fetchCssFile));
  return bodies.join('\n');
}

// Recursive brace-depth walker — correct for nested @media/@supports blocks,
// which a flat regex mismatches (it treats the query text as a selector and
// gets its brace-counting out of sync for everything after). Skips other
// at-rules (@font-face, @keyframes, @import, ...) since we only need
// selector -> declaration pairs.
function extractCssRules(cssText) {
  const clean = String(cssText || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const n = clean.length;
  let i = 0;
  while (i < n) {
    const brace = clean.indexOf('{', i);
    if (brace === -1) break;
    const header = clean.slice(i, brace).trim();
    let depth = 0, close = n;
    for (let j = brace; j < n; j++) {
      if (clean[j] === '{') depth++;
      else if (clean[j] === '}') { depth--; if (depth === 0) { close = j; break; } }
    }
    const inner = clean.slice(brace + 1, close);
    if (/^@(media|supports)/i.test(header)) {
      rules.push(...extractCssRules(inner));
    } else if (header && !header.startsWith('@')) {
      const selectors = header.split(',').map((s) => s.trim()).filter(Boolean);
      if (selectors.length) rules.push({ selectors, body: inner });
    }
    i = close + 1;
  }
  return rules;
}

// Icon fonts (Font Awesome, theme-bundled glyph sets) are real font-family
// declarations but not a typography choice anyone would recognize as "the
// site's font" — reporting one as Primary/Secondary would be technically
// non-fabricated but genuinely misleading, so they're excluded at the
// source rather than left for a caller to filter.
const ICON_FONT_NAME_RE = /icon|glyph|awesome|symbol|webfont|emoji/i;

function firstNamedFont(value) {
  const parts = String(value || '').split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
  for (const p of parts) {
    if (p && !GENERIC_FONT_KEYWORDS.has(p.toLowerCase()) && !ICON_FONT_NAME_RE.test(p)) return p;
  }
  return null;
}

// Three real outcomes, not two: no font-family here at all ('absent'); one
// present but naming a CSS custom property this doesn't resolve
// ('unresolved' — var(--x), common on page-builder/design-token themes);
// or a literal, reportable name ('resolved'). Collapsing 'unresolved' into
// the same null as 'absent' is what caused a real bug on a real fixture: a
// specific `body{font-family:var(--x)}` got silently skipped as if it
// didn't exist, so a same-page but unrelated `:root{font-family:'Kumbh
// Sans'}` rule won by default — reporting a real font, just the wrong one.
function fontFamilyDeclKind(body) {
  const m = String(body || '').match(/font-family\s*:\s*([^;]+)/i);
  if (!m) return { kind: 'absent' };
  if (/var\(/i.test(m[1])) return { kind: 'unresolved' };
  const font = firstNamedFont(m[1]);
  return font ? { kind: 'resolved', font } : { kind: 'absent' };
}

function declFontFamily(body) {
  const d = fontFamilyDeclKind(body);
  return d.kind === 'resolved' ? d.font : null;
}

function declPosition(body) {
  const m = String(body || '').match(/position\s*:\s*(sticky|fixed|static|relative|absolute)/i);
  return m ? m[1].toLowerCase() : null;
}

function isHeadingSelector(sel) {
  return /(^|[\s>+~])h[1-6](\b|[.#:\[])/i.test(sel) || /^h[1-6]$/i.test(sel.trim());
}

function isBodySelector(sel) {
  const s = sel.trim().toLowerCase();
  return s === 'body' || s === 'html' || s === ':root' || s === '*';
}

// Google Fonts <link> URLs name the exact families they load — a real,
// unambiguous signal for "which fonts exist on this page," even though the
// link alone can't say which role (heading vs body) each plays.
function googleFontFamilies(html) {
  const families = [];
  const re = /https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s>]+/gi;
  let m;
  while ((m = re.exec(html))) {
    const qs = m[0].split('?')[1] || '';
    const params = qs.split('&');
    for (const p of params) {
      const mm = p.match(/^family=([^&]+)/);
      if (!mm) continue;
      const name = decodeURIComponent(mm[1]).split(':')[0].replace(/\+/g, ' ').trim();
      if (name && !families.includes(name)) families.push(name);
    }
  }
  return families;
}

// Cascade order isn't fully resolvable via regex, but selector-precedence
// is a reasonable approximation: prefer the plainest, most-targeted
// selector (a bare `h1`/`body` beats a compound one). Tracked per-rank
// rather than as a single running "best" value so that a more-specific
// rank's *unresolved* declaration can block a less-specific rank's
// resolved one from winning by default (see fontFamilyDeclKind above) —
// that fallthrough is what produced a real wrong answer on a real site.
function pickTieredFont(cssRules, isRoleSelector, rankOf, worstRank) {
  const tiers = new Array(worstRank + 1).fill(null); // { kind, font? } per rank
  for (const rule of cssRules) {
    const decl = fontFamilyDeclKind(rule.body);
    if (decl.kind === 'absent') continue;
    for (const sel of rule.selectors) {
      if (!isRoleSelector(sel)) continue;
      const rank = rankOf(sel.trim().toLowerCase());
      if (tiers[rank] && tiers[rank].kind === 'resolved') continue; // later dup rule at same rank: keep first found, close enough
      tiers[rank] = decl;
    }
  }
  for (let r = 0; r <= worstRank; r++) {
    const t = tiers[r];
    if (!t) continue;
    if (t.kind === 'resolved') return t.font;
    if (t.kind === 'unresolved') return null; // a more-specific rule exists but can't be read — don't fall through
  }
  return null;
}

function analyzeTypography(html, cssRules) {
  const headingRankOf = (bare) => { const m = bare.match(/^h[1-6]/); return m ? { h1: 0, h2: 1, h3: 2 }[m[0]] : 3; };
  const bodyRankOf = (bare) => ({ body: 0, html: 1, ':root': 2, '*': 3 }[bare] ?? 4);
  const headingFont = pickTieredFont(cssRules, isHeadingSelector, headingRankOf, 3);
  const bodyFont = pickTieredFont(cssRules, isBodySelector, bodyRankOf, 4);
  const allFamilies = [];
  for (const rule of cssRules) {
    const f = declFontFamily(rule.body);
    if (f && !allFamilies.includes(f)) allFamilies.push(f);
  }
  for (const f of googleFontFamilies(html)) {
    if (!allFamilies.includes(f)) allFamilies.push(f);
  }
  let primary = bodyFont || headingFont || (allFamilies.length === 1 ? allFamilies[0] : null);
  let secondary = null;
  if (headingFont && primary && headingFont !== primary) {
    secondary = headingFont;
  } else if (primary && allFamilies.length >= 2) {
    secondary = allFamilies.find((f) => f !== primary) || null;
  }
  return { primary, secondary, heading: headingFont, body: bodyFont };
}

function extractBalancedTag(html, tagName, fromIndex) {
  const openRe = new RegExp('<' + tagName + '\\b[^>]*>', 'i');
  const start = html.slice(fromIndex).search(openRe);
  if (start === -1) return null;
  const absStart = fromIndex + start;
  const openMatch = html.slice(absStart).match(openRe);
  const contentStart = absStart + openMatch[0].length;
  const closeRe = new RegExp('</' + tagName + '\\s*>', 'i');
  const closeIdx = html.slice(contentStart).search(closeRe);
  if (closeIdx === -1) return null;
  const contentEnd = contentStart + closeIdx;
  return { openTag: openMatch[0], start: absStart, contentStart, contentEnd, inner: html.slice(contentStart, contentEnd) };
}

function findRelevantCssRules(cssRules, block) {
  const classM = block.openTag.match(/class=["']([^"']+)["']/i);
  const idM = block.openTag.match(/id=["']([^"']+)["']/i);
  const tagM = block.openTag.match(/^<([a-z0-9]+)/i);
  const classes = classM ? classM[1].split(/\s+/).filter(Boolean) : [];
  const id = idM ? idM[1] : null;
  const tag = tagM ? tagM[1].toLowerCase() : null;
  return cssRules.filter((rule) =>
    rule.selectors.some((sel) => {
      const s = sel.trim();
      if (tag && new RegExp('^' + tag + '(\\b|[.#:\\[])', 'i').test(s)) return true;
      if (id && s.includes('#' + id)) return true;
      return classes.some((c) => s.includes('.' + c));
    })
  );
}

// Real sites don't reliably nest nav links inside <header> — found on a
// real fixture (Wix) where <header> holds only the logo (427 chars) and
// the actual menu, including the one nav CTA, lives in a wholly separate
// sibling <nav> (2952 chars). Picking whichever tag is found first
// (header || nav, the original approach) silently discarded the other
// one's content — not a wrong answer so much as an incomplete one, but
// incomplete enough to miss a real CTA and misjudge logo position. Both
// are collected here, in document order, and treated as one region.
function findTopNavRegion(html) {
  const bodyM = html.match(/<body\b[^>]*>/i);
  const bodyStart = bodyM ? bodyM.index + bodyM[0].length : 0;
  const bodyRest = html.slice(bodyStart);
  const searchWindow = bodyRest.slice(0, Math.floor(bodyRest.length * 0.4));

  const headerLocal = extractBalancedTag(searchWindow, 'header', 0);
  const navLocal = extractBalancedTag(searchWindow, 'nav', 0);
  if (!headerLocal && !navLocal) return null;

  const blocks = [headerLocal, navLocal].filter(Boolean).sort((a, b) => a.start - b.start);
  const combinedInner = blocks.map((b) => b.inner).join('\n');
  const contentEnd = bodyStart + Math.max(...blocks.map((b) => b.contentEnd));
  return { blocks, combinedInner, contentEnd };
}

function analyzeNavigation(html, cssRules) {
  const region = findTopNavRegion(html);
  if (!region) {
    return { topNavigation: false, sticky: null, logoPosition: null, ctaPresent: null };
  }

  const relevantRules = region.blocks.flatMap((b) => findRelevantCssRules(cssRules, b));
  let sticky = null;
  for (const rule of relevantRules) {
    const pos = declPosition(rule.body);
    if (pos === 'sticky' || pos === 'fixed') { sticky = true; break; }
    if (pos === 'static' || pos === 'relative') sticky = false;
  }

  const inner = region.combinedInner;
  const logoM = inner.match(/<(?:img|a)\b[^>]*(?:alt|class|id|src|href)=["'][^"']*logo[^"']*["'][^>]*>/i)
    || inner.match(/<[^>]+class=["'][^"']*\bbrand\b[^"']*["'][^>]*>/i);
  let logoPosition = null;
  if (logoM) {
    const logoIdx = inner.indexOf(logoM[0]);
    const linkPositions = [];
    const aRe = /<a\b[^>]*href=["'][^"']+["'][^>]*>/gi;
    let am;
    while ((am = aRe.exec(inner))) {
      if (am[0] !== logoM[0]) linkPositions.push(am.index);
    }
    if (linkPositions.length) {
      const avgLinkIdx = linkPositions.reduce((a, b) => a + b, 0) / linkPositions.length;
      logoPosition = logoIdx < avgLinkIdx ? 'left' : 'right';
    }
  }

  const ctaPresent = CTA_TEXT_RE.test(stripTags(inner)) || CTA_CLASS_RE.test(inner);

  return { topNavigation: true, sticky, logoPosition, ctaPresent };
}

function analyzeHero(html, cssRules, navBlock) {
  const searchFrom = navBlock && navBlock.contentEnd ? navBlock.contentEnd : 0;
  const rest = html.slice(searchFrom);

  let block = null;
  const hintM = rest.match(/<(section|div)\b[^>]*(?:id|class)=["'][^"']*(?:hero|banner|jumbotron|masthead)[^"']*["'][^>]*>/i);
  if (hintM) {
    const tag = hintM[1].toLowerCase();
    block = extractBalancedTag(rest, tag, hintM.index);
  }
  if (!block) {
    const secM = rest.match(/<section\b[^>]*>/i);
    if (secM) block = extractBalancedTag(rest, 'section', secM.index);
  }
  if (!block) {
    // Last resort: whatever block contains the page's first <h1>.
    const h1M = rest.match(/<h1\b/i);
    if (h1M) {
      const divM = rest.slice(0, h1M.index).match(/<div\b[^>]*>[^]*$/i);
      if (divM) block = extractBalancedTag(rest, 'div', rest.lastIndexOf(divM[0]));
    }
  }
  if (!block) {
    return { fullWidth: null, layout: null, backgroundMedia: { present: null, type: null }, ctaPresent: null };
  }

  const relevantRules = findRelevantCssRules(cssRules, block);
  let fullWidth = null;
  for (const rule of relevantRules) {
    if (/max-width\s*:/i.test(rule.body)) { fullWidth = false; break; }
    if (/width\s*:\s*100(%|vw)/i.test(rule.body)) fullWidth = true;
  }

  const hasVideo = /<video\b/i.test(block.inner);
  let hasBgImageCss = false;
  let hasUnresolvedBg = false;
  for (const rule of relevantRules) {
    const m = rule.body.match(/background(-image)?\s*:[^;]+/i);
    if (!m) continue;
    if (/url\(/i.test(m[0])) { hasBgImageCss = true; break; }
    // Same issue as typography: a page-builder theme setting the hero
    // background via a CSS custom property (background-image:var(--x)) is
    // real evidence of a background image mechanism we can't read — not
    // evidence there isn't one. Found on a real fixture where the visible,
    // rendered hero clearly has a background photo the raw CSS never
    // spells out as a literal url().
    if (/var\(/i.test(m[0])) hasUnresolvedBg = true;
  }
  const hasInlineBg = /style=["'][^"']*background(-image)?\s*:[^"']*url\(/i.test(block.inner.slice(0, 400));
  // Plenty of real hero sections aren't a CSS background at all — a plain
  // <img> laid out full-bleed is at least as common on modern site
  // builders (confirmed on a real fixture: a full-width photo hero built
  // entirely from an <img> tag, no background-image anywhere). Small
  // icon-sized images (an explicit width/height under 64px) are excluded
  // so this doesn't fire on a stray icon.
  const hasHeroImgTag = (block.inner.match(/<img\b[^>]*>/gi) || []).some((tag) => {
    if (/\b(icon|logo)\b/i.test(tag)) return false;
    const wM = tag.match(/\bwidth=["']?(\d+)/i);
    const hM = tag.match(/\bheight=["']?(\d+)/i);
    if (wM && Number(wM[1]) < 64) return false;
    if (hM && Number(hM[1]) < 64) return false;
    return true;
  });
  const backgroundMedia = hasVideo
    ? { present: true, type: 'video' }
    : (hasBgImageCss || hasInlineBg || hasHeroImgTag ? { present: true, type: 'image' }
      : (hasUnresolvedBg ? { present: null, type: null } : { present: false, type: null }));

  // Split vs centered: look at the block's direct children only, not
  // everything nested inside them — a heuristic, not real layout
  // resolution, so anything that doesn't clearly match either shape stays
  // null rather than forcing a guess.
  const directChildRe = /<(section|div|article)\b[^>]*>/gi;
  const children = [];
  let dm;
  let searchIdx = 0;
  while ((dm = directChildRe.exec(block.inner)) && children.length < 6) {
    if (dm.index < searchIdx) continue;
    const child = extractBalancedTag(block.inner, dm[1], dm.index);
    if (!child) break;
    children.push(child);
    searchIdx = child.contentEnd;
    directChildRe.lastIndex = searchIdx;
  }
  let layout = null;
  if (children.length === 2) {
    const mediaChild = children.find((c) => /<img\b|<video\b/i.test(c.inner) || /background(-image)?\s*:[^;]*url\(/i.test(c.inner));
    const textChild = children.find((c) => c !== mediaChild && /<h1\b|<p\b/i.test(c.inner));
    if (mediaChild && textChild) layout = 'split';
  } else if (/\b(split|two-col|grid-2)\b/i.test(block.openTag)) {
    layout = 'split';
  } else if (/text-align\s*:\s*center/i.test(relevantRules.map((r) => r.body).join(' ')) || /\b(text-center|centered)\b/i.test(block.openTag)) {
    if (!/<img\b|<video\b/i.test(block.inner.replace(/<(img|video)[^>]*class=["'][^"']*(icon|logo)[^"']*["'][^>]*>/gi, ''))) {
      layout = 'centered';
    }
  }

  const ctaPresent = CTA_TEXT_RE.test(stripTags(block.inner)) || CTA_CLASS_RE.test(block.inner);

  return { fullWidth, layout, backgroundMedia, ctaPresent };
}

const SECTION_LABEL_PATTERNS = [
  ['Hero', /\bhero\b|\bbanner\b|\bmasthead\b|\bjumbotron\b/i],
  ['Services', /\bservice/i],
  ['About', /\babout\b|\bstory\b|who-we-are/i],
  ['Gallery', /\bgallery\b|\bportfolio\b|\bphotos\b/i],
  ['Testimonials', /\btestimonial|\breview/i],
  ['FAQ', /\bfaq\b|\bquestions\b/i],
  ['Contact', /\bcontact\b|get-in-touch|reach-us/i],
];

function classifySectionBlock(block, isFooter) {
  if (isFooter) return 'Footer';
  const hay = (block.openTag + ' ' + (block.inner.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i) || ['', ''])[1]);
  for (const [label, re] of SECTION_LABEL_PATTERNS) {
    if (re.test(hay)) return label;
  }
  return null;
}

function analyzeSections(html) {
  const sections = [];
  let i = 0;
  const secRe = /<section\b[^>]*>/gi;
  let m;
  while ((m = secRe.exec(html))) {
    const block = extractBalancedTag(html, 'section', m.index);
    if (!block) continue;
    const label = classifySectionBlock(block, false);
    if (label) sections.push(label);
    secRe.lastIndex = block.contentEnd;
  }
  const footerM = html.match(/<footer\b[^>]*>/i);
  if (footerM) sections.push('Footer');

  if (sections.length < 2) {
    // Fallback for div/page-builder sites with no <section> tags at all —
    // same classification vocabulary, applied to top-level divs that carry
    // a heading, since that's the next-most-reliable structural signal
    // without a real layout engine.
    const fallback = [];
    const divRe = /<div\b[^>]*(?:id|class)=["'][^"']+["'][^>]*>/gi;
    let dm;
    let lastEnd = 0;
    while ((dm = divRe.exec(html)) && fallback.length < 20) {
      if (dm.index < lastEnd) continue;
      const block = extractBalancedTag(html, 'div', dm.index);
      if (!block) continue;
      lastEnd = block.contentEnd;
      divRe.lastIndex = lastEnd;
      if (!/<h[1-3]\b/i.test(block.inner.slice(0, 500))) continue;
      const label = classifySectionBlock(block, false);
      if (label && !fallback.includes(label)) fallback.push(label);
    }
    if (footerM && !fallback.includes('Footer')) fallback.push('Footer');
    return fallback.length ? fallback : sections;
  }
  return sections;
}

async function analyzeStructure(html, url) {
  const inlineStyle = (html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) || []).join('\n');
  const externalCss = await fetchSameOriginCss(html, url);
  const cssRules = extractCssRules(inlineStyle + '\n' + externalCss);

  const navRegion = findTopNavRegion(html);
  const navBlockAbs = navRegion ? { contentEnd: navRegion.contentEnd } : null;

  return {
    typography: analyzeTypography(html, cssRules),
    navigation: analyzeNavigation(html, cssRules),
    hero: analyzeHero(html, cssRules, navBlockAbs),
    sections: analyzeSections(html),
  };
}

function analyzeWebsite(html, url) {
  const title = stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = meta(html, 'description') || meta(html, 'og:description');
  const ogImage = meta(html, 'og:image');
  const ogSite = meta(html, 'og:site_name');
  const h1s = [];
  html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => {
    const t = stripTags(inner);
    if (t && h1s.length < 6) h1s.push(t);
    return _;
  });
  const services = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) && services.length < 24) {
    const t = stripTags(m[1]);
    if (t && t.length > 2 && t.length < 80 && /service|detail|clean|wash|package|tier|coat|cut|repair|install/i.test(t + ' ' + (title || ''))) {
      if (!services.includes(t)) services.push(t);
    }
  }
  // Also pull package-like headings
  html.replace(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi, (_, inner) => {
    const t = stripTags(inner);
    if (t && t.length < 60 && /package|service|detail|clean|wash|tier|plan/i.test(t) && services.length < 24) {
      if (!services.includes(t)) services.push(t);
    }
    return _;
  });
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const reviewHints = (html.match(/review|testimonial|★|stars?/gi) || []).length;
  const phone = (html.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/) || [])[0] || '';
  const email = (html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || '';
  const colors = [];
  const styleBlocks = html.match(/#[0-9a-fA-F]{3,8}/g) || [];
  styleBlocks.slice(0, 40).forEach((c) => {
    if (!colors.includes(c.toLowerCase()) && colors.length < 6) colors.push(c.toLowerCase());
  });

  return {
    sourceUrl: url,
    businessName: ogSite || title.split(/[-|–—]/)[0].trim(),
    title,
    description,
    heroImage: ogImage,
    headlines: h1s,
    services: services.slice(0, 12),
    serviceCount: services.length,
    imageCount: imgCount,
    reviewSignals: reviewHints,
    phone,
    email,
    brandColors: colors,
    fetchedAt: new Date().toISOString(),
  };
}

function analyzeSocial(type, url) {
  const u = String(url || '');
  let handle = '';
  if (type === 'instagram') {
    const m = u.match(/instagram\.com\/([^/?#]+)/i);
    handle = m ? m[1].replace(/^@/, '') : '';
  } else if (type === 'facebook') {
    const m = u.match(/(?:facebook|fb)\.com\/([^/?#]+)/i);
    handle = m ? m[1] : '';
  } else if (type === 'google_business') {
    handle = 'google_listing';
  }
  return {
    sourceUrl: url,
    handle,
    profileUrl: url,
    note:
      type === 'google_business'
        ? 'Google Business linked — listing enrichment continues in Builder'
        : 'Profile linked — media/import enrichment continues in Builder',
    queued: true,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const type = String(body?.type || 'website').trim();
  const url = String(body?.url || '').trim();
  // Opt-in only — the existing website.analyze capability call path never
  // sets this, so this pass adds zero cost/latency to anything already
  // running in production. Exists so Stage 1 extraction can be exercised
  // and verified on real fixtures without wiring it into that path yet.
  const includeStructure = body?.includeStructure === true;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: 'url_required' });
  }

  try {
    if (type === 'website') {
      const fetched = await fetchText(url);
      if (!fetched.body || fetched.status >= 400) {
        return res.status(200).json({
          ok: true,
          partial: true,
          analysis: {
            sourceUrl: url,
            error: 'fetch_failed',
            httpStatus: fetched.status,
            note: 'Site linked — Builder will retry deeper import',
          },
        });
      }
      const analysis = analyzeWebsite(fetched.body, url);
      const out = { ok: true, partial: false, analysis };
      if (includeStructure) out.structure = await analyzeStructure(fetched.body, url);
      return res.status(200).json(out);
    }

    if (['instagram', 'facebook', 'google_business'].includes(type)) {
      const analysis = analyzeSocial(type, url);
      return res.status(200).json({ ok: true, partial: true, analysis });
    }

    return res.status(400).json({ ok: false, error: 'unsupported_type' });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      partial: true,
      analysis: {
        sourceUrl: url,
        error: String(err && err.message || err),
        note: 'Queued for deeper import in Builder',
      },
    });
  }
};
