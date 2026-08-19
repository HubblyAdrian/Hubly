// ============================================================================
// CHANGED BUT NEVER EXECUTED — API key migration, 2026-08-19
//
// WHAT CHANGED
//   Supabase key resolution was moved to _shared/supabase_admin.ts
//   (createAdminClient / createUserClient / requireSecretKey / adminHeaders).
//   That helper THROWS on a missing key instead of continuing with "", reads
//   the plural SUPABASE_PUBLISHABLE_KEYS the platform actually injects, and
//   never sends a non-JWT sb_secret_ key as a Bearer token.
//
// THIS FILE WAS NOT RUN.
//   502 "AI assistant temporarily unavailable" — ambiguous: that error can be raised either side of the Supabase client, so it does not prove the key resolved.
//
// TO PROVE IT
//   POST {"business_id":"<real id>","question":"..."} and get a 200 answer back. Needs the upstream AI provider to be healthy.
//
// A file that looks migrated and was never verified is worse than one that
// obviously still reads legacy vars: the second is greppable, the first looks
// done. Delete this banner only when the check above has actually been run.
// ============================================================================

// supabase/functions/ai-advisor/index.ts
// Ask-AI panel backend: pulls this business's own jobs/customers, builds a
// compact data summary, and asks Claude to answer the owner's question
// using only that summary. Deployed as a Supabase Edge Function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Supabase key resolution goes through _shared/supabase_admin.ts. It THROWS on a
// missing key instead of continuing with "" (nine call sites used to 401 quietly
// and be logged), reads the plural SUPABASE_PUBLISHABLE_KEYS the platform
// actually injects rather than the singular name that is set nowhere, and never
// sends a non-JWT sb_secret_ key as a Bearer token -- PostgREST rejects those as
// "Invalid JWT", which looks exactly like the empty-key 401 in a log.
import { createAdminClient } from "../_shared/supabase_admin.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-sonnet-5";
const MAX_QUESTION_LEN = 500;

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function buildSummary(business: any, jobs: any[], customers: any[]) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const in7 = new Date(today.getTime() + 7 * 86400000);

  const isCompleted = (j: any) => j.status === "completed";
  const isScheduled = (j: any) => j.status === "scheduled";
  const isPending = (j: any) => j.status === "pending";

  const jobsThisMonth = jobs.filter((j) => j.scheduled_date && new Date(j.scheduled_date) >= startOfMonth);
  const revenueThisMonth = jobsThisMonth
    .filter((j) => j.paid || isCompleted(j))
    .reduce((sum, j) => sum + (Number(j.amount) || 0), 0);

  const upcoming7d = jobs
    .filter((j) => j.scheduled_date && new Date(j.scheduled_date) >= today && new Date(j.scheduled_date) <= in7 && isScheduled(j))
    .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))
    .slice(0, 20)
    .map((j) => ({
      customer: j.customer_name,
      service: j.service_name,
      date: j.scheduled_date,
      time: j.scheduled_time,
      amount: j.amount,
    }));

  const pending = jobs.filter(isPending).map((j) => ({
    customer: j.customer_name,
    service: j.service_name,
    requested_date: j.scheduled_date,
  }));

  // Customer recency: last completed/scheduled job date per customer name
  const lastSeenByCustomer = new Map<string, string>();
  for (const j of jobs) {
    if (!j.customer_name || !j.scheduled_date) continue;
    const prev = lastSeenByCustomer.get(j.customer_name);
    if (!prev || j.scheduled_date > prev) lastSeenByCustomer.set(j.customer_name, j.scheduled_date);
  }
  const staleCustomers = [...lastSeenByCustomer.entries()]
    .map(([name, lastDate]) => ({ name, lastDate, daysSince: daysBetween(today, new Date(lastDate)) }))
    .filter((c) => c.daysSince >= 45)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 15);

  // Top customers by total spend (completed jobs)
  const spendByCustomer = new Map<string, number>();
  for (const j of jobs) {
    if (!j.customer_name || !isCompleted(j)) continue;
    spendByCustomer.set(j.customer_name, (spendByCustomer.get(j.customer_name) || 0) + (Number(j.amount) || 0));
  }
  const topCustomers = [...spendByCustomer.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    business_name: business?.name || "this business",
    today: today.toISOString().slice(0, 10),
    counts: {
      jobs_this_month: jobsThisMonth.length,
      completed_total: jobs.filter(isCompleted).length,
      scheduled_total: jobs.filter(isScheduled).length,
      pending_confirmation: jobs.filter(isPending).length,
      total_customers: customers.length,
    },
    revenue_this_month: Math.round(revenueThisMonth * 100) / 100,
    upcoming_7_days: upcoming7d,
    pending_needs_confirmation: pending,
    customers_not_seen_45_plus_days: staleCustomers,
    top_customers_by_spend: topCustomers,
  };
}

const SYSTEM_PROMPT = `You are the "Ask AI" assistant inside Hubly, a scheduling app for mobile detailing businesses.
The owner is asking you a question about their own business. You are given a JSON summary of their
real, current data (jobs, revenue, customers) below — this is the ONLY source of truth. Do not invent
numbers, customers, or jobs that aren't in the data. If the data doesn't answer the question, say so
plainly and suggest what they could look at instead.

Answer like a sharp, friendly ops-savvy colleague, not a chatbot. Be concise — a few sentences or a
short list, not a report. Prefer concrete next actions over generic advice ("text these 3 customers"
beats "consider re-engaging customers"). Use dollar amounts and names from the data when relevant.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { business_id, question } = await req.json();
    if (!business_id || !question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "business_id and question are required" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    if (question.length > MAX_QUESTION_LEN) {
      return new Response(JSON.stringify({ error: "Question is too long." }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createAdminClient();

    const [{ data: business }, { data: jobs }, { data: customers }] = await Promise.all([
      supabase.from("businesses").select("id, name").eq("id", business_id).single(),
      supabase.from("jobs").select("*").eq("business_id", business_id).limit(500),
      supabase.from("customers").select("id, first_name, last_name").eq("business_id", business_id),
    ]);

    if (!business) {
      return new Response(JSON.stringify({ error: "Business not found." }), {
        status: 404,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const summary = buildSummary(business, jobs || [], customers || []);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI assistant isn't configured yet. Ask the site owner to add an ANTHROPIC_API_KEY secret." }),
        { status: 500, headers: { ...CORS, "content-type": "application/json" } },
      );
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `BUSINESS DATA:\n${JSON.stringify(summary, null, 2)}\n\nQUESTION: ${question}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "The AI assistant is temporarily unavailable." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const data = await anthropicRes.json();
    const answer =
      (data.content || [])
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n")
        .trim() || "I couldn't generate a response — try rephrasing your question.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("ai-advisor error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
