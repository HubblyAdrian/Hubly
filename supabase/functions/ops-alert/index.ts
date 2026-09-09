// OPS ALERT — tells Adrian the endpoint is refusing, or that drafts are burning, without
// spending a penny of the thing it is protecting.
//
// WHY THIS EXISTS. On 2026-09-09 the OpenAI account emptied twice. Both times the way we
// found out was a test script, the second time hours in. While it was empty, owner signup
// AND the customer chat on every live business site returned 502 — one key backs 17 edge
// functions. The visitor saw an honest error; nobody was told.
//
// WHY NO SYNTHETIC PROBE. A probe on a schedule costs model quota continuously, and quota
// is the scarce thing — that is the whole failure being guarded against. So this reads
// rows that real traffic already wrote: endpoint_failures for refusals, businesses for
// burn. The accepted cost is that the refusal alert fires only once a real person has hit
// the error; at 3am with no traffic there is nothing to report, which is the right answer.
//
// Auth: the cron secret or our service key, same as booking-notify/signup-notify.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireSecretKey } from '../_shared/supabase_admin.ts';

const RESEND_KEY = (Deno.env.get('RESEND_API_KEY') || '').trim();
const RESEND_FROM = (Deno.env.get('RESEND_FROM_EMAIL') || 'Hubly <notifications@notifications.myhubly.app>').trim();
const OWNER_EMAIL = (Deno.env.get('PLATFORM_OWNER_EMAIL') || '').trim();
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').trim();
const PROJECT_REF = SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];

// ── THRESHOLDS, PICKED FROM REAL TRAFFIC ────────────────────────────────────────────
// Measured 2026-09-09 over 30 days, counting ONLY signups with a stored conversation
// (i.e. a real person on the real client; our own harnesses have none, and setting a
// threshold from our own load would set it uselessly high):
//   30 active hours · mean 1.67/hour · p95 = 5 · busiest hour ever = 9
// So 12 in a rolling hour is above every hour real traffic has ever produced, and lands
// at roughly a third of an OpenAI top-up (~35 drafts) — early enough to act on, late
// enough not to cry wolf. This ALERTS, it does not block; the first time it fires on
// genuine traffic, raise it rather than muting it.
const BURN_PER_HOUR = 12;
// One refusal is noise (a timeout, a blip). Four inside fifteen minutes is an outage.
const FAILURES_WINDOW_MIN = 15;
const FAILURES_TRIGGER = 4;
// An outage says its piece once and then waits. 6h is long enough not to nag through a
// working day, short enough that a second, separate outage still gets through.
const COOLDOWN_HOURS = 6;

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function send(to: string, subject: string, html: string, text: string) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html, text }),
    });
    const t = await r.text().catch(() => '');
    if (!r.ok) return { ok: false, error: `resend ${r.status}: ${t.slice(0, 200)}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error)?.message || 'threw' }; }
}

Deno.serve(async (req) => {
  try {
    let expected: string;
    try { expected = requireSecretKey().key; }
    catch (e) { return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 }); }
    // pg_cron sends x-hubly-cron-secret (the convention hubly-recurring-maintain already
    // uses, and what the vault secret is wired to); a human or a script can present our
    // service key as a bearer instead. Either is enough; neither is optional.
    const presented = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const headerSecret = (req.headers.get('x-hubly-cron-secret') || '').trim();
    const cronSecret = (Deno.env.get('HUBLY_CRON_SECRET') || '').trim();
    const authorised = presented === expected
      || (!!cronSecret && (headerSecret === cronSecret || presented === cronSecret));
    if (!authorised) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorised' }), { status: 401 });
    }

    // DRY RUN: decide everything, send nothing, touch no cooldown. So the logic can be
    // proved without either emailing a false alarm or burning the 6h cooldown that a real
    // outage would need. `{"dry_run":true}` in the body.
    let dryRun = false;
    try { dryRun = (await req.json())?.dry_run === true; } catch { /* no body */ }

    const admin = createClient(SUPABASE_URL, expected, { auth: { persistSession: false } });
    const sent: string[] = [];
    const skipped: string[] = [];

    // Has this kind of alert spoken recently?
    async function onCooldown(kind: string): Promise<boolean> {
      const { data } = await admin.from('ops_alerts').select('last_sent_at').eq('kind', kind).maybeSingle();
      if (!data?.last_sent_at) return false;
      return (Date.now() - new Date(data.last_sent_at as string).getTime()) < COOLDOWN_HOURS * 3600_000;
    }
    async function markSent(kind: string, detail: string) {
      await admin.from('ops_alerts').upsert({ kind, last_sent_at: new Date().toISOString(), last_detail: detail });
    }

    // ── 1. THE ENDPOINT IS REFUSING ──────────────────────────────────────────────────
    const since = new Date(Date.now() - FAILURES_WINDOW_MIN * 60_000).toISOString();
    const { data: fails } = await admin.from('endpoint_failures')
      .select('fn,detail,upstream_status,context,occurred_at')
      .gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(200);
    const n = (fails || []).length;

    if (n >= FAILURES_TRIGGER && !(await onCooldown('endpoint_refusing'))) {
      const newest = fails![0];
      // NEVER a field we did not record. The detail is the upstream's own message; if it
      // is absent the line says so rather than approximating a cause.
      const cause = String(newest.detail || '').trim() || 'no detail recorded';
      const status = newest.upstream_status ? ` (upstream ${newest.upstream_status})` : '';
      const owners = (fails || []).filter((f) => f.context === 'owner').length;
      const customers = (fails || []).filter((f) => f.context === 'customer').length;
      const who =
        `${owners} were people trying to sign up; ${customers} were customers on a live business site.`;
      const logs = `https://supabase.com/dashboard/project/${PROJECT_REF}/functions/hubly-conversation/logs`;
      const subject = `Hubly is refusing requests — ${cause.slice(0, 80)}`;
      const text =
        `${n} failures in the last ${FAILURES_WINDOW_MIN} minutes on hubly-conversation.\n\n` +
        `Cause reported by the upstream: ${cause}${status}\n\n${who}\n\n` +
        `While this lasts, nobody can sign up and no customer can talk to a Hubly site. ` +
        `The booking form still works — it writes straight to the database with no model involved.\n\n` +
        `Logs: ${logs}\n`;
      const html =
        `<p><strong>${n} failures in the last ${FAILURES_WINDOW_MIN} minutes</strong> on hubly-conversation.</p>` +
        `<p>Cause reported by the upstream: <code>${esc(cause)}</code>${esc(status)}</p><p>${esc(who)}</p>` +
        `<p>While this lasts, nobody can sign up and no customer can talk to a Hubly site. ` +
        `The booking form still works — it writes straight to the database with no model involved.</p>` +
        `<p><a href="${esc(logs)}">Open the function logs</a></p>`;
      if (dryRun) {
        skipped.push(`endpoint_refusing — DRY RUN, would have sent: ${subject}`);
      } else if (OWNER_EMAIL) {
        const r = await send(OWNER_EMAIL, subject, html, text);
        // Delivery is best effort; the row is the source of truth, and a failed send is
        // visible in this response rather than silent.
        if (r.ok) { await markSent('endpoint_refusing', cause); sent.push('endpoint_refusing'); }
        else skipped.push(`endpoint_refusing — send failed: ${r.error}`);
      } else skipped.push('endpoint_refusing — PLATFORM_OWNER_EMAIL unset');
    } else if (n >= FAILURES_TRIGGER) skipped.push('endpoint_refusing — on cooldown');

    // ── 2. DRAFTS ARE BURNING ────────────────────────────────────────────────────────
    // The same count is the abuse alarm now that the per-IP rate limit sees real client
    // addresses: 12 in an hour needs at least two IPs to get past a 10/IP/hour cap.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: drafts } = await admin.from('businesses')
      .select('id', { count: 'exact', head: true }).gte('created_at', hourAgo);
    const burned = drafts || 0;

    if (burned >= BURN_PER_HOUR && !(await onCooldown('draft_burn'))) {
      const share = Math.round((burned / 35) * 100);
      const dash = `https://supabase.com/dashboard/project/${PROJECT_REF}/editor`;
      const subject = `Hubly draft burn: ${burned} sites generated in the last hour`;
      const text =
        `${burned} businesses were created in the last hour. The busiest hour of real traffic ` +
        `in the 30 days to 2026-09-09 was 9, so this is well outside normal.\n\n` +
        `Each draft is a full site generation. At the 2026-09-09 anchor (~35 drafts drained one ` +
        `top-up, denominator unknown) that is roughly ${share}% of a top-up in one hour.\n\n` +
        `If this is not a launch, it is someone with a script. Drafts: ${dash}\n`;
      const html =
        `<p><strong>${burned} businesses created in the last hour.</strong> The busiest hour of real ` +
        `traffic in the 30 days to 2026-09-09 was 9, so this is well outside normal.</p>` +
        `<p>Each draft is a full site generation — roughly <strong>${share}% of a top-up</strong> in one hour, ` +
        `at the 2026-09-09 anchor (~35 drafts drained one top-up; denominator unknown).</p>` +
        `<p>If this is not a launch, it is someone with a script. <a href="${esc(dash)}">Open the table</a></p>`;
      if (dryRun) {
        skipped.push(`draft_burn — DRY RUN, would have sent: ${subject}`);
      } else if (OWNER_EMAIL) {
        const r = await send(OWNER_EMAIL, subject, html, text);
        if (r.ok) { await markSent('draft_burn', `${burned}/hour`); sent.push('draft_burn'); }
        else skipped.push(`draft_burn — send failed: ${r.error}`);
      } else skipped.push('draft_burn — PLATFORM_OWNER_EMAIL unset');
    } else if (burned >= BURN_PER_HOUR) skipped.push('draft_burn — on cooldown');

    return new Response(JSON.stringify({
      ok: true, failures_in_window: n, drafts_last_hour: burned, sent, skipped,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error)?.message || 'threw' }), { status: 500 });
  }
});
