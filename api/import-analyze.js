/**
 * Hubly Session import analyzer (Rule #24)
 * Starts real analysis when a visitor pastes website / social URLs.
 * Website: server-side HTML fetch + structure extract.
 * Social: structured partial analysis (handle / listing signals) — deeper vendor import continues in Builder.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const MAX_BYTES = 900000;
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
      return res.status(200).json({ ok: true, partial: false, analysis });
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
