/** Minimal Stripe REST helpers for Connect Express + Checkout (Deno edge). */

export type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  email?: string | null;
};

export type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  payment_intent?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, string>;
  amount_total?: number | null;
  currency?: string | null;
};

function stripeKey() {
  return (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
}

export function stripeConfigured() {
  return !!stripeKey();
}

/** True when STRIPE_SECRET_KEY is a live key (sk_live_… / rk_live_…). */
export function stripeLivemode(): boolean | null {
  const key = stripeKey();
  if (!key) return null;
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return true;
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return false;
  // Unknown key shape — treat as live only if it doesn't look like a sandbox key.
  return !/_test_/.test(key);
}

export async function stripeRequest<T>(
  path: string,
  init: { method?: string; form?: Record<string, string | number | boolean | undefined | null> } = {},
): Promise<T> {
  const key = stripeKey();
  if (!key) throw new Error("Stripe isn’t configured yet. Add STRIPE_SECRET_KEY.");

  const method = init.method || "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };
  let body: string | undefined;
  if (init.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(init.form)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    body = params.toString();
  }

  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Stripe error (${res.status})`;
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = json?.error?.code;
    throw err;
  }
  return json as T;
}

export async function createExpressAccount(opts: {
  email?: string;
  businessId: string;
  ownerId: string;
}): Promise<StripeAccount> {
  return stripeRequest<StripeAccount>("/accounts", {
    method: "POST",
    form: {
      type: "express",
      email: opts.email || undefined,
      "capabilities[card_payments][requested]": true,
      "capabilities[transfers][requested]": true,
      "metadata[hubly_business_id]": opts.businessId,
      "metadata[hubly_owner_id]": opts.ownerId,
    },
  });
}

export async function retrieveAccount(accountId: string): Promise<StripeAccount> {
  return stripeRequest<StripeAccount>(`/accounts/${encodeURIComponent(accountId)}`);
}

export async function createAccountLink(opts: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  return stripeRequest<{ url: string }>("/account_links", {
    method: "POST",
    form: {
      account: opts.accountId,
      refresh_url: opts.refreshUrl,
      return_url: opts.returnUrl,
      type: "account_onboarding",
    },
  });
}

export async function createConnectLoginLink(accountId: string): Promise<{ url: string }> {
  return stripeRequest<{ url: string }>(
    `/accounts/${encodeURIComponent(accountId)}/login_links`,
    { method: "POST", form: {} },
  );
}

export async function createDestinationCheckout(opts: {
  connectedAccountId: string;
  amountCents: number;
  currency?: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  applicationFeeCents?: number;
  metadata: Record<string, string>;
}): Promise<StripeCheckoutSession> {
  const currency = (opts.currency || "usd").toLowerCase();
  const form: Record<string, string | number | boolean> = {
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": opts.amountCents,
    "line_items[0][price_data][product_data][name]": opts.productName,
    "line_items[0][quantity]": 1,
    "payment_intent_data[transfer_data][destination]": opts.connectedAccountId,
  };
  if (opts.applicationFeeCents && opts.applicationFeeCents > 0) {
    form["payment_intent_data[application_fee_amount]"] = opts.applicationFeeCents;
  }
  if (opts.customerEmail) form.customer_email = opts.customerEmail;
  let i = 0;
  for (const [k, v] of Object.entries(opts.metadata || {})) {
    if (!v) continue;
    form[`metadata[${k}]`] = v;
    form[`payment_intent_data[metadata][${k}]`] = v;
    i++;
    if (i > 40) break;
  }
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    form,
  });
}

export async function retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
}

/** Verify Stripe-Signature header (webhook). */
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<{ type: string; data: { object: Record<string, unknown> } }> {
  if (!signatureHeader) throw new Error("Missing Stripe-Signature");
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=")];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error("Invalid Stripe-Signature");

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) throw new Error("Webhook timestamp too old");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // timing-safe compare
  const a = expected;
  const b = v1;
  if (a.length !== b.length) throw new Error("Invalid signature");
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff !== 0) throw new Error("Invalid signature");

  return JSON.parse(rawBody);
}

export function appBaseUrl() {
  return (
    (Deno.env.get("HUBLY_APP_URL") || "").trim().replace(/\/$/, "") ||
    "https://myhubly.app"
  );
}

export function sanitizeAppReturnUrl(raw: unknown): string {
  const fallback = `${appBaseUrl()}/app`;
  const s = String(raw || "").trim();
  if (!s) return fallback;
  try {
    const u = new URL(s);
    const allowed = new Set([
      "myhubly.app",
      "www.myhubly.app",
      "hubly.app",
      "www.hubly.app",
      "localhost",
      "127.0.0.1",
    ]);
    const host = u.hostname.toLowerCase();
    if (!allowed.has(host) && !host.endsWith(".vercel.app")) return fallback;
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    return u.toString();
  } catch {
    return fallback;
  }
}
