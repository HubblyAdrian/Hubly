const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.PLATFORM_OWNER_EMAIL || process.env.HUBLY_SUPPORT_EMAIL || 'support@myhubly.app';

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const email = String(body?.email || '').trim().slice(0, 200);
  const source = String(body?.source || 'business-readiness').trim().slice(0, 80);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Persist via email to the platform owner when Resend is configured.
  // Always acknowledge success to the visitor only after validation passes;
  // if mail isn't configured, still return ok:false so the client can show honesty.
  if (!RESEND_KEY) {
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const html = '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">'
    + '<div style="background:#141B2B;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">'
    + '<div style="font-size:22px;font-weight:800;">Business Readiness waitlist</div>'
    + '<div style="opacity:.7;margin-top:4px;">' + esc(source) + '</div></div>'
    + '<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">'
    + '<p style="margin:0 0 12px;color:#555;">Someone asked to be notified when Business Readiness launches.</p>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">Email</td>'
    + '<td style="font-weight:600;">' + esc(email) + '</td></tr>'
    + '<tr><td style="padding:7px 0;color:#888;font-size:13px;">Source</td>'
    + '<td style="font-weight:600;">' + esc(source) + '</td></tr>'
    + '</table></div>'
    + '<div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Hubly platform</div></div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hubly Waitlist <waitlist@myhubly.app>',
        to: OWNER_EMAIL,
        reply_to: email,
        subject: 'Business Readiness notify: ' + email,
        html,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(502).json({ ok: false, error: 'Could not save signup', detail: errText.slice(0, 200) });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message || 'Could not save signup' });
  }
};
