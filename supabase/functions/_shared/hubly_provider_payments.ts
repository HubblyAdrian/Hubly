/**
 * PaymentsProvider — vendor-agnostic payments boundary.
 * StripeProvider wraps existing production Stripe Connect helpers.
 * Never simulates a successful charge when keys are missing.
 */

import {
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";
import {
  createDestinationCheckout,
  createExpressAccount,
  stripeConfigured,
  stripeLivemode,
  type StripeAccount,
  type StripeCheckoutSession,
} from "./stripe.ts";

export interface PaymentsProvider {
  readonly id: string;
  isConfigured(): boolean;
  missingEnv(): string[];
  createConnectAccount(opts: {
    email?: string;
    businessId: string;
    ownerId: string;
  }): Promise<HublyProviderResult<StripeAccount>>;
  createBookingCheckout(opts: {
    connectedAccountId: string;
    amountCents: number;
    currency?: string;
    productName: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
    applicationFeeCents?: number;
  }): Promise<HublyProviderResult<StripeCheckoutSession>>;
}

export class StripePaymentsProvider implements PaymentsProvider {
  readonly id = "stripe";

  missingEnv(): string[] {
    return stripeConfigured() ? [] : ["STRIPE_SECRET_KEY"];
  }

  isConfigured(): boolean {
    return stripeConfigured();
  }

  async createConnectAccount(opts: {
    email?: string;
    businessId: string;
    ownerId: string;
  }): Promise<HublyProviderResult<StripeAccount>> {
    if (!this.isConfigured()) {
      return providerNotConfigured(this.id, this.missingEnv());
    }
    try {
      const account = await createExpressAccount(opts);
      return providerOk(this.id, account, "Stripe Connect account created", {
        livemode: stripeLivemode(),
      });
    } catch (e) {
      return providerError(
        this.id,
        "STRIPE_CONNECT_FAILED",
        e instanceof Error ? e.message : "Stripe Connect failed",
        { retryable: true },
      );
    }
  }

  async createBookingCheckout(opts: {
    connectedAccountId: string;
    amountCents: number;
    currency?: string;
    productName: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
    applicationFeeCents?: number;
  }): Promise<HublyProviderResult<StripeCheckoutSession>> {
    if (!this.isConfigured()) {
      return providerNotConfigured(this.id, this.missingEnv());
    }
    try {
      const session = await createDestinationCheckout({
        connectedAccountId: opts.connectedAccountId,
        amountCents: opts.amountCents,
        currency: opts.currency,
        productName: opts.productName,
        successUrl: opts.successUrl,
        cancelUrl: opts.cancelUrl,
        customerEmail: opts.customerEmail,
        applicationFeeCents: opts.applicationFeeCents,
        metadata: opts.metadata || {},
      });
      return providerOk(this.id, session, "Checkout session created", {
        livemode: stripeLivemode(),
      });
    } catch (e) {
      return providerError(
        this.id,
        "STRIPE_CHECKOUT_FAILED",
        e instanceof Error ? e.message : "Checkout failed",
        { retryable: true },
      );
    }
  }
}

export function createStripePaymentsProvider(): StripePaymentsProvider {
  return new StripePaymentsProvider();
}

export function getPaymentsProvider(): PaymentsProvider {
  return createStripePaymentsProvider();
}

export default StripePaymentsProvider;
