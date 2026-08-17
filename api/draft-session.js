// Exchange a short-lived draft grant for an httpOnly session cookie.
//
// WHY THIS LIVES ON VERCEL AND NOT IN AN EDGE FUNCTION
//
// The app is myhubly.app; Supabase Edge Functions are *.supabase.co. A cookie
// set by the Edge Function would be third-party to the app — SameSite=Lax would
// never send it, and Safari blocks it outright. Only a same-origin route can set
// a cookie the app will actually receive, so the exchange has to happen here.
//
// WHAT CROSSES THE BROWSER
//
// Not the draft_token. That is a permanent bearer credential for an unclaimed
// business and never leaves Supabase (see _shared/draft_grant.ts, and the rule
// at hubly-conversation:591). What crosses is a 10-minute, HMAC-signed,
// business-scoped grant, exchanged here for a 7-day httpOnly cookie and then
// discarded by the client.
//
// The cookie is signed with the same secret, so this endpoint is the only thing
// that can mint one and nothing in the browser can forge or read it.
//
// HUBLY_DRAFT_SECRET must match the value set on Supabase. Missing secret =>
// every request fails closed. Signup stops working loudly; it never degrades
// into accepting unsigned input.

const crypto = require('crypto');

const COOKIE_NAME = 'hubly_draft';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, matching the design

function b64urlDecode(s) {
  const pad = s.replace(/-/g, '+').replace(/\//g, '/');
  return Buffer.from(pad + '='.repeat((4 - (pad.length % 4)) % 4), 'base64');
}
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function hmacHex(secret, input) {
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}
/** Constant-time compare — never leak signature bytes through timing. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Verify a token minted by issueDraftGrant()/this endpoint. Identity comes
 *  ONLY from the verified payload, never from anything sent alongside it. */
function verifySigned(secret, token) {
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigHex] = parts;
  if (!safeEqual(hmacHex(secret, payloadB64), sigHex)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
    if (!payload || !payload.businessId || !Number.isFinite(payload.exp)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

function signSession(secret, businessId) {
  const payload = {
    businessId: String(businessId),
    exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${hmacHex(secret, payloadB64)}`;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

module.exports = async (req, res) => {
  // Same-origin only: this sets a cookie, so it must not be callable from
  // anywhere else. No Access-Control-Allow-Origin header is emitted at all,
  // which is what keeps a cross-site page from exchanging a stolen grant.
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.HUBLY_DRAFT_SECRET;
  if (!secret) {
    // Fail closed and say so. A missing secret must never mean "accept
    // anything" — signup breaking visibly is the correct outcome.
    return res.status(503).json({ error: 'draft_sessions_unconfigured' });
  }

  // Read the current draft session, so the app can tell whether an unclaimed
  // build is pending without ever seeing the cookie itself.
  if (req.method === 'GET') {
    const payload = verifySigned(secret, readCookie(req, COOKIE_NAME));
    return res.status(200).json(
      payload ? { ok: true, businessId: payload.businessId } : { ok: false },
    );
  }

  // Clear it — used after a successful claim, and on explicit abandon.
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return res.status(200).json({ ok: true, cleared: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const grant = String(body.grant || '').trim();
  if (!grant) return res.status(400).json({ error: 'grant required' });

  const payload = verifySigned(secret, grant);
  // Expired, tampered, unsigned or malformed all land here identically — the
  // caller learns nothing about which.
  if (!payload) return res.status(400).json({ error: 'invalid_or_expired_grant' });

  // HttpOnly   — JS cannot read it, so XSS cannot lift the session
  // Secure     — HTTPS only
  // SameSite=Lax — survives the magic-link click from an email client, which is
  //               a top-level GET navigation; Strict would drop it there and
  //               break the exact round trip this exists for
  // host-only  — no Domain attribute, so it is not sent to *.myhubly.app
  //              business subdomains that have no business receiving it
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${encodeURIComponent(signSession(secret, payload.businessId))}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join('; '));

  return res.status(200).json({ ok: true, businessId: payload.businessId });
};
