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

export type ConnectedAppId =
  | "adobe_lightroom"
  | "capture_one"
  | "dropbox"
  | "google_drive"
  | "canva"
  | "frame_io"
  | "meta"
  | "google_business"
  | "stripe"
  | "twilio"
  | "other";

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

/** Catalog metadata for product UI (Connected Apps grid). */
export const CONNECTED_APP_CATALOG: {
  id: ConnectedAppId;
  name: string;
  role: string;
  capabilities: ConnectedAppCapability[];
}[] = [
  {
    id: "adobe_lightroom",
    name: "Adobe Lightroom",
    role: "Editing",
    capabilities: ["editing", "assets_import", "assets_export"],
  },
  {
    id: "canva",
    name: "Canva",
    role: "Creative",
    capabilities: ["creative", "templates", "publishing", "assets_import", "assets_export"],
  },
  {
    id: "frame_io",
    name: "Frame.io",
    role: "Review",
    capabilities: ["creative", "assets_import", "reviews"],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    role: "Storage",
    capabilities: ["storage", "assets_import", "assets_export"],
  },
  {
    id: "google_drive",
    name: "Google Drive",
    role: "Storage",
    capabilities: ["storage", "assets_import", "assets_export"],
  },
  {
    id: "meta",
    name: "Meta",
    role: "Publishing",
    capabilities: ["publishing", "messaging", "scheduling"],
  },
  {
    id: "google_business",
    name: "Google Business",
    role: "Local",
    capabilities: ["publishing", "reviews"],
  },
  {
    id: "capture_one",
    name: "Capture One",
    role: "Editing",
    capabilities: ["editing", "assets_import", "assets_export"],
  },
];

export function requireConnectedAppEnv(
  providerId: string,
  keys: string[],
): string[] {
  return keys.filter((k) => !envTruthy(k));
}
