// Platform-owner signup notification. Fired by the claim trigger
// (20260822130000) the moment a business is claimed. Assembles its content
// server-side — the brief and edit count live in the DB — and emails the platform
// owner in plain text: the live URL first, then how to reach the person.
//
// Auth mirrors booking-notify: the caller presents the cron secret (Postgres, via
// Vault) OR our service key. verify_jwt is off for this function (config.toml).
//
// NEVER invents a field: an unreadable brief/device/edit-count says so; it does not
// guess and does not omit silently.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireSecretKey } from '../_shared/supabase_admin.ts';

const RESEND_KEY = (Deno.env.get('RESEND_API_KEY') || '').trim();
const RESEND_FROM = (Deno.env.get('RESEND_FROM_EMAIL') || 'Hubly <notifications@notifications.myhubly.app>').trim();
const OWNER_EMAIL = (Deno.env.get('PLATFORM_OWNER_EMAIL') || '').trim();
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').trim();
const PUBLIC_DOMAIN = (Deno.env.get('HUBLY_PUBLIC_DOMAIN') || 'myhubly.app').trim();

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  try {
    // ── credential check (gateway can't; verify_jwt is off) ──────────────────
    let expected: string;
    try {
      expected = requireSecretKey().key;
    } catch (_e) {
      return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const apikey = (req.headers.get('apikey') || '').trim();
    const cronSecret = (Deno.env.get('HUBLY_CRON_SECRET') || '').trim();
    const givenCron = (req.headers.get('x-hubly-cron-secret') || '').trim();
    const cronOk = !!cronSecret && givenCron === cronSecret;
    if (!cronOk && bearer !== expected && apikey !== expected) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const rec = (body && body.record) || {};
    const businessId = String(rec.id || '').trim();
    if (!businessId) {
      return new Response(JSON.stringify({ ok: false, error: 'no_business' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, expected, { auth: { persistSession: false } });

    const name = String(rec.name || '').trim() || '(unnamed business)';
    const slug = String(rec.slug || '').trim();
    const url = slug ? `https://${slug}.${PUBLIC_DOMAIN}` : '(no address yet)';
    const device = String(rec.signup_device || '').trim();

    // Owner email — from auth, by the owner_id just set on the claim.
    let ownerEmail = '(could not read owner email)';
    try {
      const ownerId = String(rec.owner_id || '').trim();
      if (ownerId) {
        const { data } = await admin.auth.admin.getUserById(ownerId);
        if (data?.user?.email) ownerEmail = data.user.email;
      }
    } catch (_e) { /* keep the honest fallback */ }

    // First message — the brief the build started from.
    let brief = '(first message not recorded)';
    try {
      const { data } = await admin
        .from('document_build_jobs')
        .select('brief')
        .eq('business_id', businessId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && typeof data.brief === 'string' && data.brief.trim()) brief = data.brief.trim();
    } catch (_e) { brief = '(first message unreadable)'; }

    // Edits since the build — owner patches to the page.
    let editsLine = 'no edits yet';
    try {
      const { count, error } = await admin
        .from('business_documents')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('created_by', 'patch');
      if (error) editsLine = '(edit count unreadable)';
      else if ((count || 0) > 0) editsLine = `${count} edit${count === 1 ? '' : 's'}`;
    } catch (_e) { editsLine = '(edit count unreadable)'; }

    if (!OWNER_EMAIL) {
      // Honest, not silent: nothing to send to.
      return new Response(JSON.stringify({ ok: false, reason: 'not_configured', detail: 'PLATFORM_OWNER_EMAIL unset' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ ok: false, reason: 'not_configured', detail: 'RESEND_API_KEY unset' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Plain and short — read on a phone. URL first and tappable; email plain to
    // copy. No marketing line. Fields in the agreed order. No PII in any URL.
    const deviceLine = device ? (device === 'phone' ? 'Phone' : device === 'desktop' ? 'Desktop' : device) : 'not recorded';
    const html =
      `<p><a href="${esc(url)}" style="font-size:17px;font-weight:700">${esc(url)}</a></p>` +
      `<p>Reply to: <a href="mailto:${esc(ownerEmail)}">${esc(ownerEmail)}</a></p>` +
      `<p><b>They asked for:</b><br>${esc(brief).replace(/\n/g, '<br>')}</p>` +
      `<p><b>Business:</b> ${esc(name)}<br>` +
      `<b>Built on:</b> ${esc(deviceLine)}<br>` +
      `<b>Edits:</b> ${esc(editsLine)}</p>`;
    const text =
      `${url}\n\nReply to: ${ownerEmail}\n\nThey asked for:\n${brief}\n\n` +
      `Business: ${name}\nBuilt on: ${deviceLine}\nEdits: ${editsLine}\n`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [OWNER_EMAIL], subject: `New signup: ${name}`, html, text }),
    });
    const resText = await res.text().catch(() => '');
    if (!res.ok) {
      console.error('signup-notify: resend rejected', res.status, resText.slice(0, 300));
      return new Response(JSON.stringify({ ok: false, status: res.status, error: resText.slice(0, 300) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    let id: string | null = null;
    try { id = JSON.parse(resText).id || null; } catch (_e) { /* ignore */ }
    return new Response(JSON.stringify({ ok: true, accepted: true, id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('signup-notify failed', (e as Error)?.message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error)?.message || 'threw' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
});
