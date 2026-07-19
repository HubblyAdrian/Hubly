/**
 * Booking Engine notifications — provider + customer emails via Resend.
 * Best-effort: never throw into the booking create path.
 */

function esc(s: unknown) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">${esc(label)}</td><td style="font-weight:500;">${esc(value)}</td></tr>`;
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !opts.to) return false;
  const from =
    Deno.env.get("RESEND_FROM_EMAIL") ||
    "Hubly Bookings <notifications@notifications.myhubly.app>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!r.ok) {
      console.warn("booking_notifications resend", await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("booking_notifications", e);
    return false;
  }
}

export type BookingNotifyInput = {
  status: "requested" | "confirmed" | string;
  confirmation_code?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_name: string;
  starts_at?: string | null;
  requested_date?: string | null;
  requested_time?: string | null;
  address?: string | null;
  price_cents?: number | null;
  what_happens_next?: string | null;
  business: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

function whenLabel(input: BookingNotifyInput): string {
  if (input.starts_at) {
    const iso = String(input.starts_at);
    const date = iso.slice(0, 10);
    const hm = iso.slice(11, 16);
    const [y, mo, d] = date.split("-").map(Number);
    const [hh, mm] = hm.split(":").map(Number);
    const h12 = (hh % 12) || 12;
    const ap = hh >= 12 ? "PM" : "AM";
    try {
      const day = new Date(y, (mo || 1) - 1, d || 1).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      return `${day} · ${h12}:${String(mm).padStart(2, "0")} ${ap}`;
    } catch {
      return `${date} ${hm}`;
    }
  }
  if (input.requested_date) {
    return `${input.requested_date}${input.requested_time ? " · " + input.requested_time : ""}`;
  }
  return "TBD";
}

export async function notifyBookingCreated(input: BookingNotifyInput): Promise<{
  provider: boolean;
  customer: boolean;
}> {
  const bizName = String(input.business.name || "Hubly provider").trim() || "Hubly provider";
  const when = whenLabel(input);
  const price = input.price_cents != null && Number.isFinite(input.price_cents)
    ? `$${(Number(input.price_cents) / 100).toFixed(2)}`
    : null;
  const isConfirmed = input.status === "confirmed";

  let provider = false;
  if (input.business.email) {
    const html =
      `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;">` +
      `<div style="background:#141B2B;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">` +
      `<div style="font-size:22px;font-weight:800;">${isConfirmed ? "New Instant Book" : "New booking request"}</div>` +
      `<div style="opacity:.75;margin-top:4px;">From Hubly Marketplace</div></div>` +
      `<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">` +
      `<table style="width:100%;border-collapse:collapse;">` +
      row("Client", input.customer_name) +
      row("Phone", input.customer_phone) +
      row("Email", input.customer_email) +
      row("Service", input.service_name) +
      row("When", when) +
      row("Address", input.address) +
      row("Total", price) +
      row("Code", input.confirmation_code) +
      `</table>` +
      `<p style="color:#555;margin:16px 0 0;font-size:13px;">${
        isConfirmed
          ? "This booking is confirmed. It’s on your Hubly calendar."
          : "Accept or decline this request in Marketplace → Bookings."
      }</p>` +
      `<div style="margin-top:20px;"><a href="https://myhubly.app" style="background:#D9632D;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Open Hubly</a></div>` +
      `</div><div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Sent by Hubly</div></div>`;

    provider = await sendResend({
      to: String(input.business.email),
      subject: isConfirmed
        ? `Instant Book — ${input.customer_name}`
        : `Booking request — ${input.customer_name}`,
      html,
    });
  }

  let customer = false;
  if (input.customer_email) {
    const html =
      `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;">` +
      `<div style="background:#141B2B;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;">` +
      `<div style="font-size:22px;font-weight:800;">${isConfirmed ? "Booking confirmed" : "Request sent"}</div>` +
      `<div style="opacity:.75;margin-top:4px;">${esc(bizName)}</div></div>` +
      `<div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px;">` +
      `<p style="color:#555;margin:0 0 16px;">Hi ${esc(input.customer_name)}, ${
        isConfirmed
          ? "your appointment is confirmed."
          : "your booking request was sent. The provider will accept or decline shortly."
      }</p>` +
      `<table style="width:100%;border-collapse:collapse;">` +
      row("Service", input.service_name) +
      row("When", when) +
      row("Address", input.address) +
      row("Code", input.confirmation_code) +
      row("Total", price) +
      `</table>` +
      (input.what_happens_next
        ? `<p style="color:#555;margin:16px 0 0;font-size:13px;">${esc(input.what_happens_next)}</p>`
        : "") +
      `<div style="margin-top:16px;padding:14px;background:#f5f5f3;border-radius:8px;">` +
      `<div style="font-weight:700;">${esc(bizName)}</div>` +
      (input.business.phone
        ? `<div style="color:#555;font-size:13px;">${esc(input.business.phone)}</div>`
        : "") +
      `</div></div>` +
      `<div style="text-align:center;color:#bbb;font-size:11px;margin-top:12px;">Powered by Hubly</div></div>`;

    customer = await sendResend({
      to: String(input.customer_email),
      subject: isConfirmed
        ? `Booking confirmed – ${input.service_name} with ${bizName}`
        : `Booking request sent – ${input.service_name}`,
      html,
    });
  }

  return { provider, customer };
}
