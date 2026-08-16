/**
 * Server-side booking price — the single authority on what a booking costs.
 *
 * The website checkout used to take `amount_dollars` straight from the request
 * body, so the browser decided the price and the server charged it. A booking
 * for a $2,500 package could be completed for $1 from dev tools, with or
 * without a discount code. This module exists so the server computes the figure
 * itself from stored configuration and the customer's answers.
 *
 * IT RUNS THE CLIENT'S OWN PRICING ENGINE. `public/smart-quote/engine.js` is a
 * classic browser IIFE that attaches to globalThis, and Deno executes it as a
 * side-effect import with no window/document shims of any kind (verified in
 * production before this shipped). That matters more than it looks: Smart Quote
 * rules and modifiers move real money — across the live catalogs, 35 different
 * answers change a total, by up to $244.65, and some are NEGATIVE (a lawn
 * business's "Weekly" frequency is -$5.50). A server that re-implemented this
 * would drift, and pricing drift means charging people the wrong amount.
 *
 * One implementation, imported twice. Never two copies.
 */
import "../../../public/smart-quote/engine.js";
import { resolveService } from "./booking_engine.ts";
import { getService } from "./service_engine.ts";

type SmartQuote = {
  resolveConfig: (o: Record<string, unknown>) => Record<string, unknown>;
  defaultAnswers: (cfg: unknown) => Record<string, unknown>;
  prepareLivePricing: (cfg: unknown, dirty: unknown, pkgs: unknown[], st: unknown) => unknown[];
  compute: (cfg: unknown, st: unknown, pkgs: unknown[], addons: unknown[]) => {
    total?: number;
    subtotal?: number;
    lineItems?: Array<{ kind?: string; label?: string; amount?: number }>;
  };
  slug: (s: string) => string;
};

function sq(): SmartQuote {
  const s = (globalThis as unknown as { HublySmartQuote?: SmartQuote }).HublySmartQuote;
  if (!s) throw new Error("smart_quote_unavailable");
  return s;
}

export type PriceRequest = {
  service_id?: string | null;
  addon_ids?: string[] | null;
  /** Fallback key: the live client records add-on NAMES, not ids. */
  addon_names?: string[] | null;
  /** Smart Quote answers (vehicleType, condition, lotSize, sessionType, …). */
  answers?: Record<string, unknown> | null;
  /** Variable-priced services: which tier the customer picked. */
  vehicle_tier?: string | null;
};

export type PricedBooking = {
  ok: true;
  service_id: string;
  service_name: string;
  /** Package price after live/tier pricing, before add-ons and modifiers. */
  package_cents: number;
  /** Everything Smart Quote produced: package + modifiers + add-ons. */
  subtotal_cents: number;
  line_items: Array<{ kind: string; label: string; amount_cents: number }>;
} | { ok: false; error: string };

/** Money is cents everywhere on this path. Dollars only ever cross the wire. */
function toCents(dollars: unknown): number {
  const n = Number(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Build the Smart Quote package for a service, mirroring serviceAsPackage() in
 * public/smart-quote/booking.js:60-81 — including its variable-pricing rule.
 *
 * The classic booking path sets the base to ZERO when a variable service has no
 * price for the chosen tier ("owner didn't set it", hubly.html:40748). That is
 * reproduced here deliberately: falling back to some other number would invent a
 * price the owner never entered.
 */
function serviceAsPackage(
  svc: { id: string; name: string; price_cents: number | null; pricing_mode?: string; variable_prices?: Record<string, number> },
  tier: string | null,
): { id: string; name: string; price: number; pricingType: string; varPrices: Record<string, number> } {
  const variable = svc.pricing_mode === "variable";
  const vpCents = svc.variable_prices || {};
  const varPrices: Record<string, number> = {};
  for (const [k, v] of Object.entries(vpCents)) varPrices[k] = (Number(v) || 0) / 100;

  let priceDollars: number;
  if (variable) {
    if (tier) {
      const t = Number(varPrices[tier]);
      // Tier chosen but unpriced → 0, exactly like the client.
      priceDollars = Number.isFinite(t) && t > 0 ? t : 0;
    } else {
      // No tier yet: the client seeds from sedan/coupe (booking.js:66-68).
      priceDollars = Number(varPrices.sedan || varPrices.coupe || 0) || 0;
    }
  } else {
    priceDollars = (Number(svc.price_cents) || 0) / 100;
  }

  return {
    id: String(svc.id || sq().slug(svc.name || "svc")),
    name: String(svc.name || "Service"),
    price: priceDollars,
    pricingType: variable ? "variable" : "flat",
    varPrices,
  };
}

/**
 * Price a booking from stored configuration and the customer's answers.
 *
 * Nothing here reads a price from the request. `req` carries ids and answers
 * only; every figure comes from the business's own catalog and Smart Quote.
 */
export function priceBooking(
  business: Record<string, unknown>,
  meta: Record<string, unknown>,
  req: PriceRequest,
): PricedBooking {
  const serviceId = String(req.service_id || "").trim();
  if (!serviceId) return { ok: false, error: "service_id required" };

  // TWO reads, deliberately. resolveService returns BookingServiceDto — the
  // customer-facing projection, which carries hydrated `add_ons` but DROPS
  // `pricing.variable_prices` and `payment`. Pricing a variable service from
  // the DTO alone yields £0, because the tier map simply is not there.
  const dto = resolveService(business, serviceId);
  const full = getService(business, serviceId);
  if (!dto || !full) return { ok: false, error: "service_not_found" };
  const svc = {
    id: String(full.id),
    name: String(full.name),
    price_cents: full.pricing?.price_cents ?? null,
    pricing_mode: String(full.pricing?.mode || "fixed"),
    variable_prices: (full.pricing?.variable_prices || {}) as Record<string, number>,
  };

  const SQ = sq();
  const businessType = business.business_type ?? meta.businessType ?? null;
  const cfg = SQ.resolveConfig({
    businessType,
    blueprint: null,
    ownerConfig: (meta.quoteConfig as Record<string, unknown>) || {},
  });

  const pkg = serviceAsPackage(
    svc as unknown as Parameters<typeof serviceAsPackage>[0],
    req.vehicle_tier ? String(req.vehicle_tier) : null,
  );

  // Add-ons are resolved by ID against the stored catalog — the request never
  // carries an add-on price. compute() only counts ids listed in state.addonIds
  // (smart-quote/engine.js), so both must be supplied.
  const wantedIds = new Set((req.addon_ids || []).map((x) => String(x)));
  const wantedNames = new Set(
    (req.addon_names || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean),
  );
  const addons = (dto.add_ons || [])
    .filter((a) =>
      wantedIds.has(String(a.id)) ||
      wantedNames.has(String(a.name || "").trim().toLowerCase())
    )
    .map((a) => ({ id: String(a.id), name: String(a.name), price: (Number(a.price_cents) || 0) / 100 }));

  // vehicle_tier is an ANSWER, not a price. prepareLivePricing resolves the
  // tier from answers.vehicleType via mapVehicleTier — exactly as the browser
  // does when selectVType fires — so feeding it here keeps tier pricing in the
  // one engine instead of computing it a second time on this side.
  const answers = Object.assign(
    {},
    SQ.defaultAnswers(cfg),
    (req.answers && typeof req.answers === "object") ? req.answers : {},
  );
  if (req.vehicle_tier) answers.vehicleType = String(req.vehicle_tier);
  const state = { answers, packageIds: [pkg.id], addonIds: addons.map((a) => a.id) };

  const livePkgs = SQ.prepareLivePricing(cfg, meta.dirtySurcharge, [pkg], state);
  const money = SQ.compute(cfg, state, livePkgs, addons);

  const livePrice = Number((livePkgs?.[0] as { price?: number })?.price) || 0;
  return {
    ok: true,
    service_id: String(svc.id),
    service_name: String(svc.name || "Booking"),
    package_cents: toCents(livePrice),
    subtotal_cents: toCents(Number(money.total) || 0),
    line_items: (money.lineItems || []).map((l) => ({
      kind: String(l.kind || ""),
      label: String(l.label || ""),
      amount_cents: toCents(Number(l.amount) || 0),
    })),
  };
}

/**
 * Apply a percentage discount in CENTS.
 *
 * Rounded here the same way the client rounds it, so the Review screen and the
 * receipt agree to the penny. The two used to differ by 1c on 5 of 114 real
 * combinations: the client rounded the TOTAL after subtracting a float
 * discount, the server rounded the DISCOUNT and then subtracted.
 */
export function applyPercentDiscountCents(subtotalCents: number, percent: number): number {
  const sub = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct <= 0) return sub;
  // Match the client: subtract in dollars-space, then round the result.
  const total = Math.round(sub - sub * (pct / 100));
  return Math.max(0, total);
}
