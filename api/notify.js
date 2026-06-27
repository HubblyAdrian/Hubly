const RESEND_KEY = process.env.RESEND_API_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  let body = req.body;
  if(typeof body === 'string') { try { body = JSON.parse(body); } catch(e) {} }
  const { booking, business } = body || {};
  if(!booking || !business) return res.status(400).json({error:'Missing data'});

  const sent = { detailer: false, client: false };
  const dateStr = booking.scheduled_date
    ? new Date(booking.scheduled_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})
    : 'TBD';

  async function sendEmail(to, from, subject, html) {
    if(!RESEND_KEY || !to) return false;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer '+RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html })
    });
    return r.ok;
  }

  const rows = (label, value) => value
    ? '<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">'+label+'</td><td style="font-weight:500;">'+value+'</td></tr>'
    : '';

  // Email to detailer
  if(business.email) {
    const html = '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">'
      +'<div style="background:#1a3a6e;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">'
      +'<div style="font-size:22px;font-weight:800;">New booking!</div>'
      +'<div style="opacity:.7;margin-top:4px;">From your Hubly profile</div></div>'
      +'<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">'
      +'<table style="width:100%;border-collapse:collapse;">'
      +rows('Client', booking.customer_name)
      +rows('Phone', booking.phone)
      +rows('Email', booking.email)
      +rows('Service', booking.service_name)
      +rows('Vehicle', booking.vehicle)
      +rows('Date', dateStr)
      +rows('Time', booking.scheduled_time)
      +rows('Address', booking.address)
      +rows('Total', booking.amount ? '$'+parseFloat(booking.amount).toFixed(2) : null)
      +rows('Notes', booking.notes)
      +'</table>'
      +'<div style="margin-top:20px;"><a href="https://myhubly.app" style="background:#1a3a6e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">View in dashboard</a></div>'
      +'</div><div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Sent by Hubly</div></div>';
    sent.detailer = await sendEmail(business.email, 'Hubly Bookings <bookings@myhubly.app>', 'New booking from '+booking.customer_name, html);
  }

  // Email to client
  if(booking.email) {
    const html = '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">'
      +'<div style="background:#111;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">'
      +'<div style="font-size:22px;font-weight:800;">You're booked!</div>'
      +'<div style="opacity:.7;margin-top:4px;">'+business.name+' will take care of you</div></div>'
      +'<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">'
      +'<p style="color:#555;margin-bottom:16px;">Hi '+booking.customer_name+', your appointment is confirmed.</p>'
      +'<table style="width:100%;border-collapse:collapse;">'
      +rows('Service', booking.service_name)
      +rows('Date', dateStr)
      +rows('Time', booking.scheduled_time)
      +rows('Address', booking.address)
      +rows('Vehicle', booking.vehicle)
      +rows('Total', booking.amount ? '$'+parseFloat(booking.amount).toFixed(2) : null)
      +'</table>'
      +'<div style="margin-top:16px;padding:14px;background:#f5f5f3;border-radius:8px;">'
      +'<div style="font-weight:700;">'+business.name+'</div>'
      +(business.phone ? '<div style="color:#555;font-size:13px;">'+business.phone+'</div>' : '')
      +(business.email ? '<div style="color:#555;font-size:13px;">'+business.email+'</div>' : '')
      +'</div></div>'
      +'<div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Powered by Hubly</div></div>';
    sent.client = await sendEmail(booking.email, business.name+' via Hubly <bookings@myhubly.app>', 'Booking confirmed – '+booking.service_name+' with '+business.name, html);
  }

  return res.status(200).json({ ok: true, sent });
};
