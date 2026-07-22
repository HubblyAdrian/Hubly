const RESEND_KEY = process.env.RESEND_API_KEY;

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
    } catch (e) {}
  }
  const { booking, business, status } = body || {};
  if (!booking || !business) return res.status(400).json({ error: 'Missing data' });

  const kind = status === 'confirmed' ? 'confirmed' : 'requested';
  const sent = { owner: false, client: false, detailer: false };
  const phone = booking.phone || booking.customer_phone || '';
  const email = booking.email || booking.customer_email || '';
  const dateRaw = booking.scheduled_date || booking.requested_date || '';
  const timeRaw = booking.scheduled_time || booking.requested_time || '';
  const dateStr = dateRaw
    ? new Date(dateRaw + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'TBD';

  async function sendEmail(to, from, subject, html) {
    if (!RESEND_KEY || !to) return false;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return r.ok;
  }

  const rows = (label, value) =>
    value
      ? '<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">' +
        label +
        '</td><td style="font-weight:500;">' +
        value +
        '</td></tr>'
      : '';

  const ownerSubject =
    kind === 'confirmed'
      ? 'Booking confirmed — ' + (booking.customer_name || 'customer')
      : 'New booking request — ' + (booking.customer_name || 'customer');
  const ownerHeadline = kind === 'confirmed' ? 'Booking confirmed' : 'New booking request';
  const ownerSub =
    kind === 'confirmed'
      ? 'Accepted on Hubly'
      : 'A customer hired you from your Hubly site — open Hubly to confirm';

  if (business.email) {
    const html =
      '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">' +
      '<div style="background:#1a3a6e;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">' +
      '<div style="font-size:22px;font-weight:800;">' +
      ownerHeadline +
      '</div>' +
      '<div style="opacity:.7;margin-top:4px;">' +
      ownerSub +
      '</div></div>' +
      '<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
      rows('Client', booking.customer_name) +
      rows('Phone', phone) +
      rows('Email', email) +
      rows('Service', booking.service_name) +
      rows('Vehicle', booking.vehicle) +
      rows('Date', dateStr) +
      rows('Time', timeRaw) +
      rows('Address', booking.address) +
      rows('Total', booking.amount ? '$' + parseFloat(booking.amount).toFixed(2) : null) +
      rows('Notes', booking.notes) +
      '</table>' +
      '<div style="margin-top:20px;"><a href="https://myhubly.app/app" style="background:#1a3a6e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Open Hubly</a></div>' +
      '</div><div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Sent by Hubly</div></div>';
    sent.owner = await sendEmail(
      business.email,
      'Hubly Bookings <bookings@myhubly.app>',
      ownerSubject,
      html,
    );
    sent.detailer = sent.owner;
  }

  if (email) {
    const clientHeadline =
      kind === 'confirmed' ? "You're booked!" : 'Request received';
    const clientSub =
      kind === 'confirmed'
        ? (business.name || 'Your pro') + ' will take care of you'
        : (business.name || 'The business') + ' got your request and will confirm soon';
    const clientIntro =
      kind === 'confirmed'
        ? 'Hi ' +
          booking.customer_name +
          ', your appointment is confirmed.'
        : 'Hi ' +
          booking.customer_name +
          ', we received your booking request. ' +
          (business.name || 'The business') +
          ' will confirm shortly.';
    const html =
      '<div style="font-family:system-ui;max-width:560px;margin:0 auto;">' +
      '<div style="background:#111;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">' +
      '<div style="font-size:22px;font-weight:800;">' +
      clientHeadline +
      '</div>' +
      '<div style="opacity:.7;margin-top:4px;">' +
      clientSub +
      '</div></div>' +
      '<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">' +
      '<p style="color:#555;margin-bottom:16px;">' +
      clientIntro +
      '</p>' +
      '<table style="width:100%;border-collapse:collapse;">' +
      rows('Service', booking.service_name) +
      rows('Date', dateStr) +
      rows('Time', timeRaw) +
      rows('Address', booking.address) +
      rows('Vehicle', booking.vehicle) +
      rows('Total', booking.amount ? '$' + parseFloat(booking.amount).toFixed(2) : null) +
      '</table>' +
      '<div style="margin-top:16px;padding:14px;background:#f5f5f3;border-radius:8px;">' +
      '<div style="font-weight:700;">' +
      (business.name || 'Business') +
      '</div>' +
      (business.phone
        ? '<div style="color:#555;font-size:13px;">' + business.phone + '</div>'
        : '') +
      (business.email
        ? '<div style="color:#555;font-size:13px;">' + business.email + '</div>'
        : '') +
      '</div></div>' +
      '<div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Powered by Hubly</div></div>';
    sent.client = await sendEmail(
      email,
      (business.name || 'Hubly') + ' via Hubly <bookings@myhubly.app>',
      kind === 'confirmed'
        ? 'Booking confirmed – ' +
          (booking.service_name || 'service') +
          ' with ' +
          (business.name || 'your pro')
        : 'We got your request – ' + (booking.service_name || 'service'),
      html,
    );
  }

  return res.status(200).json({
    ok: true,
    sent,
    emailConnectionRequired: !RESEND_KEY,
  });
};
