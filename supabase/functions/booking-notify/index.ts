import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { stripBookingMachineTags } from '../_shared/booking_notes.ts';

/** Same convention as the OAuth callbacks: appBaseUrl() + "/app". */
function appBaseUrl() {
  return (Deno.env.get('HUBLY_APP_URL') || '').trim().replace(/\/$/, '') || 'https://myhubly.app';
}

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Hubly <notifications@notifications.myhubly.app>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function icsEscape(str: string) {
  return String(str || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
}

// Converts a wall-clock date+time in a given IANA timezone to the correct UTC instant.
function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '09:00').split(':').map(Number);
  const utcGuess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(new Date(utcGuess)).reduce((a: Record<string,string>, p) => { a[p.type] = p.value; return a; }, {});
    const hourNum = parts.hour === '24' ? 0 : Number(parts.hour);
    const asUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hourNum, Number(parts.minute), Number(parts.second));
    const diff = asUTC - utcGuess;
    return new Date(utcGuess - diff);
  } catch {
    return new Date(utcGuess); // fallback: treat as UTC if timezone is invalid
  }
}

function fmtICSUtc(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildICS(opts: { uid: string; summary: string; location: string; description: string; dateStr: string; timeStr: string; timeZone: string; durationMin?: number }) {
  const start = zonedTimeToUtc(opts.dateStr, opts.timeStr, opts.timeZone);
  const end = new Date(start.getTime() + (opts.durationMin || 90) * 60000);
  const now = new Date();
  return {
    ics: [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hubly//Booking//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${opts.uid}@myhubly.app`,
      `DTSTAMP:${fmtICSUtc(now)}`,
      `DTSTART:${fmtICSUtc(start)}`,
      `DTEND:${fmtICSUtc(end)}`,
      `SUMMARY:${icsEscape(opts.summary)}`,
      `LOCATION:${icsEscape(opts.location)}`,
      `DESCRIPTION:${icsEscape(opts.description)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n'),
    start, end,
  };
}

function googleCalendarLink(opts: { summary: string; location: string; description: string; start: Date; end: Date }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.summary,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
    details: opts.description,
    location: opts.location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

async function sendEmail(to: string | null, subject: string, html: string, attachment?: { filename: string; content: string }) {
  if (!to) return;
  try {
    const body: Record<string, unknown> = { from: RESEND_FROM, to, subject, html };
    if (attachment) {
      body.attachments = [{ filename: attachment.filename, content: attachment.content }];
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('Resend error', await res.text());
  } catch (e) {
    console.error('Email send failed', e);
  }
}

function fmtDate(dateStr: string, timeStr: string, timeZone: string) {
  try {
    const utc = zonedTimeToUtc(dateStr, timeStr, timeZone);
    const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' }).format(utc);
    const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(utc);
    return { dateFmt, timeFmt, full: `${dateFmt} at ${timeFmt}` };
  } catch {
    return { dateFmt: dateStr, timeFmt: timeStr, full: `${dateStr} ${timeStr}` };
  }
}

function emailShell(opts: { accentColor: string; headline: string; subhead: string; bodyHtml: string; ctaText?: string; ctaHref?: string; secondaryCtaText?: string; secondaryCtaHref?: string }) {
  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <div style="background:${opts.accentColor};padding:28px 28px 24px;">
        <div style="font-size:22px;font-weight:700;color:#fff;line-height:1.3;">${opts.headline}</div>
        <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px;">${opts.subhead}</div>
      </div>
      <div style="padding:24px 28px 28px;">
        ${opts.bodyHtml}
        ${opts.ctaText && opts.ctaHref ? `<a href="${opts.ctaHref}" style="display:block;text-align:center;background:${opts.accentColor};color:#fff;font-weight:600;font-size:15px;padding:13px 20px;border-radius:10px;text-decoration:none;margin-top:20px;">${opts.ctaText}</a>` : ''}
        ${opts.secondaryCtaText && opts.secondaryCtaHref ? `<a href="${opts.secondaryCtaHref}" style="display:block;text-align:center;color:${opts.accentColor};font-weight:600;font-size:13px;padding:10px 20px;text-decoration:none;margin-top:10px;">${opts.secondaryCtaText}</a>` : ''}
      </div>
      <div style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
        Sent via Hubly • <a href="https://myhubly.app" style="color:#999;">myhubly.app</a>
      </div>
    </div>
  </div>`;
}

function detailRow(icon: string, label: string, value: string) {
  if (!value) return '';
  return `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f0f0f0;">
    <div style="font-size:16px;width:20px;flex-shrink:0;">${icon}</div>
    <div><div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.03em;">${label}</div><div style="font-size:14px;color:#222;font-weight:500;margin-top:1px;">${value}</div></div>
  </div>`;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const booking = payload.record;
    if (!booking) return new Response(JSON.stringify({ ok: true, skipped: 'no record' }));

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: business } = await supabase
      .from('businesses')
      .select('name, phone, email, slug, brand_color, timezone')
      .eq('id', booking.business_id)
      .single();

    if (!business) return new Response(JSON.stringify({ ok: true, skipped: 'no business' }));

    const timeZone = business.timezone || 'America/Denver';
    const when = fmtDate(booking.requested_date, booking.requested_time, timeZone);
    const accent = business.brand_color || '#1a3a6e';
    const vehicleBits = [booking.vehicle_year, booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ');
    const vehicleLine = vehicleBits
      ? `${vehicleBits}${booking.vehicle_color ? ' • ' + booking.vehicle_color : ''}`
      : (booking.vehicle_type || '');

    const eventSummary = `${booking.service_name} — ${business.name}`;
    // Notes are stripped BEFORE they reach the .ics. This description is copied
    // into whatever calendar imports the file, so a marker here does not just
    // look wrong in one email — it lands in the owner's calendar permanently.
    const cleanNotes = stripBookingMachineTags(booking.notes);
    const eventDescription = `${booking.service_name} with ${business.name}. Vehicle: ${vehicleLine}${cleanNotes ? '. Notes: ' + cleanNotes : ''}`;
    const { ics, start, end } = buildICS({
      uid: booking.id || crypto.randomUUID(),
      summary: eventSummary,
      location: booking.address || '',
      description: eventDescription,
      dateStr: booking.requested_date,
      timeStr: booking.requested_time,
      timeZone,
    });
    const icsBase64 = btoa(unescape(encodeURIComponent(ics)));
    const gcalLink = googleCalendarLink({ summary: eventSummary, location: booking.address || '', description: eventDescription, start, end });

    // ---- Notify the detailer ----
    const ownerBody = `
      <div style="font-size:15px;color:#333;margin-bottom:18px;">You've got a new booking request from <b>${booking.customer_name}</b>.</div>
      ${detailRow('\u{1F527}', 'Service', booking.service_name)}
      ${detailRow('\u{1F697}', 'Vehicle', vehicleLine)}
      ${detailRow('\u{1F4C5}', 'When', when.full)}
      ${detailRow('\u{1F4CD}', 'Address', booking.address || '')}
      ${detailRow('\u{1F4DE}', 'Contact', `${booking.customer_phone}${booking.customer_email ? ' \u2022 ' + booking.customer_email : ''}`)}
      ${detailRow('\u{1F4DD}', 'Notes', cleanNotes)}
    `;
    const ownerHtml = emailShell({
      accentColor: accent,
      headline: '\u{1F514} New booking request',
      subhead: `From ${booking.customer_name}`,
      bodyHtml: ownerBody,
      ctaText: 'Open Hubly Dashboard',
      // Was the marketing homepage: an owner tapping this from their phone
      // landed on the public site and had to navigate in. /app is the app shell,
      // which handles the auth redirect itself.
      ctaHref: appBaseUrl() + '/app',
    });

    // ---- Notify the customer ----
    const customerBody = `
      <div style="font-size:15px;color:#333;margin-bottom:18px;">Hi ${booking.customer_name}, your request has been sent to <b>${business.name}</b>. They'll confirm your appointment shortly.</div>
      ${detailRow('\u{1F527}', 'Service', booking.service_name)}
      ${detailRow('\u{1F697}', 'Vehicle', vehicleLine)}
      ${detailRow('\u{1F4C5}', 'When', when.full)}
      ${detailRow('\u{1F4CD}', 'Address', booking.address || '')}
      ${detailRow('\u{1F4DE}', 'Questions?', business.phone || '')}
      <div style="font-size:12px;color:#aaa;margin-top:16px;">\u{1F4CE} A calendar invite is attached \u2014 tap it to save this appointment, or use the button below.</div>
    `;
    const customerHtml = emailShell({
      accentColor: accent,
      headline: '\u{1F389} Booking request sent!',
      subhead: `${business.name} will confirm shortly`,
      bodyHtml: customerBody,
      ctaText: '\u{1F4C5} Add to Google Calendar',
      ctaHref: gcalLink,
    });

    await Promise.all([
      sendEmail(business.email, `New booking from ${booking.customer_name}`, ownerHtml),
      sendEmail(booking.customer_email, `Booking request sent to ${business.name}`, customerHtml, { filename: 'appointment.ics', content: icsBase64 }),
    ]);

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
