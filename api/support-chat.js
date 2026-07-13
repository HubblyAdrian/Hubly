const RESEND_KEY = process.env.RESEND_API_KEY;
const SUPPORT_TO = process.env.HUBLY_SUPPORT_EMAIL || 'support@myhubly.app';

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

  if (!RESEND_KEY) {
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const name = String(body?.name || '').trim().slice(0, 120);
  const email = String(body?.email || '').trim().slice(0, 200);
  const topic = String(body?.topic || 'Website chat').trim().slice(0, 80);
  const message = String(body?.message || '').trim().slice(0, 4000);
  const thread = Array.isArray(body?.thread) ? body.thread.slice(-20) : [];

  if (!message && !thread.length) {
    return res.status(400).json({ error: 'Missing message' });
  }

  const rows = (label, value) => value
    ? '<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">' + esc(label) + '</td><td style="font-weight:500;">' + esc(value) + '</td></tr>'
    : '';

  const threadHtml = thread.length
    ? '<div style="margin-top:18px;padding-top:14px;border-top:1px solid #eee;"><div style="font-weight:700;margin-bottom:8px;">Chat thread</div>'
      + thread.map(function (m) {
        const who = m.role === 'visitor' ? 'Visitor' : 'Hubly';
        return '<div style="margin-bottom:8px;font-size:13px;line-height:1.45;"><strong>' + esc(who) + ':</strong> ' + esc(m.content) + '</div>';
      }).join('')
      + '</div>'
    : '';

  const html = '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">'
    + '<div style="background:#141B2B;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">'
    + '<div style="font-size:22px;font-weight:800;">Marketing site chat</div>'
    + '<div style="opacity:.7;margin-top:4px;">' + esc(topic) + '</div></div>'
    + '<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">'
    + '<table style="width:100%;border-collapse:collapse;">'
    + rows('Name', name || '—')
    + rows('Email', email || '—')
    + rows('Topic', topic)
    + '</table>'
    + (message ? '<div style="margin-top:16px;padding:14px;background:#f7f7f5;border-radius:8px;line-height:1.5;">' + esc(message) + '</div>' : '')
    + threadHtml
    + '</div><div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Sent from myhubly.app chat</div></div>';

  try {
    const payload = {
      from: 'Hubly Chat <chat@myhubly.app>',
      to: SUPPORT_TO,
      subject: 'Hubly chat: ' + (topic || 'Website message') + (name ? ' — ' + name : ''),
      html,
    };
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      payload.reply_to = email;
    }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: e.message });
  }
};
