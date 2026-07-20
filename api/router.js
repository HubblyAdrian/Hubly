const fs = require('fs');
const path = require('path');

// Always serve the main Hubly app. Public business profiles are resolved
// client-side from the subdomain slug (see initApp / loadPublicProfile in hubly.html).
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

function serveHublyHtml(res) {
  const content = fs.readFileSync(path.join(__dirname, '../public/hubly.html'), 'utf8');
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
      urlPath === '/website-ast.js'
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

      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=precipitation_probability_max,weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`;
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
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json({
        cityRequested: rawCity,
        cityResolved: loc?.name || rawCity,
        byDate,
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

    // Phase 6.5 — Platform Entry Experience (apex / www only).
    // Business subdomains ({slug}.myhubly.app) must get hubly.html so copied
    // booking links open the owner's site — not the Hubly landing page.
    if (!businessSite) {
      if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/home') {
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

    return serveHublyHtml(res);
  } catch (e) {
    return res.status(500).send('Error loading app: ' + e.message);
  }
};

// Exported for regression tests
module.exports.isBusinessSubdomain = isBusinessSubdomain;
