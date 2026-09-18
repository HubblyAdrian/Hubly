/**
 * /sitemap.xml — GENERATED FROM THE RECORD ON EVERY REQUEST.
 *
 * ══ WHY THIS EXISTS ══════════════════════════════════════════════════════════════════════════
 *
 * Adrian verified in Google Search Console on 2026-09-18 (a DOMAIN property for myhubly.app,
 * created that morning — which is why this was unmeasurable before) that
 * graefs-autocare.myhubly.app has NEVER been fetched by Google. Every crawl field reads N/A and
 * the URL is "unknown to Google". A Live Test on the same URL renders his real site and reports
 * "Page can be indexed".
 *
 * So: rendering works, Googlebot executes the client-side render, and the noindex fix is confirmed
 * live by Google's own tooling. What is missing is DISCOVERY — no sitemap, no referring pages,
 * nothing that tells Google these URLs exist at all.
 *
 * ══ AND /sitemap.xml WAS NOT MERELY ABSENT ═══════════════════════════════════════════════════
 *
 * Before this file, https://myhubly.app/sitemap.xml returned **HTTP 200 with 3,091,125 bytes of
 * text/html** — the catch-all serving hubly.html. Nothing 404'd. A crawler asking for a sitemap got
 * a 200 HTML document. That is the same silent-undefined route failure that public/robots.txt was
 * created to fix, and its own header comment describes it; it was still open one filename over.
 * Adding the route matters as much as generating the XML.
 *
 * ══ NEVER HAND-MAINTAINED ════════════════════════════════════════════════════════════════════
 *
 * The membership rule lives in ONE place, SQL-side: public.get_indexable_business_slugs(), which
 * asks get_public_business(slug) the same question hcNoIndex() asks of the same function's output —
 * a live page, and account_kind read off the READER'S OWN output rather than off the table. A list
 * in this file, or a build step writing a static sitemap.xml, would be a hand-maintained set whose
 * failure mode is a silently stale one: a business claimed today would simply never be submitted,
 * and nothing would say so.
 *
 * ══ AN EMPTY SITEMAP IS NEVER OUR FAILURE DRESSED AS HIS DATA ════════════════════════════════
 *
 * If the read FAILS this returns 503 and no XML. It must never answer a failed read with a valid
 * empty <urlset>, because that is a confident "there are no business pages" produced by our own
 * outage — the empty-reader defect, aimed at Google instead of at an owner. A read that SUCCEEDS
 * and returns zero rows is a different thing: that is the content answering, so it is served as an
 * empty urlset and logged loudly.
 */
const { SUPABASE_PUBLISHABLE_KEY: SUPA_ANON } = require('./_publishable-key');

const SUPA_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://rtwxxkxpkqdrhclkozma.supabase.co';

// The host the sitemap publishes. myhubly.app is what is verified in Search Console; hubly.app also
// routes but is not the canonical public address, and a sitemap listing both would be two URLs for
// one page.
const HOST_SUFFIX = 'myhubly.app';

const xmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end('Method Not Allowed\n');
  }
  if (!SUPA_ANON) {
    console.error('[sitemap] no publishable key — refusing to serve an empty sitemap');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('sitemap unavailable: no Supabase key\n');
  }

  let rows;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/get_indexable_business_slugs`, {
      method: 'POST',
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}`,
                 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    });
    if (!r.ok) throw new Error(`rpc ${r.status}`);
    rows = await r.json();
    if (!Array.isArray(rows)) throw new Error('rpc did not return a list');
  } catch (e) {
    // LOUD, AND NO XML. See the header: a failed read may not be answered with an empty sitemap.
    console.error('[sitemap] could not read the record:', e && e.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end('sitemap unavailable: could not read the business record\n');
  }

  if (!rows.length) {
    // The read SUCCEEDED and the answer is zero. That is the content, not a malfunction — but it is
    // worth saying out loud, because today it is 13 and zero would mean something changed.
    console.error('[sitemap] the record returned ZERO indexable businesses — serving an empty sitemap');
  }

  const urls = rows.map((row) => {
    const slug = row && row.slug;
    if (!slug) return '';
    const loc = `https://${slug}.${HOST_SUFFIX}/`;
    const lm = row.updated_at ? new Date(row.updated_at) : null;
    const lastmod = lm && !isNaN(lm.getTime()) ? `\n    <lastmod>${lm.toISOString().slice(0, 10)}</lastmod>` : '';
    return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmod}\n  </url>`;
  }).filter(Boolean);

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + (urls.length ? '\n' : '') +
    '</urlset>\n';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Fresh within the quarter hour, so a business claimed now is submittable now-ish without every
  // crawler hit becoming a database read.
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  res.setHeader('X-Hubly-Sitemap-Count', String(urls.length));
  return res.end(req.method === 'HEAD' ? undefined : xml);
};
