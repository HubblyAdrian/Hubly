const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.PLATFORM_OWNER_EMAIL;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  if(!RESEND_KEY || !OWNER_EMAIL) {
    // Fails quiet on the client side (fire-and-forget from
    // finishOnboardingLaunch()) -- a missing/unset env var must never
    // block a real business from launching.
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  let body = req.body;
  if(typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  const { business } = body || {};
  if(!business || !business.name) return res.status(400).json({error:'Missing business data'});

  const rows = (label, value) => value
    ? '<tr><td style="padding:7px 0;color:#888;font-size:13px;width:130px;">'+label+'</td><td style="font-weight:500;">'+value+'</td></tr>'
    : '';

  const html = '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">'
    +'<div style="background:#1a3a6e;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">'
    +'<div style="font-size:22px;font-weight:800;">New Hubly signup!</div>'
    +'<div style="opacity:.7;margin-top:4px;">A new business just launched</div></div>'
    +'<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">'
    +'<table style="width:100%;border-collapse:collapse;">'
    +rows('Business', business.name)
    +rows('City', business.city)
    +rows('Owner email', business.email)
    +rows('Style', business.layout)
    +rows('Services', business.serviceCount)
    +rows('URL', business.url)
    +'</table>'
    +(business.url ? '<div style="margin-top:20px;"><a href="https://'+business.url+'" style="background:#1a3a6e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View their site</a></div>' : '')
    +'</div><div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Sent by Hubly</div></div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer '+RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Hubly Signups <signups@myhubly.app>',
        to: OWNER_EMAIL,
        subject: 'New signup: '+business.name,
        html,
      }),
    });
    return res.status(200).json({ ok: r.ok });
  } catch(e) {
    return res.status(200).json({ ok: false, reason: e.message });
  }
};
