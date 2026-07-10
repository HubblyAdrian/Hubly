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

module.exports = async (req, res) => {
  try {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath.startsWith('/themes/')) {
      const filePath = path.join(__dirname, '../public', urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
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

    const content = fs.readFileSync(path.join(__dirname, '../public/hubly.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(content);
  } catch (e) {
    return res.status(500).send('Error loading app: ' + e.message);
  }
};
