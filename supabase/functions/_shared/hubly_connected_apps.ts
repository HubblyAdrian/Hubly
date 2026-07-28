/**
 * Hubly Core — Connected Apps engine
 *
 * Product name: Connected Apps (“Connect Dropbox”, not “External Workspace”).
 * Internal storage may still use project workspace tables.
 *
 * This is the long-term integration framework for Hubly:
 * every vendor (Adobe, Canva, Dropbox, Meta, Stripe, …) registers through
 * ConnectedAppProvider. UI renders actions from declared capabilities —
 * never hardcode provider conditionals in product surfaces.
 *
 * Projects own Connected Apps. Business OAuth lives at the connection layer;
 * project links attach a provider workspace to a Hubly Project.
 */

import {
  envTruthy,
  type HublyProviderResult,
} from "./hubly_providers.ts";

/** Capability tags a Connected App may declare. */
export type ConnectedAppCapability =
  | "storage"
  | "editing"
  | "publishing"
  | "creative"
  | "messaging"
  | "calendar"
  | "payments"
  | "reviews"
  | "analytics"
  | "webhooks"
  | "assets_import"
  | "assets_export"
  | "templates"
  | "scheduling";

/**
 * Provider id — open string so new plugins need not edit this union.
 * Known ids are listed in CONNECTED_APP_CATALOG.
 */
export type ConnectedAppId = string;

/** Documented known ids (not exhaustive — plugins may add more). */
export const KNOWN_CONNECTED_APP_IDS = [
  "adobe_lightroom",
  "capture_one",
  "dropbox",
  "google_drive",
  "canva",
  "frame_io",
  "meta",
  "google_business",
  "stripe",
  "twilio",
  "other",
] as const;

export type ConnectedAppHealth =
  | "healthy"
  | "degraded"
  | "not_configured"
  | "disconnected"
  | "error";

export type ConnectedAppStatus = {
  connected: boolean;
  health: ConnectedAppHealth;
  accountLabel?: string | null;
  lastSyncAt?: string | null;
  message?: string;
};

export type ConnectedAppPermission = {
  id: string;
  label: string;
  required?: boolean;
};

export type ConnectedAppAction = {
  id: string;
  label: string;
  capability: ConnectedAppCapability;
  /** Optional hint for dynamic UI */
  description?: string;
};

/**
 * ConnectedAppProvider — vendor-agnostic integration contract.
 * Implement once per vendor; register into the Connected Apps engine.
 */
export interface ConnectedAppProvider {
  readonly id: ConnectedAppId;
  readonly name: string;

  isConfigured(): boolean;
  missingEnv(): string[];

  connect(opts: {
    businessId: string;
    projectId?: string;
    returnTo?: string;
  }): Promise<HublyProviderResult<{ authorizeUrl?: string }>>;

  disconnect(opts: {
    businessId: string;
    projectId?: string;
  }): Promise<HublyProviderResult<{ disconnected: true }>>;

  sync(opts: {
    businessId: string;
    projectId?: string;
  }): Promise<HublyProviderResult<{ lastSyncAt: string }>>;

  status(opts: {
    businessId: string;
    projectId?: string;
  }): Promise<HublyProviderResult<ConnectedAppStatus>>;

  health(opts?: {
    businessId?: string;
  }): Promise<HublyProviderResult<ConnectedAppHealth>>;

  webhook?(req: {
    headers: Record<string, string>;
    body: unknown;
  }): Promise<HublyProviderResult<{ handled: boolean }>>;

  permissions(): ConnectedAppPermission[];

  /** Declared capabilities — UI renders from this, not provider id switches. */
  capabilities(): ConnectedAppCapability[];

  /** Optional product actions derived from capabilities. */
  actions?(): ConnectedAppAction[];

  /**
   * Creative-capable apps: create a design from brand + assets.
   * Creative Engine calls this via capability resolve — never hardcode vendor.
   */
  createDesign?(opts: {
    businessId: string;
    projectId?: string;
    title: string;
    templateId?: string;
    brand?: Record<string, unknown>;
    assetUrls?: string[];
    copy?: string;
  }): Promise<HublyProviderResult<{
    id: string;
    title?: string;
    editUrl?: string;
    exportUrl?: string;
    thumbnailUrl?: string;
  }>>;
}

const _registry = new Map<string, ConnectedAppProvider>();

export function registerConnectedApp(provider: ConnectedAppProvider): void {
  _registry.set(provider.id, provider);
}

export function getConnectedApp(id: string): ConnectedAppProvider | null {
  return _registry.get(id) || null;
}

export function listConnectedApps(): ConnectedAppProvider[] {
  return Array.from(_registry.values());
}

export function listConnectedAppsByCapability(
  capability: ConnectedAppCapability,
): ConnectedAppProvider[] {
  return listConnectedApps().filter((p) => p.capabilities().includes(capability));
}

/** Unregister — tests / freeze plugin verification only. */
export function unregisterConnectedApp(id: string): void {
  _registry.delete(id);
}

/** Test-only — clear registry. */
export function clearConnectedAppRegistryForTests(): void {
  _registry.clear();
}

/** Catalog metadata for product UI (Connected Apps / Apps Marketplace). */
export type ConnectedAppCatalogEntry = {
  id: ConnectedAppId;
  name: string;
  role: string;
  capabilities: ConnectedAppCapability[];
  /** Product-facing capability labels — what AI and Marketplace show. */
  productCapabilities: string[];
  /** Available in Marketplace even before a provider class is registered. */
  marketplaceAvailable?: boolean;
};

export const CONNECTED_APP_CATALOG: ConnectedAppCatalogEntry[] = [
  {
    id: "adobe_lightroom",
    name: "Adobe Lightroom",
    role: "Editing",
    capabilities: ["editing", "assets_import", "assets_export"],
    productCapabilities: ["RAW Editing", "Albums", "Metadata", "Photo Sync"],
    marketplaceAvailable: true,
  },
  {
    id: "canva",
    name: "Canva",
    role: "Creative",
    capabilities: ["creative", "templates", "publishing", "assets_import", "assets_export"],
    productCapabilities: [
      "Marketing Graphics",
      "Social Graphics",
      "Flyers",
      "Brand Assets",
      "Templates",
    ],
    marketplaceAvailable: true,
  },
  {
    id: "frame_io",
    name: "Frame.io",
    role: "Review",
    capabilities: ["creative", "assets_import", "reviews"],
    productCapabilities: ["Review links", "Asset comments", "Client review"],
    marketplaceAvailable: true,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    role: "Storage",
    capabilities: ["storage", "assets_import", "assets_export"],
    productCapabilities: ["File Storage", "Folder Sync", "Asset Delivery"],
    marketplaceAvailable: true,
  },
  {
    id: "google_drive",
    name: "Google Drive",
    role: "Storage",
    capabilities: ["storage", "assets_import", "assets_export"],
    productCapabilities: ["File Storage", "Folder Sync", "Shared drives"],
    marketplaceAvailable: true,
  },
  {
    id: "meta",
    name: "Meta",
    role: "Publishing",
    capabilities: ["publishing", "messaging", "scheduling"],
    productCapabilities: ["Instagram", "Facebook", "Messenger", "Publishing"],
    marketplaceAvailable: true,
  },
  {
    id: "google_business",
    name: "Google Business",
    role: "Local",
    capabilities: ["publishing", "reviews"],
    productCapabilities: ["Google listing", "Reviews", "Local posts"],
    marketplaceAvailable: true,
  },
  {
    id: "capture_one",
    name: "Capture One",
    role: "Editing",
    capabilities: ["editing", "assets_import", "assets_export"],
    productCapabilities: ["RAW Editing", "Tethered Capture", "Photo Sync"],
    marketplaceAvailable: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    role: "Payments",
    capabilities: ["payments"],
    productCapabilities: ["Payments", "Invoices", "Payouts"],
    marketplaceAvailable: true,
  },
  {
    id: "twilio",
    name: "Twilio",
    role: "Messaging",
    capabilities: ["messaging"],
    productCapabilities: ["SMS", "Messaging"],
    marketplaceAvailable: true,
  },
];

/** Extra Marketplace-only catalog rows (no ConnectedAppId yet / coming soon). */
export const MARKETPLACE_SOON: {
  id: string;
  name: string;
  role: string;
  productCapabilities: string[];
}[] = [
  { id: "tiktok", name: "TikTok", role: "Publishing", productCapabilities: ["TikTok Publishing", "Short video"] },
  { id: "pinterest", name: "Pinterest", role: "Publishing", productCapabilities: ["Pins", "Idea pins"] },
  { id: "quickbooks", name: "QuickBooks", role: "Accounting", productCapabilities: ["Invoices", "Expenses", "Taxes"] },
  { id: "zoom", name: "Zoom", role: "Meetings", productCapabilities: ["Video meetings", "Scheduling"] },
  { id: "google", name: "Google", role: "Workspace", productCapabilities: ["Calendar", "Drive", "Business Profile"] },
];

export function requireConnectedAppEnv(
  providerId: string,
  keys: string[],
): string[] {
  return keys.filter((k) => !envTruthy(k));
}
