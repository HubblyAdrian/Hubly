// #189: Customer Portal gateway — the single choke point between the
// browser and customers/jobs/recurring_schedules/memberships. The
// browser never receives a Supabase client capable of querying those
// tables directly; every response here is a deliberately narrow,
// customer-safe projection, same discipline as WebsiteBookingConfirmation
// (#188).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { issuePortalSession, verifyPortalAccessToken, verifyPortalSession } from "../_shared/portal_access.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

// "Later" recurring-schedule/membership statuses aren't shown at all —
// a cancelled schedule/plan isn't "what's happening next" for the
// customer, keeping the portal simple rather than a full history/CRM.
const VISIBLE_RECURRING_STATUSES = ["active", "paused"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ ok: false, error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!supabaseUrl || !serviceKey) return jsonRes({ ok: false, error: "server_not_configured" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  if (action === "verify") {
    const token = String(body?.token || "").trim();
    const lookup = await verifyPortalAccessToken(admin, token);
    if (!lookup.ok) return jsonRes({ ok: false, error: "invalid_or_expired_link" }, 401);
    const sessionToken = await issuePortalSession(lookup.businessId, lookup.customerId);
    if (!sessionToken) return jsonRes({ ok: false, error: "server_not_configured" }, 500);
    return jsonRes({ ok: true, sessionToken });
  }

  if (action === "getPortalData") {
    const sessionToken = String(body?.sessionToken || "");
    // Identity comes ONLY from the verified signature — nothing the
    // request body claims about businessId/customerId is ever trusted.
    const session = await verifyPortalSession(sessionToken);
    if (!session) return jsonRes({ ok: false, error: "session_expired" }, 401);
    const { businessId, customerId } = session;

    const [{ data: customerRow }, { data: businessRow }] = await Promise.all([
      admin.from("customers").select("name, phone, email").eq("id", customerId).eq("business_id", businessId)
        .maybeSingle(),
      admin.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    ]);
    if (!customerRow) return jsonRes({ ok: false, error: "customer_not_found" }, 404);

    // Jobs: matched by customer_id first (the real link), falling back
    // to this same customer's own phone/email for jobs created before
    // #189 (or via the separate owner-side createJob(), which doesn't
    // set customer_id at all — see task #200) never had it set. A
    // read-time fallback, not a second write-side matching system.
    const orParts = [`customer_id.eq.${customerId}`];
    if (customerRow.phone) orParts.push(`phone.eq.${customerRow.phone}`);
    if (customerRow.email) orParts.push(`email.ilike.${customerRow.email}`);
    const { data: jobRows } = await admin
      .from("jobs")
      .select("service_name, scheduled_date, scheduled_time, address, amount, status")
      .eq("business_id", businessId)
      .or(orParts.join(","));

    const jobs = (jobRows || []).map((j) => ({
      serviceName: String(j.service_name || ""),
      date: j.scheduled_date ? String(j.scheduled_date) : null,
      time: j.scheduled_time ? String(j.scheduled_time) : null,
      address: j.address ? String(j.address) : null,
      amount: j.amount != null ? Number(j.amount) : null,
      status: String(j.status || ""),
    }));
    const upcomingAppointments = jobs
      .filter((j) => j.status !== "completed")
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const pastAppointments = jobs
      .filter((j) => j.status === "completed")
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const { data: scheduleRows } = await admin
      .from("recurring_schedules")
      .select("service_name, frequency, next_occurrence_date, status")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .in("status", VISIBLE_RECURRING_STATUSES);
    const recurringServices = (scheduleRows || []).map((s) => ({
      serviceName: String(s.service_name || ""),
      frequency: String(s.frequency || ""),
      nextVisitDate: s.next_occurrence_date ? String(s.next_occurrence_date) : null,
      status: String(s.status || ""),
    }));

    const { data: membershipRows } = await admin
      .from("memberships")
      .select("plan_name, price, cadence, status")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .in("status", VISIBLE_RECURRING_STATUSES);
    const memberships = (membershipRows || []).map((m) => ({
      planName: String(m.plan_name || "Membership"),
      price: m.price != null ? Number(m.price) : null,
      cadence: m.cadence ? String(m.cadence) : null,
      status: String(m.status || ""),
    }));

    return jsonRes({
      ok: true,
      customerName: String(customerRow.name || ""),
      businessName: businessRow?.name ? String(businessRow.name) : "",
      upcomingAppointments,
      pastAppointments,
      recurringServices,
      memberships,
    });
  }

  return jsonRes({ ok: false, error: "unknown_action" }, 400);
});
