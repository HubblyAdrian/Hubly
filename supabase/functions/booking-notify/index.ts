import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { stripBookingMachineTags } from '../_shared/booking_notes.ts';
// Key resolution goes through supabase_admin.ts: it THROWS on a missing key
// rather than continuing with "", and never sends a non-JWT sb_secret_ key as a
// Bearer token (PostgREST rejects those as "Invalid JWT").
import { createAdminClient, requireSecretKey } from '../_shared/supabase_admin.ts';

/** Same convention as the OAuth callbacks: appBaseUrl() + "/app". */
function appBaseUrl() {
  return (Deno.env.get('HUBLY_APP_URL') || '').trim().replace(/\/$/, '') || 'https://myhubly.app';
}

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Hubly <notifications@notifications.myhubly.app>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

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

/**
 * Send, and RECORD THE OUTCOME.
 *
 * This used to swallow a provider rejection into a console.error and let the
 * caller report ok:true regardless — so a booking whose owner email bounced was
 * indistinguishable from one that arrived. Every path out of this function now
 * writes a notification_deliveries row: sent (with the provider's receipt),
 * failed (with the reason), or skipped (no address to send to).
 *
 * The recording must never break the send, and a failed RECORD must never be
 * reported as a failed SEND, so the ledger write has its own try/catch and its
 * own loud log.
 */
async function sendEmail(
  supabase: ReturnType<typeof createAdminClient>,
  ledger: { businessId: string | null; subjectType: string; subjectId: string | null; role: string },
  to: string | null,
  subject: string,
  html: string,
  attachment?: { filename: string; content: string },
) {
  const record = async (status: 'sent' | 'failed' | 'skipped', extra: { providerMessageId?: string | null; error?: string | null }) => {
    try {
      const { error } = await supabase.from('notification_deliveries').insert({
        business_id: ledger.businessId,
        subject_type: ledger.subjectType,
        subject_id: ledger.subjectId,
        recipient_role: ledger.role,
        recipient: to,
        channel: 'email',
        provider: 'resend',
        provider_message_id: extra.providerMessageId ?? null,
        status,
        error: extra.error ? String(extra.error).slice(0, 500) : null,
      });
      if (error) console.error('notification_deliveries insert failed:', error.message);
    } catch (e) {
      console.error('notification_deliveries insert threw:', e);
    }
  };

  if (!to) {
    // Not a failure and not a success. A business with no email on file cannot
    // be notified, and that is worth being able to count.
    await record('skipped', { error: 'no recipient address' });
    return;
  }
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
    const text = await res.text();
    if (!res.ok) {
      console.error('Resend error', text);
      await record('failed', { error: `resend ${res.status}: ${text}` });
      return;
    }
    let id: string | null = null;
    try { id = (JSON.parse(text) as { id?: string }).id ?? null; } catch { /* keep null */ }
    await record('sent', { providerMessageId: id });
  } catch (e) {
    console.error('Email send failed', e);
    await record('failed', { error: String(e) });
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
    // CREDENTIAL CHECK IN THE FUNCTION, because the gateway can no longer do it.
    //
    // This function's only caller is _shared/booking_notify_call.ts, server to
    // server, presenting our own secret key. A new-era sb_secret_ key is NOT a
    // JWT, so it cannot be sent as `Authorization: Bearer` -- adminHeaders()
    // sends it on `apikey` alone, and a gateway with verify_jwt enabled answers
    // "Missing authorization header" before this handler ever runs. That is
    // exactly how hubly-document-build silently stopped building pages on
    // 2026-08-19, and booking-notify was the only other function with the same
    // shape: an enforcing gateway plus a server-to-server caller.
    //
    // So verify_jwt is off for this function (see config.toml) and the check
    // lives here instead. This is not a weakening: the gateway only ever asked
    // "is this a well-formed JWT", while this asks "is this OUR key", on either
    // header. An unauthenticated caller could previously reach this endpoint and
    // trigger an email to a business owner; now it cannot.
    let expected: string;
    try {
      expected = requireSecretKey().key;
    } catch (e) {
      console.error('booking-notify: no service key configured', e);
      return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const apikey = (req.headers.get('apikey') || '').trim();
    // A SECOND SERVER-ONLY CREDENTIAL, NOT A LOOSENING.
    //
    // The pay-in-person path has no Edge Function on it at all -- the booking is
    // completed by a Postgres RPC -- so the only server-side caller that can
    // exist is Postgres itself, via a trigger (see
    // 20260821010000_notify_owner_on_booking_completion.sql). Postgres cannot
    // hold the service key without copying our most privileged credential into
    // the database, so it presents the cron secret from Vault, exactly as
    // hubly-recurring-maintain is already called.
    //
    // The property this check exists to protect is unchanged: an
    // UNAUTHENTICATED caller, or one holding only the publishable key that ships
    // to every browser, still cannot make this function email a business owner.
    const cronSecret = (Deno.env.get('HUBLY_CRON_SECRET') || '').trim();
    const givenCron = (req.headers.get('x-hubly-cron-secret') || '').trim();
    const cronOk = !!cronSecret && givenCron === cronSecret;
    if (!cronOk && bearer !== expected && apikey !== expected) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const booking = payload.record;
    if (!booking) return new Response(JSON.stringify({ ok: true, skipped: 'no record' }));

    // A row with status 'abandoned' is a LEAD, not a booking. It is written the
    // moment the customer reaches step 3, so notifying on it told owners "New
    // booking request" for everyone who merely started the form — and, because
    // the trigger fired AFTER INSERT, it arrived minutes BEFORE any payment.
    // Callers now invoke this once the booking is real; this guard makes that
    // property hold even if something calls it early.
    if (String(booking.status || '') === 'abandoned') {
      return new Response(JSON.stringify({ ok: true, skipped: 'abandoned lead, not a booking' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createAdminClient();
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, phone, email, slug, brand_color, timezone')
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
    // Payment state, stated from the columns rather than inferred. payment_status
    // defaults to 'none' at the column level, so 'none' is treated as "not known
    // to be paid" and never rendered as a claim that nothing was owed.
    const money = (c: number) => `$${(Math.max(0, Math.round(Number(c) || 0)) / 100).toFixed(2)}`;
    const paidCents = Number(booking.amount_paid_cents) || 0;
    const requiredCents = booking.amount_required_cents == null
      ? null
      : Number(booking.amount_required_cents);
    const isPaid = String(booking.payment_status || '') === 'paid' && paidCents > 0;
    const paymentLine = isPaid
      ? `${money(paidCents)} paid`
      : (requiredCents !== null && requiredCents > 0
        ? `${money(requiredCents)} due \u2014 not yet paid`
        : (String(booking.payment_rule || '') === 'pay_after_service'
          ? 'Pay after service'
          : ''));

    const ownerBody = `
      <div style="font-size:15px;color:#333;margin-bottom:18px;">You've got a new booking request from <b>${booking.customer_name}</b>.</div>
      ${detailRow('\u{1F527}', 'Service', booking.service_name)}
      ${detailRow('\u{1F697}', 'Vehicle', vehicleLine)}
      ${detailRow('\u{1F4C5}', 'When', when.full)}
      ${detailRow('\u{1F4CD}', 'Address', booking.address || '')}
      ${detailRow('\u{1F4DE}', 'Contact', `${booking.customer_phone}${booking.customer_email ? ' \u2022 ' + booking.customer_email : ''}`)}
      ${detailRow('\u{1F4B3}', 'Payment', paymentLine)}
      ${detailRow('\u{1F4DD}', 'Notes', cleanNotes)}
    `;
    const ownerHtml = emailShell({
      accentColor: accent,
      // A paid booking is committed work, not a request awaiting a decision, and
      // the email should not ask the owner to weigh something the customer has
      // already paid for.
      headline: isPaid ? '\u{2705} New booking \u2014 paid' : '\u{1F514} New booking request',
      subhead: isPaid
        ? `${booking.customer_name} \u2022 ${money(paidCents)} paid`
        : `From ${booking.customer_name}`,
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

    const ledgerBase = { businessId: business.id ?? null, subjectType: 'booking_request', subjectId: booking.id ?? null };
    await Promise.all([
      sendEmail(supabase, { ...ledgerBase, role: 'owner' }, business.email, `New booking from ${booking.customer_name}`, ownerHtml),
      sendEmail(supabase, { ...ledgerBase, role: 'customer' }, booking.customer_email, `Booking request sent to ${business.name}`, customerHtml, { filename: 'appointment.ics', content: icsBase64 }),
    ]);

    // The response still says ok — the notify PATH ran — but it no longer has to
    // carry the weight of "and it was delivered". That question is now answered
    // by notification_deliveries, per recipient, whether or not anyone asks.
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
