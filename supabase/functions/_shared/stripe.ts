/** Minimal Stripe REST helpers for Connect Express + Checkout (Deno edge). */

export type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  email?: string | null;
  business_profile?: {
    name?: string | null;
    url?: string | null;
    support_email?: string | null;
    support_phone?: string | null;
  } | null;
  settings?: {
    branding?: {
      icon?: string | null;
      logo?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
    } | null;
  } | null;
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

/** A business, as far as Stripe branding is concerned. */
export type BrandingSource = {
  name?: string | null;
  slug?: string | null;
  brand_color?: string | null;
  bg_color?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Stripe rejects anything that is not exactly #RRGGBB. */
function hexColor(v: unknown): string | undefined {
  const s = String(v || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : undefined;
}

/**
 * Branding to push onto a connected account.
 *
 * Without this an Express account is anonymous: the Express dashboard, Stripe's
 * onboarding screens and every Stripe-sent email show platform defaults, so a
 * photographer's customer and the photographer themselves both see "Hubly"
 * where the business name belongs.
 *
 * NOT SET HERE: `settings[branding][logo]` and `[icon]`. Those take a Stripe
 * FILE ID, not a URL — the image has to be uploaded to the Files API first
 * (multipart, purpose=business_logo/business_icon), in the connected account's
 * context, and `stripeRequest` sends no Stripe-Account header at all. Passing
 * `logo_url` straight through would simply be rejected. Colours and names carry
 * most of the benefit and need no upload, so they ship now and the logo is a
 * separate job. (Only 5 of 19 production businesses have a logo_url today.)
 */
export function accountBrandingForm(
  biz: BrandingSource,
  opts?: { siteBase?: string },
): Record<string, string> {
  const form: Record<string, string> = {};
  const name = String(biz.name || "").trim();
  if (name) form["business_profile[name]"] = name.slice(0, 250);

  const slug = String(biz.slug || "").trim();
  const base = opts?.siteBase || "myhubly.app";
  if (slug) form["business_profile[url]"] = `https://${slug}.${base}`;

  const email = String(biz.email || "").trim();
  if (email) form["business_profile[support_email]"] = email;
  const phone = String(biz.phone || "").trim();
  if (phone) form["business_profile[support_phone]"] = phone;

  const primary = hexColor(biz.brand_color);
  if (primary) form["settings[branding][primary_color]"] = primary;
  const secondary = hexColor(biz.bg_color);
  if (secondary) form["settings[branding][secondary_color]"] = secondary;

  return form;
}

export async function createExpressAccount(opts: {
  email?: string;
  businessId: string;
  ownerId: string;
  branding?: Record<string, string>;
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
      ...(opts.branding || {}),
    },
  });
}

/**
 * Fill in branding the account does not already have.
 *
 * Deliberately NEVER overwrites. Once an owner has been through Express
 * onboarding, `business_profile[name]` is a name THEY confirmed, and the colours
 * may have been set in their own dashboard. Re-pushing our values on every
 * "connect Stripe" click would silently stomp the owner's choices — so each
 * field is sent only when Stripe currently holds nothing for it.
 *
 * Returns the fields actually written, so the caller can log a no-op honestly.
 */
export async function fillMissingAccountBranding(
  accountId: string,
  desired: Record<string, string>,
  current: StripeAccount,
): Promise<string[]> {
  const has: Record<string, unknown> = {
    "business_profile[name]": current.business_profile?.name,
    "business_profile[url]": current.business_profile?.url,
    "business_profile[support_email]": current.business_profile?.support_email,
    "business_profile[support_phone]": current.business_profile?.support_phone,
    "settings[branding][primary_color]": current.settings?.branding?.primary_color,
    "settings[branding][secondary_color]": current.settings?.branding?.secondary_color,
  };
  const form: Record<string, string> = {};
  for (const [k, v] of Object.entries(desired)) {
    const existing = has[k];
    if (existing === undefined || existing === null || String(existing).trim() === "") {
      form[k] = v;
    }
  }
  const keys = Object.keys(form);
  if (!keys.length) return [];
  await stripeRequest<StripeAccount>(`/accounts/${encodeURIComponent(accountId)}`, {
    method: "POST",
    form,
  });
  return keys;
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
  onBehalfOf?: string | null;
  metadata: Record<string, string>;
}): Promise<StripeCheckoutSession> {
  const currency = (opts.currency || "usd").toLowerCase();
  const form: Record<string, string | number | boolean> = {
    mode: "payment",
    // Dynamic payment methods are the DEFAULT for a Checkout Session, and they
    // are expressed by the ABSENCE of `payment_method_types`. Stripe then uses
    // the payment method configuration on the platform account (Cards, Apple
    // Pay, Google Pay, Link, ...).
    //
    // DO NOT add `payment_method_types[...]`. Setting it overrides the dashboard
    // configuration and silently drops every wallet — Apple Pay, Google Pay and
    // Link would stop appearing at checkout with no error anywhere. New payment
    // methods belong in the Stripe dashboard, not in this file.
    //
    // DO NOT add `automatic_payment_methods[enabled]` either. It is a
    // PaymentIntent parameter and is NOT valid on Checkout Sessions: f13c751
    // added it here to "state the current default", and Stripe rejected every
    // session with `Received unknown parameter: automatic_payment_methods`,
    // breaking all card checkout until it was removed. There is no parameter
    // that states this default — the default is the omission, and this comment
    // is the only safe way to record it.
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
  // `on_behalf_of` makes the connected account the merchant of record for the
  // charge while the money still flows as a destination charge. It is being
  // trialled to see whether it also moves the Checkout header off the platform
  // name — an OPEN QUESTION, not a known behaviour. It is opt-in precisely
  // because f13c751 shipped an unverified parameter on this exact call and
  // killed every card payment: this one must not ride along with a fix that has
  // not yet been confirmed working in production.
  if (opts.onBehalfOf) {
    form["payment_intent_data[on_behalf_of]"] = opts.onBehalfOf;
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

/**
 * Every business site lives on its own subdomain (<slug>.myhubly.app), which is
 * where customers actually check out. The allowlist below used to be exact-match
 * only, so a customer paying from kestrel.myhubly.app had their success_url
 * rewritten to the fallback and landed on the platform app after paying instead
 * of back on the business's own site.
 *
 * Matched as a SINGLE DNS label before the apex — deliberately not
 * `host.endsWith(".myhubly.app")`. A suffix test is the shape that goes wrong
 * later: it would also accept `a.b.myhubly.app`, and the same habit applied to a
 * domain we don't fully control accepts anything an attacker can create a
 * hostname under. One label, DNS charset, anchored both ends.
 */
const HUBLY_SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myhubly\.app$/;

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
    const ok = allowed.has(host) ||
      HUBLY_SUBDOMAIN_RE.test(host) ||
      host.endsWith(".vercel.app");
    if (!ok) return fallback;
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    return u.toString();
  } catch {
    return fallback;
  }
}
