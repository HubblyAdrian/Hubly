const fs = require('fs');
const path = require('path');

// Always serve the main Hubly app. Public business profiles are resolved
// client-side from the subdomain slug (see initApp / loadPublicProfile in hubly.html).
// Share previews (iMessage/Slack) need OG tags injected server-side — crawlers
// do not run the SPA JS that would otherwise set document.title.

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const SUPA_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://rtwxxkxpkqdrhclkozma.supabase.co';
// ONE source of truth, shared with the browser pages -- see
// public/journey-os/hubly-public-key.js. There were seven inline copies of
// the old anon JWT; seven copies is how a key nobody owns goes stale.
const { SUPABASE_PUBLISHABLE_KEY: SUPA_ANON } = require('./_publishable-key');

/** {slug}.myhubly.app / {slug}.hubly.app — owner booking sites, not platform marketing. */
function isBusinessSubdomain(req) {
  const raw =
    (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  const host = String(raw).toLowerCase().split(',')[0].trim().split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return false;
  const parts = host.split('.');
  if (parts.length < 3) return false;
  const root = parts.slice(-2).join('.');
  if (root !== 'myhubly.app' && root !== 'hubly.app') return false;
  const sub = parts[0];
  if (!sub || ['www', 'myhubly', 'hubly'].includes(sub)) return false;
  return true;
}

function businessSlugFromReq(req) {
  if (!isBusinessSubdomain(req)) return null;
  const raw =
    (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  const host = String(raw).toLowerCase().split(',')[0].trim().split(':')[0];
  return host.split('.')[0] || null;
}

function slugToDisplayName(slug) {
  return String(slug || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function escAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function upsertMeta(html, attr, key, content) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escAttr(content)}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function applyBusinessShareMeta(html, meta) {
  if (!meta || !meta.title) return html;
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escAttr(meta.title)}</title>`);
  out = upsertMeta(out, 'property', 'og:title', meta.title);
  out = upsertMeta(out, 'property', 'og:description', meta.description || '');
  out = upsertMeta(out, 'property', 'og:type', 'website');
  out = upsertMeta(out, 'property', 'og:site_name', meta.siteName || meta.title);
  if (meta.updatedTime) {
    out = upsertMeta(out, 'property', 'og:updated_time', meta.updatedTime);
  }
  if (meta.url) out = upsertMeta(out, 'property', 'og:url', meta.url);
  if (meta.image) out = upsertMeta(out, 'property', 'og:image', meta.image);
  out = upsertMeta(out, 'name', 'description', meta.description || '');
  out = upsertMeta(out, 'name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary');
  out = upsertMeta(out, 'name', 'twitter:title', meta.title);
  out = upsertMeta(out, 'name', 'twitter:description', meta.description || '');
  if (meta.image) out = upsertMeta(out, 'name', 'twitter:image', meta.image);
  return out;
}

async function fetchBusinessShareMeta(slug, req) {
  const fallbackName = slugToDisplayName(slug) || 'Book online';
  const raw =
    (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  const host = String(raw).toLowerCase().split(',')[0].trim().split(':')[0];
  const proto =
    (req.headers && (req.headers['x-forwarded-proto'] || '')).split(',')[0].trim() ||
    'https';
  const pageUrl = `${proto}://${host}/`;
  const base = {
    title: fallbackName,
    description: `Book with ${fallbackName}`,
    image: '',
    url: pageUrl,
    siteName: fallbackName,
    updatedTime: new Date().toISOString(),
  };
  if (!SUPA_URL || !SUPA_ANON || !slug) return base;
  try {
    const endpoint =
      `${SUPA_URL.replace(/\/$/, '')}/rest/v1/businesses` +
      `?slug=eq.${encodeURIComponent(slug)}` +
      `&select=name,tagline,about,banner_url,logo_url,meta&limit=1`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: SUPA_ANON,
        Authorization: `Bearer ${SUPA_ANON}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return base;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return base;
    const name = String(row.name || '').trim() || fallbackName;
    const desc =
      String(row.tagline || '').trim() ||
      String(row.about || '').trim().slice(0, 160) ||
      `Book with ${name}`;
    let meta = row.meta;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
    }
    const shareCustom = String(meta?.website?.shareImageUrl || meta?.shareImageUrl || '').trim();
    const image = String(
      (/^https?:\/\//i.test(shareCustom) ? shareCustom : '') ||
      row.banner_url ||
      row.logo_url ||
      ''
    ).trim();
    return {
      title: name,
      description: desc,
      image,
      url: pageUrl,
      siteName: name,
      updatedTime: new Date().toISOString(),
    };
  } catch (e) {
    return base;
  }
}

async function serveHublyHtml(res, req) {
  let content = fs.readFileSync(path.join(__dirname, '../public/hubly.html'), 'utf8');
  // Owner-only CEO walkthrough — never ship an open /demo to customers.
  // Set HUBLY_CEO_DEMO_KEY in the server env, then open /hubly-ceo?k=<key>
  const ceoKey = String(process.env.HUBLY_CEO_DEMO_KEY || '').trim();
  const inject =
    '<script>window.__HUBLY_CEO_DEMO__=' +
    JSON.stringify({
      enabled: !!ceoKey,
      key: ceoKey || null,
      path: '/hubly-ceo',
    }) +
    ';</script>';
  if (content.includes('</head>')) {
    content = content.replace('</head>', inject + '\n</head>');
  } else {
    content = inject + content;
  }

  const slug = businessSlugFromReq(req || {});
  if (slug) {
    try {
      const share = await fetchBusinessShareMeta(slug, req || {});
      content = applyBusinessShareMeta(content, share);
    } catch (e) {
      /* keep Hubly defaults if lookup fails */
    }
    // The static HTML ships with #p-landing pre-marked active — a deliberate
    // choice for the marketing host (see the "never sit on a boot logo
    // splash" comment in initApp) so its own visitors see content
    // immediately. But that's the Hubly platform marketing page, not a
    // business's site — on a business subdomain it was flashing before
    // loadPublicProfile() swapped in the real page a moment later. Business
    // subdomains never take the marketing-host code path in initApp at all,
    // so nothing else re-activates #p-landing; swapping which page starts
    // active is safe and sufficient. #p-boot is the neutral splash already
    // built for exactly this gap.
    content = content.replace(
      '<div id="p-landing" class="page active">',
      '<div id="p-landing" class="page">'
    );
    content = content.replace(
      '<div id="p-boot" class="page" style="background:var(--surface-2,#F7F7F5);">',
      '<div id="p-boot" class="page active" style="background:var(--surface-2,#F7F7F5);">'
    );
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  return res.status(200).send(content);
}

module.exports = async (req, res) => {
  try {
    const urlPath = (req.url || '').split('?')[0];
    const businessSite = isBusinessSubdomain(req);
    if (
      urlPath.startsWith('/themes/') ||
      urlPath.startsWith('/layouts/') ||
      urlPath.startsWith('/assets/') ||
      urlPath.startsWith('/business-blueprints/') ||
      urlPath.startsWith('/booking-frames/') ||
      urlPath.startsWith('/booking-wizard/') ||
      urlPath.startsWith('/smart-quote/') ||
      urlPath.startsWith('/journey-os/') ||
      // ══ ANY ROOT-LEVEL SCRIPT UNDER public/, DERIVED — NOT A LIST OF THREE. ══════════════════
      //
      // This was `urlPath === '/website-ast.js' || '/landing-intent.js' || '/hubly-session.js'`, and
      // that is a hand-maintained set with a silent failure: a NEW root-level script is not served,
      // the catch-all below answers with **hubly.html**, and the browser receives 3 MB of HTML with a
      // `application/javascript` expectation. It does not 404 — it loads a document as a script, the
      // parse fails, and whatever the script defined is simply undefined.
      //
      // FOUND THE HARD WAY, 2026-09-16: `/contact-pick.js` shipped, served hubly.html, and
      // `HublyContactPick` was undefined in BOTH shells — including hubly.html's own
      // `pickContactInto`, which had just been changed to delegate to it. A working feature broken by
      // a file that deployed and did not serve.
      //
      // `fs.existsSync` + `isFile()` already decide whether a path is real, so the allowlist was
      // adding nothing but the chance to forget.
      //
      // WIDENED 2026-09-18 FROM `.js` TO EVERY EXTENSION. Scoping it to .js was the same mistake one
      // size smaller: .js was simply what had bitten us. Measured on the live site that day,
      // `/marketplace-landing.html` and `/pro-landing.html` — both real files — were answered with
      // 3,092,140 bytes of hubly.html, and `/manifest.webmanifest` and `/.env` fell through because
      // an 8-character extension bound and a non-empty basename were hand-tuned shapes of the same
      // kind. So the test is now structural: the LAST SEGMENT CONTAINS A DOT, with no bound on
      // either side of it. Still root-level only (no slash after the first), so this does not become
      // a general file server for public/.
      // NO PERCENT-ENCODING IN THE BASENAME. `/..%2Fx.js` satisfies "one segment with a dot"
      // because %2F is not a literal slash — caught by check-root-scripts-are-served leg 3 the
      // moment this pattern was widened. The resolved-path prefix guard below already stops the
      // traversal, so this is defence in depth rather than the only defence; the old `.js`-only
      // pattern happened to exclude `%` and widening it silently gave that up. Excluding `%`
      // covers every encoding of a separator rather than the two I would have thought to list.
      /^\/[^/%]*\.[^/.%]+$/.test(urlPath)
    ) {
      const publicRoot = path.resolve(__dirname, '../public');
      const filePath = path.resolve(publicRoot, '.' + urlPath);
      // AND THE PATH IS VERIFIED TO BE INSIDE public/. The prefixed branches above never checked, so
      // `/themes/../../something` was resolved and read. The pattern above already forbids a slash,
      // but the guard covers every branch in this condition rather than trusting one regex.
      if (filePath.startsWith(publicRoot + path.sep) &&
          fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        // Blueprint/theme/layout JS+JSON change often; avoid sticky CDN caches breaking Runtime helpers.
        const noSticky = urlPath.endsWith('.js') || urlPath.endsWith('.json');
        // A page is revalidated every time, matching the explicit page branches further down; an
        // asset is cached. A stale HTML document is a different kind of wrong from a stale icon.
        res.setHeader(
          'Cache-Control',
          urlPath.endsWith('.html')
            ? 'public, max-age=0, must-revalidate'
            : noSticky
              ? 'public, max-age=60, stale-while-revalidate=600'
              : 'public, max-age=3600, stale-while-revalidate=86400'
        );
        return res.status(200).send(fs.readFileSync(filePath));
      }
      return res.status(404).send('Not found');
    }

    // ══ A CATCH-ALL ROUTE CONVERTS EVERY MISSING FILE INTO A SUCCESSFUL WRONG ANSWER ═══════════
    //
    // MEASURED 2026-09-18, on the live site: 20 of 22 well-known paths returned **HTTP 200 with
    // 3,092,140 bytes of text/html**. /favicon.ico, /manifest.json, /ads.txt, /security.txt,
    // /.well-known/security.txt, /.well-known/assetlinks.json, /rss.xml, /browserconfig.xml, /.env
    // and a random nonce path all answered with hubly.html and a 200. Only /robots.txt and
    // /sitemap.xml were right, and only because vercel.json routes those two by name.
    //
    // THIS IS THE SAME DEFECT AS /sitemap.xml AND AS /contact-pick.js, one layer up. The block above
    // fixed it for root-level `.js` after a script that deployed-and-did-not-serve broke a working
    // feature in both shells. The reasoning there applies to EVERY extension, and it was scoped to
    // .js because .js was what had bitten us. A 404 tells the caller the truth. A catch-all tells it
    // the SPA is the file it asked for, with a 200, and every consumer that trusts status codes
    // believes it: a crawler indexes our marketing copy as the content of ads.txt, a browser parses
    // 3MB of HTML as an icon, a security scanner reads a 200 for /.env.
    //
    // DERIVED, NOT LISTED. There is no list of well-known paths here — such a list is exactly the
    // hand-maintained set this repo keeps paying for, and the standards bodies add to it without
    // telling us. The rule is structural instead:
    //
    //     a ROOT-LEVEL path that LOOKS LIKE A FILE, or anything under the reserved /.well-known/
    //     namespace, must correspond to a real file on disk or it is a 404.
    //
    // fs.existsSync already answers "is this real" (CLAUDE.md). Client-side routes are untouched
    // because they have no extension — /store, /app, /enter and every business page still fall
    // through to the SPA, which is what the catch-all is legitimately for.
    // The block above already answers every ROOT-LEVEL file-shaped path — serving the real file or
    // 404ing. What is left is the reserved /.well-known/ namespace, which is never a client route
    // and where we serve nothing today.
    const isWellKnown = urlPath.startsWith('/.well-known/');
    if (isWellKnown) {
      const publicRoot = path.resolve(__dirname, '../public');
      const filePath = path.resolve(publicRoot, '.' + urlPath);
      const real =
        filePath.startsWith(publicRoot + path.sep) &&
        fs.existsSync(filePath) &&
        fs.statSync(filePath).isFile();
      if (!real) {
        // text/plain, so nothing downstream can mistake the body for a document.
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(404).send('Not found\n');
      }
      // It IS real — fall through to the branches below, which already know how to serve it.
    }

    // Weather proxy endpoint so frontend forecast works even when
    // browser/network policies block direct third-party weather fetches.
    if ((req.url || '').startsWith('/api/weather')) {
      const urlObj = new URL(req.url, 'http://localhost');
      const rawCity = (urlObj.searchParams.get('city') || '').trim();
      if (!rawCity) {
        return res.status(400).json({ error: 'missing_city' });
      }

      const cityCandidates = [rawCity];
      const firstChunk = rawCity.split(',')[0]?.trim();
      if (firstChunk && firstChunk.toLowerCase() !== rawCity.toLowerCase()) {
        cityCandidates.push(firstChunk);
      }

      let loc = null;
      for (const city of cityCandidates) {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) continue;
        const geoData = await geoRes.json();
        loc = geoData?.results?.[0] || null;
        if (loc) break;
      }
      if (!loc) {
        return res.status(404).json({ error: 'city_not_found' });
      }

      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,precipitation&daily=precipitation_probability_max,weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`;
      const wRes = await fetch(forecastUrl);
      if (!wRes.ok) {
        return res.status(502).json({ error: 'forecast_fetch_failed' });
      }
      const wData = await wRes.json();
      const byDate = {};
      const times = wData?.daily?.time || [];
      for (let i = 0; i < times.length; i++) {
        byDate[times[i]] = {
          precipProb: wData?.daily?.precipitation_probability_max?.[i] ?? 0,
          code: wData?.daily?.weathercode?.[i] ?? 0,
          tempMax: wData?.daily?.temperature_2m_max?.[i],
          tempMin: wData?.daily?.temperature_2m_min?.[i],
        };
      }
      const cur = wData?.current || {};
      const todayKey = times[0];
      const todayDaily = todayKey ? byDate[todayKey] : null;
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({
        cityRequested: rawCity,
        cityResolved: loc?.name || rawCity,
        byDate,
        current: {
          tempC: cur.temperature_2m ?? todayDaily?.tempMax ?? null,
          code: cur.weather_code ?? todayDaily?.code ?? 0,
          precipProb: todayDaily?.precipProb ?? 0,
          precipMm: cur.precipitation ?? 0,
          at: cur.time || null,
        },
      });
    }

    // AI-first marketplace consumer entry (no search/directory UI)
    if (urlPath === '/get-done' || urlPath === '/get-done.html') {
      const getDone = path.join(__dirname, '../public/get-done.html');
      if (fs.existsSync(getDone)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return res.status(200).send(fs.readFileSync(getDone, 'utf8'));
      }
    }

    // #189 Customer Portal — read-only, magic-link-gated customer view
    if (urlPath === '/portal' || urlPath === '/portal.html') {
      const portal = path.join(__dirname, '../public/portal.html');
      if (fs.existsSync(portal)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return res.status(200).send(fs.readFileSync(portal, 'utf8'));
      }
    }

    // Hubly Marketplace provider app (public URLs — never expose "Lite")
    // Internal capability / eng packaging may still be marketplace_lite.
    if (
      urlPath === '/marketplace/join' ||
      urlPath === '/marketplace/login' ||
      urlPath === '/marketplace/home' ||
      urlPath === '/marketplace-lite' ||
      urlPath === '/marketplace-lite.html' ||
      urlPath === '/lite'
    ) {
      // Legacy /marketplace-lite and /lite → canonical public paths
      if (
        urlPath === '/marketplace-lite' ||
        urlPath === '/marketplace-lite.html' ||
        urlPath === '/lite'
      ) {
        res.statusCode = 302;
        res.setHeader('Location', '/marketplace/login');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return res.end();
      }
      const lite = path.join(__dirname, '../public/marketplace-lite.html');
      if (fs.existsSync(lite)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return res.status(200).send(fs.readFileSync(lite, 'utf8'));
      }
    }

    // Apex / www front door = classic platform marketing landing.
    // Create mode (Welcome conversation) starts at /signup, /welcome, etc.
    // Business subdomains ({slug}.myhubly.app) must get hubly.html so copied
    // booking links open the owner's site — not the Hubly landing page.
    if (!businessSite) {
      if (
        urlPath === '/' ||
        urlPath === '/index.html' ||
        urlPath === '/home' ||
        urlPath === '/platform' ||
        urlPath === '/platform-home'
      ) {
        const home = path.join(__dirname, '../public/platform-home.html');
        if (fs.existsSync(home)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          return res.status(200).send(fs.readFileSync(home, 'utf8'));
        }
      }
      if (
        urlPath === '/marketplace' ||
        urlPath === '/marketplace.html' ||
        urlPath === '/marketplace-landing'
      ) {
        const mkt = path.join(__dirname, '../public/marketplace-landing.html');
        if (fs.existsSync(mkt)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          return res.status(200).send(fs.readFileSync(mkt, 'utf8'));
        }
      }
      if (urlPath === '/pro' || urlPath === '/pro.html' || urlPath === '/hubly-pro') {
        const pro = path.join(__dirname, '../public/pro-landing.html');
        if (fs.existsSync(pro)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          return res.status(200).send(fs.readFileSync(pro, 'utf8'));
        }
      }
      if (urlPath === '/enter' || urlPath === '/enter.html' || urlPath === '/account') {
        const enter = path.join(__dirname, '../public/enter.html');
        if (fs.existsSync(enter)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          return res.status(200).send(fs.readFileSync(enter, 'utf8'));
        }
      }
    }

    // Hubly internal Marketplace Operations (employees only)
    if (
      urlPath === '/marketplace-ops' ||
      urlPath === '/marketplace-ops.html'
    ) {
      const ops = path.join(__dirname, '../public/marketplace-ops.html');
      if (fs.existsSync(ops)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).send(fs.readFileSync(ops, 'utf8'));
      }
    }

    // Hubly Brain Console — internal inspection only (never customer-facing)
    if (
      urlPath === '/brain-console' ||
      urlPath === '/brain-console.html' ||
      urlPath === '/hubly-brain-console'
    ) {
      const brain = path.join(__dirname, '../public/brain-console.html');
      if (fs.existsSync(brain)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).send(fs.readFileSync(brain, 'utf8'));
      }
    }

    return serveHublyHtml(res, req);
  } catch (e) {
    return res.status(500).send('Error loading app: ' + e.message);
  }
};

// Exported for regression tests
module.exports.isBusinessSubdomain = isBusinessSubdomain;
module.exports.businessSlugFromReq = businessSlugFromReq;
module.exports.applyBusinessShareMeta = applyBusinessShareMeta;
module.exports.slugToDisplayName = slugToDisplayName;
