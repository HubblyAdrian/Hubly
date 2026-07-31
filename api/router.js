const fs = require('fs');
const path = require('path');

// Always serve the main Hubly app. Public business profiles are resolved
// client-side from the subdomain slug (see initApp / loadPublicProfile in hubly.html).
// Share previews (iMessage/Slack) need OG tags injected server-side — crawlers
// do not run the SPA JS that would otherwise set document.title.

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
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
const SUPA_ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d3h4a3hwa3FkcmhjbGtvem1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjA4MjgsImV4cCI6MjA5Nzk5NjgyOH0.ky9ycGJ621E4ab078pCIR4-1X_XS6OUpfPmH3v8tzf8';

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
      `&select=name,tagline,about,banner_url,logo_url&limit=1`;
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
    const image = String(row.banner_url || row.logo_url || '').trim();
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
      urlPath === '/website-ast.js' ||
      urlPath === '/landing-intent.js' ||
      urlPath === '/hubly-session.js'
    ) {
      const filePath = path.join(__dirname, '../public', urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        // Blueprint/theme/layout JS+JSON change often; avoid sticky CDN caches breaking Runtime helpers.
        const noSticky = urlPath.endsWith('.js') || urlPath.endsWith('.json');
        res.setHeader(
          'Cache-Control',
          noSticky
            ? 'public, max-age=60, stale-while-revalidate=600'
            : 'public, max-age=3600, stale-while-revalidate=86400'
        );
        return res.status(200).send(fs.readFileSync(filePath));
      }
      return res.status(404).send('Not found');
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
