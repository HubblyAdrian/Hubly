// supabase/functions/send-customer-email/index.ts
// Generic owner-approved customer email send (review request, win-back,
// weather reschedule). Uses Resend — same pattern as booking-confirmed.
// Never drafts content itself; only sends what the owner already reviewed.

import { Resend } from "npm:resend";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { to_email, to_name, subject, body, business_name } = await req.json();
    if (!to_email || !body) {
      return new Response(JSON.stringify({ error: "to_email and body are required" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Email isn't configured yet. Add a RESEND_API_KEY secret." }), {
        status: 500,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") || "notifications@notifications.myhubly.app",
      to: to_email,
      subject: subject || `A message from ${business_name || "us"}`,
      text: body,
    });
    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: "Failed to send email." }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("send-customer-email error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong." }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
