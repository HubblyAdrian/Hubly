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
        // notifications.myhubly.app is the ONLY domain verified in Resend.
        // The bare myhubly.app is not registered there at all, which is why
        // every signup notification was rejected: this endpoint reached Resend
        // and Resend refused the sender.
        from: 'Hubly Signups <signups@notifications.myhubly.app>',
        to: OWNER_EMAIL,
        // Nothing receives mail at the from-address, so a reply to it bounces.
        // Platform notifications reply to the platform owner.
        reply_to: OWNER_EMAIL,
        subject: 'New signup: '+business.name,
        html,
      }),
    });
    // FORWARD WHAT RESEND ACTUALLY SAID.
    //
    // This used to return { ok: r.ok } and discard the body, so a rejected
    // send looked like {"ok":false} and nothing else -- diagnosing it required
    // reading the source to work out which of three branches produced a bare
    // false. Resend's own message names the cause.
    //
    // NOTE: ok:true means Resend ACCEPTED the message, not that it was
    // delivered. Same distinction the notification_deliveries schema makes.
    const text = await r.text().catch(() => '');
    if (!r.ok) {
      console.error('notify-signup: resend rejected', r.status, text);
      return res.status(200).json({ ok: false, status: r.status, error: text.slice(0, 500) });
    }
    let id = null;
    try { id = JSON.parse(text).id || null; } catch (e) {}
    return res.status(200).json({ ok: true, accepted: true, id });
  } catch(e) {
    return res.status(200).json({ ok: false, reason: e.message });
  }
};
