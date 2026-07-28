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
import catalogPack from "./connected_apps_catalog.json" with { type: "json" };

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
  installable?: boolean;
  soon?: boolean;
  actions?: ConnectedAppAction[];
};

type CatalogPack = {
  version: number;
  defaultInstalled: string[];
  marketingKinds: { id: string; label: string; capability: string }[];
  apps: ConnectedAppCatalogEntry[];
};

const pack = catalogPack as CatalogPack;

/** SSOT loaded from hubly-core/connected-apps-catalog.json (synced). */
export const CONNECTED_APP_CATALOG: ConnectedAppCatalogEntry[] = (pack.apps || []).map((a) => ({
  ...a,
  marketplaceAvailable: a.installable !== false && !a.soon ? true : a.marketplaceAvailable,
}));

export const CONNECTED_APP_DEFAULT_INSTALLED: string[] = pack.defaultInstalled || [];

export const CONNECTED_APP_MARKETING_KINDS = pack.marketingKinds || [];

/** @deprecated Prefer CONNECTED_APP_CATALOG filtered by soon — kept for callers. */
export const MARKETPLACE_SOON = CONNECTED_APP_CATALOG
  .filter((a) => a.soon || a.installable === false)
  .map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    productCapabilities: a.productCapabilities,
  }));

export function requireConnectedAppEnv(
  providerId: string,
  keys: string[],
): string[] {
  return keys.filter((k) => !envTruthy(k));
}
