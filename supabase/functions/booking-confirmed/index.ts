// supabase/functions/booking-confirmed/index.ts
// Called from acceptBookingRequest() after an owner accepts a booking request.
// Emails the customer a confirmation + .ics calendar attachment via Resend.
// Accept must never depend on this succeeding — the frontend already try/catches.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function esc(s: unknown) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Accept "14:00", "14:00:00", or "2:00 PM" → {h,m} or null. */
function parseTime(raw: string): { h: number; m: number } | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const ap = ampm[3].toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return { h, m };
  }
  const parts = s.slice(0, 5).split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

function formatDateLong(dateYmd: string) {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  if (!y || !mo || !d) return dateYmd;
  try {
    return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateYmd;
  }
}

function formatTime12(h: number, m: number) {
  const ap = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${pad(m)} ${ap}`;
}

function icsEscape(text: string) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildIcs(opts: {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}) {
  const localStamp = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const utcStamp = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hubly//Booking Confirmed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${localStamp(opts.start)}`,
    `DTEND:${localStamp(opts.end)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
  ];
  if (opts.location) lines.push(`LOCATION:${icsEscape(opts.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ error: "Sign in required" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || "").trim();
    const customerEmail = String(body?.customer_email || "").trim().toLowerCase();
    const customerName = String(body?.customer_name || "there").trim() || "there";
    const serviceName = String(body?.service_name || "Appointment").trim() || "Appointment";
    const dateYmd = String(body?.date || "").trim();
    const timeRaw = String(body?.time || "").trim();
    const address = String(body?.address || "").trim();
    const vehicle = String(body?.vehicle || "").trim();
    const durationHours = Math.max(0.5, Number(body?.duration_hours) || 2);

    if (!businessId) return jsonRes({ error: "business_id is required" }, 400);
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return jsonRes({ error: "customer_email is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonRes({ error: "Server auth isn’t configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: biz, error: bizErr } = await admin
      .from("businesses")
      .select("id, name, phone, email, owner_id, slug")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr || !biz) return jsonRes({ error: "Business not found" }, 404);
    if (String(biz.owner_id) !== String(userData.user.id)) {
      return jsonRes({ error: "Not allowed" }, 403);
    }

    const bizName = String(biz.name || "your provider").trim() || "your provider";
    const bizPhone = String(biz.phone || "").trim();
    const bizEmail = String(biz.email || "").trim();

    const dateLabel = dateYmd ? formatDateLong(dateYmd) : "TBD";
    const parsedTime = parseTime(timeRaw);
    const timeLabel = parsedTime
      ? formatTime12(parsedTime.h, parsedTime.m)
      : timeRaw || "TBD";

    let icsAttachment: { filename: string; content: string } | null = null;
    if (dateYmd && parsedTime) {
      const [yy, mm, dd] = dateYmd.split("-").map(Number);
      const start = new Date(yy, (mm || 1) - 1, dd || 1, parsedTime.h, parsedTime.m, 0);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
        const title = `${serviceName} · ${bizName}`;
        const desc = [
          `Service: ${serviceName}`,
          address ? `Address: ${address}` : "",
          vehicle ? `Vehicle: ${vehicle}` : "",
          bizPhone ? `Phone: ${bizPhone}` : "",
          bizEmail ? `Email: ${bizEmail}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        const ics = buildIcs({
          uid: `hubly-${businessId}-${dateYmd}-${parsedTime.h}${pad(parsedTime.m)}@myhubly.app`,
          title,
          description: desc,
          location: address,
          start,
          end,
        });
        icsAttachment = {
          filename: `${serviceName.replace(/[^\w\-]+/g, "_").slice(0, 40) || "booking"}.ics`,
          content: toBase64(ics),
        };
      }
    }

    const row = (label: string, value: string) =>
      value
        ? `<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">${esc(label)}</td><td style="font-weight:500;">${esc(value)}</td></tr>`
        : "";

    const html =
      `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;">` +
      `<div style="background:#141B2B;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">` +
      `<div style="font-size:22px;font-weight:800;">You're booked!</div>` +
      `<div style="opacity:.75;margin-top:4px;">${esc(bizName)} confirmed your appointment</div></div>` +
      `<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">` +
      `<p style="color:#555;margin:0 0 16px;">Hi ${esc(customerName)}, your appointment is confirmed.</p>` +
      `<table style="width:100%;border-collapse:collapse;">` +
      row("Service", serviceName) +
      row("Date", dateLabel) +
      row("Time", timeLabel) +
      row("Address", address) +
      row("Vehicle", vehicle) +
      `</table>` +
      (icsAttachment
        ? `<p style="color:#555;font-size:13px;margin:16px 0 0;">A calendar invite (.ics) is attached — open it to add this to your calendar.</p>`
        : "") +
      `<div style="margin-top:16px;padding:14px;background:#f5f5f3;border-radius:8px;">` +
      `<div style="font-weight:700;">${esc(bizName)}</div>` +
      (bizPhone ? `<div style="color:#555;font-size:13px;">${esc(bizPhone)}</div>` : "") +
      (bizEmail ? `<div style="color:#555;font-size:13px;">${esc(bizEmail)}</div>` : "") +
      `</div></div>` +
      `<div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Powered by Hubly</div></div>`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return jsonRes({ error: "Email isn’t configured yet. Add a RESEND_API_KEY secret." }, 500);
    }

    const from =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Hubly Bookings <notifications@notifications.myhubly.app>";
    const resend = new Resend(apiKey);
    const subject = `Booking confirmed – ${serviceName} with ${bizName}`;

    const { error: sendErr } = await resend.emails.send({
      from,
      to: customerEmail,
      subject,
      html,
      attachments: icsAttachment
        ? [
            {
              filename: icsAttachment.filename,
              content: icsAttachment.content,
            },
          ]
        : undefined,
    });

    if (sendErr) {
      console.error("booking-confirmed Resend error:", sendErr);
      return jsonRes({ error: "Failed to send confirmation email." }, 502);
    }

    return jsonRes({ ok: true, ics: !!icsAttachment });
  } catch (e) {
    console.error("booking-confirmed error:", e);
    return jsonRes({ error: "Something went wrong." }, 500);
  }
});
