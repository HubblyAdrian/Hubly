/**
 * ShippingProvider — abstract shipping for Commerce Engine.
 * V1 modes: pickup, flat_rate, local_delivery, free.
 * Shippo / EasyPost can implement this interface later without changing order logic.
 */

import {
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";

export type ShippingMode = "pickup" | "flat_rate" | "local_delivery" | "free";

export interface ShippingQuoteInput {
  mode: ShippingMode;
  subtotalCents: number;
  weightGrams?: number;
  destination?: Record<string, unknown>;
  profile?: {
    rateCents?: number;
    config?: Record<string, unknown>;
  };
}

export interface ShippingQuote {
  mode: ShippingMode;
  label: string;
  amountCents: number;
  etaDays?: number | null;
  provider: string;
}

export interface ShippingProvider {
  readonly id: string;
  isConfigured(): boolean;
  missingEnv(): string[];
  quote(input: ShippingQuoteInput): Promise<HublyProviderResult<ShippingQuote>>;
}

const LABELS: Record<ShippingMode, string> = {
  pickup: "Pickup",
  flat_rate: "Flat rate shipping",
  local_delivery: "Local delivery",
  free: "Free shipping",
};

/** Built-in Hubly shipping — no third-party keys required. */
export class HublyBuiltinShippingProvider implements ShippingProvider {
  readonly id = "hubly_builtin";

  missingEnv(): string[] {
    return [];
  }

  isConfigured(): boolean {
    return true;
  }

  async quote(input: ShippingQuoteInput): Promise<HublyProviderResult<ShippingQuote>> {
    const mode = input.mode;
    let amountCents = 0;
    if (mode === "flat_rate" || mode === "local_delivery") {
      amountCents = Math.max(0, Number(input.profile?.rateCents) || 0);
    } else if (mode === "free" || mode === "pickup") {
      amountCents = 0;
    } else {
      return providerError(this.id, "UNSUPPORTED_MODE", `Unknown shipping mode: ${mode}`);
    }
    return providerOk(this.id, {
      mode,
      label: LABELS[mode] || mode,
      amountCents,
      etaDays: mode === "pickup" ? 0 : mode === "local_delivery" ? 1 : 3,
      provider: this.id,
    }, "Shipping quote ready");
  }
}

/** Placeholder for future Shippo — fails honestly until keys exist. */
export class ShippoShippingProvider implements ShippingProvider {
  readonly id = "shippo";

  missingEnv(): string[] {
    const key = (Deno.env.get("SHIPPO_API_KEY") || "").trim();
    return key ? [] : ["SHIPPO_API_KEY"];
  }

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  async quote(input: ShippingQuoteInput): Promise<HublyProviderResult<ShippingQuote>> {
    if (!this.isConfigured()) {
      return providerNotConfigured(this.id, this.missingEnv());
    }
    // Stage 2 — live Shippo rates. Until wired, refuse rather than simulate.
    return providerError(
      this.id,
      "NOT_IMPLEMENTED",
      "Shippo live rates are Stage 2 — use hubly_builtin for pickup / flat / local / free.",
      { retryable: false },
    );
  }
}

export function resolveShippingProvider(preferred?: string): ShippingProvider {
  if (preferred === "shippo") return new ShippoShippingProvider();
  return new HublyBuiltinShippingProvider();
}
