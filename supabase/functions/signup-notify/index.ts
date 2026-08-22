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
    const recoveryDeliveryId = (body && body.recovery_delivery_id) || null;
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

    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ ok: false, reason: 'not_configured', detail: 'RESEND_API_KEY unset' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const deviceLine = device ? (device === 'phone' ? 'Phone' : device === 'desktop' ? 'Desktop' : device) : 'not recorded';

    // One Resend send. Returns { ok, id?, error? }.
    async function send(to: string, subject: string, html: string, text: string) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html, text }),
        });
        const t = await r.text().catch(() => '');
        if (!r.ok) return { ok: false, error: `resend ${r.status}: ${t.slice(0, 200)}` };
        let id: string | null = null; try { id = JSON.parse(t).id || null; } catch (_e) { /* ignore */ }
        return { ok: true, id };
      } catch (e) { return { ok: false, error: (e as Error)?.message || 'threw' }; }
    }
    // Record the recovery send by flipping the pending row the trigger wrote, so a
    // stuck 'pending' means the call never landed and a failed send is on the record.
    async function recordRecovery(status: string, providerMessageId: string | null, error: string | null) {
      try {
        if (recoveryDeliveryId) {
          await admin.from('notification_deliveries').update({
            recipient: ownerEmail, provider: 'resend', provider_message_id: providerMessageId,
            status, error: error ? String(error).slice(0, 500) : null, attempted_at: new Date().toISOString(),
          }).eq('id', recoveryDeliveryId);
        } else {
          await admin.from('notification_deliveries').insert({
            business_id: businessId, subject_type: 'signup', subject_id: businessId, recipient_role: 'owner',
            recipient: ownerEmail, channel: 'email', provider: 'resend', provider_message_id: providerMessageId,
            status, error: error ? String(error).slice(0, 500) : null,
          });
        }
      } catch (e) { console.error('recordRecovery failed', (e as Error)?.message); }
    }

    // ── 1. PLATFORM-OWNER notification (only if configured) ───────────────────
    let platform: Record<string, unknown> = { skipped: 'PLATFORM_OWNER_EMAIL unset' };
    if (OWNER_EMAIL) {
      const html =
        `<p><a href="${esc(url)}" style="font-size:17px;font-weight:700">${esc(url)}</a></p>` +
        `<p>Reply to: <a href="mailto:${esc(ownerEmail)}">${esc(ownerEmail)}</a></p>` +
        `<p><b>They asked for:</b><br>${esc(brief).replace(/\n/g, '<br>')}</p>` +
        `<p><b>Business:</b> ${esc(name)}<br><b>Built on:</b> ${esc(deviceLine)}<br><b>Edits:</b> ${esc(editsLine)}</p>`;
      const text = `${url}\n\nReply to: ${ownerEmail}\n\nThey asked for:\n${brief}\n\nBusiness: ${name}\nBuilt on: ${deviceLine}\nEdits: ${editsLine}\n`;
      platform = await send(OWNER_EMAIL, `New signup: ${name}`, html, text);
    }

    // ── 2. RECOVERY email to the PERSON — their way back if they forget which
    //       address they used. Independent of PLATFORM_OWNER_EMAIL. URL first and
    //       most prominent (it's what they'll forward). Reads like a person wrote it.
    let recovery: Record<string, unknown>;
    const ownerEmailOk = ownerEmail && ownerEmail.indexOf('@') !== -1;
    if (!ownerEmailOk) {
      // Never invent a recipient. Record honestly that we couldn't reach them.
      await recordRecovery('failed', null, 'owner email not readable');
      recovery = { ok: false, reason: 'owner_email_unreadable' };
    } else {
      // Points back into the product, never at this inbox (nobody reads it).
      const appUrl = `https://${PUBLIC_DOMAIN}`;
      const rHtml =
        `<p>Your site is live:</p>` +
        `<p><a href="${esc(url)}" style="font-size:20px;font-weight:700">${esc(url)}</a></p>` +
        `<p>You're signed in as ${esc(ownerEmail)} — use that address to come back any time.</p>` +
        `<p>To change anything, come back to <a href="${esc(appUrl)}">${esc(appUrl)}</a> and just tell Hubly what you'd like.</p>`;
      const rText =
        `Your site is live:\n${url}\n\n` +
        `You're signed in as ${ownerEmail} — use that address to come back any time.\n\n` +
        `To change anything, come back to ${appUrl} and just tell Hubly what you'd like.\n`;
      const sent = await send(ownerEmail, `Your site is live — ${url}`, rHtml, rText);
      await recordRecovery(sent.ok ? 'sent' : 'failed', (sent.id as string) || null, (sent.error as string) || null);
      recovery = sent;
    }

    return new Response(JSON.stringify({ ok: true, platform, recovery }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('signup-notify failed', (e as Error)?.message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error)?.message || 'threw' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
});
