/**
 * TELL SOMEONE A SALE HAPPENED.
 *
 * WHY THIS EXISTS
 *
 * Traced 2026-09-05: grepping `notify|sendEmail|resend|twilio|notification_deliveries`
 * across `commerce_checkout.ts`, `create-store-checkout` and `commerce-api` returned
 * ZERO hits. `finalizePaidCommerceOrder` marked the order paid, linked a customer,
 * deducted inventory, converted the cart — and told nobody. Not the owner, not the
 * buyer.
 *
 * That is the booking-notification defect wearing different clothes, and a step
 * worse. `booking-notify` at least TRIES and writes a `notification_deliveries` row
 * when it skips. Commerce had no notifier to skip, so there was nothing to log,
 * nothing to count, and no way to discover after the fact that a sale had gone
 * unheard. A silent failure you cannot even measure is the worst version of it.
 *
 * It is built BEFORE the first real purchase on purpose. `commerce_orders` is 0
 * (measured 2026-09-05), so there is exactly one chance to have this in place before
 * a sale rather than after one goes missing.
 *
 * WHAT IT REUSES, DELIBERATELY
 *
 * Everything here follows `booking-notify/index.ts`, which is the shape that works:
 *
 *  - RECIPIENT RESOLUTION: `businesses.email` → the owner's `auth.users.email` →
 *    a loud operator alert. Built the same morning for #28, where a real booking
 *    reached a market business and the owner email was skipped for "no recipient
 *    address" — while the address sat in auth.users the whole time. 24 of 34 claimed
 *    businesses were reachable only via that fallback.
 *  - `notification_deliveries` on EVERY path — sent, failed, or skipped — so a sale
 *    nobody heard about is a row someone can query, not a silence.
 *  - The ledger write never breaks the send, and a failed RECORD is never reported
 *    as a failed SEND.
 *
 * WHAT IT DOES NOT DO
 *
 * No SMS. Twilio credentials exist but the booking path does not use them either,
 * and adding a second channel here would be a second thing to get wrong before the
 * first one has ever run.
 */

// deno-lint-ignore no-explicit-any
type Admin = any;

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "Hubly <notifications@notifications.myhubly.app>";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

function money(cents: unknown): string {
  const n = Number(cents);
  return Number.isFinite(n) ? `$${(n / 100).toFixed(2)}` : "$0.00";
}

/** The shell booking-notify uses, so the two emails look like one product. */
function shell(opts: { accent: string; headline: string; subhead: string; bodyHtml: string }): string {
  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <div style="background:${opts.accent};padding:28px 28px 24px;">
        <div style="font-size:22px;font-weight:700;color:#fff;line-height:1.3;">${opts.headline}</div>
        <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px;">${opts.subhead}</div>
      </div>
      <div style="padding:24px 28px 28px;">${opts.bodyHtml}</div>
    </div>
    <div style="text-align:center;color:#a1a1aa;font-size:11px;margin-top:12px;">Powered by Hubly</div>
  </div>`;
}

function itemsTable(items: Array<Record<string, unknown>>): string {
  if (!items.length) return `<p style="color:#71717a;margin:0;">No line items were recorded on this order.</p>`;
  const rows = items.map((i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;color:#18181b;">${esc(i.title || "Item")}${
    Number(i.qty) > 1 ? ` <span style="color:#71717a;">× ${esc(i.qty)}</span>` : ""
  }</td>
      <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;color:#18181b;white-space:nowrap;">${money(i.total_cents)}</td>
    </tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

type LedgerRef = {
  businessId: string | null;
  subjectId: string | null;
  role: "owner" | "customer" | "operator";
};

/**
 * Send one email and record the attempt, whatever happens. Lifted from
 * booking-notify: every path out of here writes a row — sent with the provider's
 * receipt, failed with the reason, or skipped with "no recipient address".
 */
async function sendEmail(
  admin: Admin,
  ledger: LedgerRef,
  to: string | null,
  subject: string,
  html: string,
): Promise<"sent" | "failed" | "skipped"> {
  const record = async (status: "sent" | "failed" | "skipped", extra: { providerMessageId?: string | null; error?: string | null }) => {
    try {
      const { error } = await admin.from("notification_deliveries").insert({
        business_id: ledger.businessId,
        subject_type: "commerce_order",
        subject_id: ledger.subjectId,
        recipient_role: ledger.role,
        recipient: to,
        channel: "email",
        provider: "resend",
        provider_message_id: extra.providerMessageId ?? null,
        status,
        error: extra.error ? String(extra.error).slice(0, 500) : null,
      });
      if (error) console.error("commerce_notify: notification_deliveries write failed:", error.message);
    } catch (e) {
      console.error("commerce_notify: notification_deliveries write threw:", e);
    }
  };

  if (!to) {
    // Not a failure and not a success. Worth being able to COUNT — that is the
    // whole difference between this and what commerce had before, which was
    // nothing to count at all.
    await record("skipped", { error: "no recipient address" });
    return "skipped";
  }
  if (!RESEND_KEY) {
    await record("failed", { error: "RESEND_API_KEY not configured" });
    return "failed";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("commerce_notify: resend error", text.slice(0, 300));
      await record("failed", { error: `resend ${res.status}: ${text.slice(0, 300)}` });
      return "failed";
    }
    let id: string | null = null;
    try { id = (JSON.parse(text) as { id?: string }).id ?? null; } catch { /* keep null */ }
    await record("sent", { providerMessageId: id });
    return "sent";
  } catch (e) {
    console.error("commerce_notify: send failed", e);
    await record("failed", { error: String(e).slice(0, 300) });
    return "failed";
  }
}

/**
 * WHERE THE OWNER'S ADDRESS ACTUALLY LIVES.
 *
 * Identical to the resolution built for booking-notify (#28). `businesses.email` is
 * null for 141 of 159 businesses because exactly ONE code path in the product ever
 * sets it (`claim-draft-business/index.ts:151`) — every other route to an owned
 * business sets `owner_id` and never touches email. The address is not missing; it
 * is in auth.users, one join away.
 */
async function resolveOwnerEmail(
  admin: Admin,
  business: { id?: unknown; email?: unknown; owner_id?: unknown; slug?: unknown },
): Promise<{ email: string; source: string }> {
  const direct = String(business?.email || "").trim();
  if (direct) return { email: direct, source: "businesses.email" };
  const ownerId = String(business?.owner_id || "").trim();
  if (!ownerId) return { email: "", source: "" };
  try {
    const { data } = await admin.auth.admin.getUserById(ownerId);
    const authEmail = String(data?.user?.email || "").trim();
    if (authEmail) return { email: authEmail, source: "auth.users.email" };
  } catch (e) {
    console.error("commerce_notify: owner auth lookup failed", (e as Error)?.message || e);
  }
  return { email: "", source: "" };
}

export type SaleNotifyResult = {
  owner: "sent" | "failed" | "skipped";
  customer: "sent" | "failed" | "skipped";
  ownerEmailSource: string;
};

/**
 * Tell the owner a sale happened, and give the buyer a Hubly confirmation.
 *
 * BEST-EFFORT BY DESIGN, LOUD BY DESIGN. The order is already paid and recorded
 * before this runs; a notification failure must never un-pay it or fail the
 * webhook. But it is never silent: every outcome is a `notification_deliveries`
 * row, and an unreachable owner also raises an operator alert, because the person
 * who needs to know is us — the owner is unreachable by definition.
 *
 * THE BUYER GETS A HUBLY CONFIRMATION rather than relying on Stripe's own receipt.
 * Stripe's receipt depends on that account's dashboard settings, which we do not
 * control and cannot see; a buyer confirmation that exists only if a setting
 * happens to be on is not a confirmation we can promise.
 */
export async function notifyCommerceSale(
  admin: Admin,
  opts: { orderId: string },
): Promise<SaleNotifyResult> {
  const orderId = String(opts?.orderId || "").trim();
  const nothing: SaleNotifyResult = { owner: "skipped", customer: "skipped", ownerEmailSource: "" };
  if (!orderId) return nothing;

  const { data: order } = await admin
    .from("commerce_orders")
    .select("id,business_id,order_number,status,total_cents,currency,customer_name,customer_email,customer_phone,shipping_method,fulfillment,created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    console.error(`commerce_notify: order ${orderId} not found — nobody notified`);
    return nothing;
  }

  const { data: business } = await admin
    .from("businesses")
    .select("id,name,slug,email,owner_id,brand_color")
    .eq("id", order.business_id)
    .maybeSingle();

  const { data: itemRows } = await admin
    .from("commerce_order_items")
    .select("title,qty,unit_price_cents,total_cents")
    .eq("order_id", orderId);
  const items = Array.isArray(itemRows) ? itemRows : [];

  const bizName = String(business?.name || "your business").trim();
  const accent = String(business?.brand_color || "").trim() || "#141B2B";
  const buyer = String(order.customer_name || "A customer").trim();
  const total = money(order.total_cents);
  const orderNo = String(order.order_number || order.id || "").trim();
  const ledgerBase = { businessId: order.business_id ?? null, subjectId: order.id ?? null };

  // ── the owner ─────────────────────────────────────────────────────────────
  const { email: ownerEmail, source: ownerEmailSource } = await resolveOwnerEmail(admin, business || {});

  const contactBits = [order.customer_email, order.customer_phone].map((x) => String(x ?? "").trim()).filter(Boolean);
  const ownerHtml = shell({
    accent,
    headline: `You sold ${total}`,
    subhead: bizName,
    bodyHtml:
      `<p style="margin:0 0 16px;color:#3f3f46;font-size:14px;">` +
      `<strong>${esc(buyer)}</strong> bought from your store.</p>` +
      itemsTable(items) +
      `<table style="width:100%;border-collapse:collapse;font-size:15px;margin-top:8px;">` +
      `<tr><td style="padding:10px 0;font-weight:700;color:#18181b;">Total</td>` +
      `<td style="padding:10px 0;text-align:right;font-weight:700;color:#18181b;">${total}</td></tr></table>` +
      (contactBits.length
        ? `<p style="margin:16px 0 0;color:#3f3f46;font-size:14px;">Reach them at ${esc(contactBits.join(" · "))}.</p>`
        : `<p style="margin:16px 0 0;color:#71717a;font-size:14px;">No contact details were recorded with this order.</p>`) +
      (orderNo ? `<p style="margin:12px 0 0;color:#a1a1aa;font-size:12px;">Order ${esc(orderNo)}</p>` : ""),
  });

  const ownerStatus = await sendEmail(
    admin,
    { ...ledgerBase, role: "owner" },
    ownerEmail || null,
    `You sold ${total} — ${buyer}`,
    ownerHtml,
  );

  // AN UNREACHABLE OWNER IS AN OPERATIONAL FAILURE, NOT A QUIET BRANCH.
  // Same treatment as #28: after the auth-email fallback this is rare and
  // abnormal, and it means real money moved that the business will never hear
  // about. The operator is told, because the owner cannot be.
  if (!ownerEmail) {
    const opsTo = (Deno.env.get("PLATFORM_OWNER_EMAIL") || "").trim();
    console.error(
      `commerce_notify: UNREACHABLE OWNER — business ${String(business?.slug || order.business_id)} sold ${total} ` +
      `and cannot be told. businesses.email empty and no auth email for owner_id ${String(business?.owner_id || "(none)")}. Order ${orderId}.`,
    );
    if (opsTo) {
      await sendEmail(
        admin,
        { ...ledgerBase, role: "operator" },
        opsTo,
        `Hubly: ${bizName} made a sale and cannot be told`,
        shell({
          accent: "#B91C1C",
          headline: "A sale nobody can be told about",
          subhead: bizName,
          bodyHtml:
            `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;"><strong>${esc(bizName)}</strong> ` +
            `(${esc(String(business?.slug || ""))}) took ${total} from ${esc(buyer)} and has no reachable owner address.</p>` +
            `<p style="margin:0;color:#3f3f46;font-size:14px;">businesses.email is empty and owner_id ` +
            `${esc(String(business?.owner_id || "(none)"))} has no auth email. The buyer has been confirmed; the business has not been told.</p>` +
            `<p style="margin:12px 0 0;color:#a1a1aa;font-size:12px;">Order ${esc(orderId)}</p>`,
        }),
      );
    }
  }

  // ── the buyer ─────────────────────────────────────────────────────────────
  const buyerEmail = String(order.customer_email || "").trim();
  const buyerHtml = shell({
    accent,
    headline: "Order confirmed",
    subhead: bizName,
    bodyHtml:
      `<p style="margin:0 0 16px;color:#3f3f46;font-size:14px;">Thanks${
        buyer && buyer !== "A customer" ? `, ${esc(buyer.split(" ")[0])}` : ""
      } — ${esc(bizName)} has your order.</p>` +
      itemsTable(items) +
      `<table style="width:100%;border-collapse:collapse;font-size:15px;margin-top:8px;">` +
      `<tr><td style="padding:10px 0;font-weight:700;color:#18181b;">Total paid</td>` +
      `<td style="padding:10px 0;text-align:right;font-weight:700;color:#18181b;">${total}</td></tr></table>` +
      (orderNo ? `<p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;">Order ${esc(orderNo)}</p>` : "") +
      // The notification standard: never invite a reply to an address nobody reads.
      `<p style="margin:12px 0 0;color:#71717a;font-size:13px;">Questions about this order go to ${esc(bizName)} directly.</p>`,
  });

  const customerStatus = await sendEmail(
    admin,
    { ...ledgerBase, role: "customer" },
    buyerEmail || null,
    `Your order from ${bizName}`,
    buyerHtml,
  );

  console.log(
    `commerce_notify [${orderId}] owner=${ownerStatus}${ownerEmailSource ? `(${ownerEmailSource})` : ""} customer=${customerStatus} total=${total}`,
  );
  return { owner: ownerStatus, customer: customerStatus, ownerEmailSource };
}
