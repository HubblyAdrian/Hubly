/**
 * Connector contracts Hubly expects (vendor-agnostic).
 * Implementations land only when we intentionally choose a production vendor.
 *
 * Intentional launch choices (when ready):
 *   Payment  → Stripe
 *   Email    → Resend
 *   SMS      → Twilio
 *   Calendar → Google Calendar
 *   Ads      → Google Ads / Meta
 *   Maps     → Google Maps
 *   Domain   → TBD (Cloudflare OR Porkbun OR Namecheap) — not chosen yet
 */

import {
  connectionRequired,
  envTruthy,
  connectorError,
  connectorOk,
  type HublyConnectorResult,
} from "./hubly_connectors.ts";
import {
  createDestinationCheckout,
  createExpressAccount,
  stripeConfigured,
  stripeLivemode,
  type StripeAccount,
  type StripeCheckoutSession,
} from "./stripe.ts";

export interface PaymentConnector {
  readonly id: string;
  isConnected(): boolean;
  missingConnection(): string[];
  createConnectAccount(opts: {
    email?: string;
    businessId: string;
    ownerId: string;
  }): Promise<HublyConnectorResult<StripeAccount>>;
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
  }): Promise<HublyConnectorResult<StripeCheckoutSession>>;
}

/** Intentional production choice: Stripe */
export class StripePaymentConnector implements PaymentConnector {
  readonly id = "stripe";
  missingConnection(): string[] {
    return stripeConfigured() ? [] : ["STRIPE_SECRET_KEY"];
  }
  isConnected(): boolean {
    return stripeConfigured();
  }
  async createConnectAccount(opts: {
    email?: string;
    businessId: string;
    ownerId: string;
  }): Promise<HublyConnectorResult<StripeAccount>> {
    if (!this.isConnected()) {
      return connectionRequired(this.id, "Stripe", this.missingConnection());
    }
    try {
      const account = await createExpressAccount(opts);
      return connectorOk(this.id, account, "Stripe Connect account created", {
        livemode: stripeLivemode(),
      });
    } catch (e) {
      return connectorError(
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
  }): Promise<HublyConnectorResult<StripeCheckoutSession>> {
    if (!this.isConnected()) {
      return connectionRequired(this.id, "Stripe", this.missingConnection());
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
      return connectorOk(this.id, session, "Checkout session created", {
        livemode: stripeLivemode(),
      });
    } catch (e) {
      return connectorError(
        this.id,
        "STRIPE_CHECKOUT_FAILED",
        e instanceof Error ? e.message : "Checkout failed",
        { retryable: true },
      );
    }
  }
}

export function getPaymentConnector(): PaymentConnector {
  return new StripePaymentConnector();
}

export interface CalendarConnector {
  readonly id: string;
  isConnected(): boolean;
  missingConnection(): string[];
  listUpcoming(opts: {
    accessToken: string;
    calendarId?: string;
    maxResults?: number;
  }): Promise<HublyConnectorResult<Array<{ id: string; htmlLink?: string | null }>>>;
  createEvent(opts: {
    accessToken: string;
    calendarId?: string;
    event: {
      summary: string;
      description?: string;
      startIso: string;
      endIso: string;
      timeZone?: string;
    };
  }): Promise<HublyConnectorResult<{ id: string; htmlLink?: string | null }>>;
}

/** Intentional production choice: Google Calendar */
export class GoogleCalendarConnector implements CalendarConnector {
  readonly id = "google_calendar";
  missingConnection(): string[] {
    const missing: string[] = [];
    if (!envTruthy("GOOGLE_CLIENT_ID")) missing.push("GOOGLE_CLIENT_ID");
    if (!envTruthy("GOOGLE_CLIENT_SECRET")) missing.push("GOOGLE_CLIENT_SECRET");
    return missing;
  }
  isConnected(): boolean {
    return this.missingConnection().length === 0;
  }
  async listUpcoming(opts: {
    accessToken: string;
    calendarId?: string;
    maxResults?: number;
  }) {
    if (!this.isConnected()) {
      return connectionRequired(this.id, "Google Calendar", this.missingConnection());
    }
    if (!opts.accessToken) {
      return connectorError(this.id, "MISSING_ACCESS_TOKEN", "Google access token required");
    }
    const cal = encodeURIComponent(opts.calendarId || "primary");
    const params = new URLSearchParams({
      maxResults: String(opts.maxResults || 10),
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
    });
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?${params}`,
        { headers: { Authorization: `Bearer ${opts.accessToken}` } },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return connectorError(
          this.id,
          "GOOGLE_LIST_FAILED",
          json?.error?.message || `Google Calendar error (${res.status})`,
          { retryable: res.status >= 500 },
        );
      }
      const items = Array.isArray(json.items) ? json.items : [];
      return connectorOk(
        this.id,
        items.map((it: { id?: string; htmlLink?: string }) => ({
          id: String(it.id || ""),
          htmlLink: it.htmlLink || null,
        })),
        `Loaded ${items.length} events`,
      );
    } catch (e) {
      return connectorError(
        this.id,
        "GOOGLE_REQUEST_FAILED",
        e instanceof Error ? e.message : "Google Calendar request failed",
        { retryable: true },
      );
    }
  }
  async createEvent(opts: {
    accessToken: string;
    calendarId?: string;
    event: {
      summary: string;
      description?: string;
      startIso: string;
      endIso: string;
      timeZone?: string;
    };
  }) {
    if (!this.isConnected()) {
      return connectionRequired(this.id, "Google Calendar", this.missingConnection());
    }
    if (!opts.accessToken) {
      return connectorError(this.id, "MISSING_ACCESS_TOKEN", "Google access token required");
    }
    const cal = encodeURIComponent(opts.calendarId || "primary");
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: opts.event.summary,
            description: opts.event.description || "",
            start: { dateTime: opts.event.startIso, timeZone: opts.event.timeZone || "UTC" },
            end: { dateTime: opts.event.endIso, timeZone: opts.event.timeZone || "UTC" },
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return connectorError(
          this.id,
          "GOOGLE_CREATE_FAILED",
          json?.error?.message || `Google Calendar error (${res.status})`,
          { retryable: res.status >= 500 },
        );
      }
      return connectorOk(this.id, {
        id: String(json.id || ""),
        htmlLink: json.htmlLink || null,
      }, "Event created");
    } catch (e) {
      return connectorError(
        this.id,
        "GOOGLE_REQUEST_FAILED",
        e instanceof Error ? e.message : "Google Calendar request failed",
        { retryable: true },
      );
    }
  }
}

export function getCalendarConnector(): CalendarConnector {
  return new GoogleCalendarConnector();
}

/** Contract stubs — vendor chosen at launch time */
export interface EmailConnector {
  readonly id: string;
  isConnected(): boolean;
  send(opts: { to: string; subject: string; html: string; from?: string }): Promise<HublyConnectorResult<{ id: string }>>;
}
export interface MessagingConnector {
  readonly id: string;
  isConnected(): boolean;
  sendSms(opts: { to: string; body: string }): Promise<HublyConnectorResult<{ id: string }>>;
}
export interface MapsConnector {
  readonly id: string;
  isConnected(): boolean;
  geocode(address: string): Promise<HublyConnectorResult<{ lat: number; lng: number }>>;
}
export interface AdvertisingConnector {
  readonly id: string;
  isConnected(): boolean;
}
export interface AccountingConnector {
  readonly id: string;
  isConnected(): boolean;
}

export class UnconfiguredEmailConnector implements EmailConnector {
  readonly id = "email";
  isConnected() {
    return false;
  }
  async send() {
    return connectionRequired(this.id, "Email", ["EMAIL_CONNECTOR"]);
  }
}
export class UnconfiguredMessagingConnector implements MessagingConnector {
  readonly id = "messaging";
  isConnected() {
    return false;
  }
  async sendSms() {
    return connectionRequired(this.id, "SMS", ["MESSAGING_CONNECTOR"]);
  }
}
export class UnconfiguredMapsConnector implements MapsConnector {
  readonly id = "maps";
  isConnected() {
    return false;
  }
  async geocode() {
    return connectionRequired(this.id, "Maps", ["MAPS_CONNECTOR"]);
  }
}
export class UnconfiguredAdvertisingConnector implements AdvertisingConnector {
  readonly id = "advertising";
  isConnected() {
    return false;
  }
}
export class UnconfiguredAccountingConnector implements AccountingConnector {
  readonly id = "accounting";
  isConnected() {
    return false;
  }
}

export function getEmailConnector(): EmailConnector {
  return new UnconfiguredEmailConnector();
}
export function getMessagingConnector(): MessagingConnector {
  return new UnconfiguredMessagingConnector();
}
export function getMapsConnector(): MapsConnector {
  return new UnconfiguredMapsConnector();
}
export function getAdvertisingConnector(): AdvertisingConnector {
  return new UnconfiguredAdvertisingConnector();
}
export function getAccountingConnector(): AccountingConnector {
  return new UnconfiguredAccountingConnector();
}

/** Connections registry for status / Connections page */
export function listConnectionStatuses() {
  const payment = getPaymentConnector();
  const calendar = getCalendarConnector();
  const email = getEmailConnector();
  const messaging = getMessagingConnector();
  const maps = getMapsConnector();
  return [
    {
      kind: "domain",
      label: "Domain",
      connected: false,
      message: "Domain connection required",
      note: "Registrar not chosen yet — contract ready",
    },
    {
      kind: "payment",
      label: "Stripe",
      connected: payment.isConnected(),
      message: payment.isConnected() ? "Stripe connected" : "Stripe connection required",
      missing: payment.missingConnection(),
    },
    {
      kind: "calendar",
      label: "Google Calendar",
      connected: calendar.isConnected(),
      message: calendar.isConnected()
        ? "Google Calendar connected"
        : "Google Calendar connection required",
      missing: calendar.missingConnection(),
    },
    {
      kind: "email",
      label: "Email",
      connected: email.isConnected(),
      message: "Email connection required",
      note: "Intentional vendor later: Resend",
    },
    {
      kind: "messaging",
      label: "SMS",
      connected: messaging.isConnected(),
      message: "SMS connection required",
      note: "Intentional vendor later: Twilio",
    },
    {
      kind: "maps",
      label: "Maps",
      connected: maps.isConnected(),
      message: "Maps connection required",
      note: "Intentional vendor later: Google Maps",
    },
  ];
}
