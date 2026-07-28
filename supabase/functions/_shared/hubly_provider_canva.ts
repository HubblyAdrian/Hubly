/**
 * CanvaProvider — Connected App + Creative Engine vendor.
 *
 * First Creative Engine provider. Not a standalone integration —
 * registers through Connected Apps and declares creative capabilities.
 *
 * Production-First: returns Provider not configured until Canva OAuth secrets exist.
 * NEVER simulate successful Canva API calls.
 */

import {
  envTruthy,
  providerError,
  providerNotConfigured,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";
import {
  registerConnectedApp,
  type ConnectedAppAction,
  type ConnectedAppCapability,
  type ConnectedAppHealth,
  type ConnectedAppPermission,
  type ConnectedAppProvider,
  type ConnectedAppStatus,
} from "./hubly_connected_apps.ts";

export type CanvaDesign = {
  id: string;
  title: string;
  editUrl?: string;
  thumbnailUrl?: string;
  exportUrl?: string;
};

export type CanvaTemplate = {
  id: string;
  title: string;
  kind: string;
};

const MISSING = ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET"] as const;

export class CanvaProvider implements ConnectedAppProvider {
  readonly id = "canva" as const;
  readonly name = "Canva";

  missingEnv(): string[] {
    return MISSING.filter((k) => !envTruthy(k));
  }

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  private notReady<T = never>(): HublyProviderResult<T> {
    return providerNotConfigured(this.id, this.missingEnv()) as HublyProviderResult<T>;
  }

  permissions(): ConnectedAppPermission[] {
    return [
      { id: "design:read", label: "Read designs", required: true },
      { id: "design:write", label: "Create and edit designs", required: true },
      { id: "asset:read", label: "Import assets", required: true },
      { id: "asset:write", label: "Export assets", required: true },
    ];
  }

  capabilities(): ConnectedAppCapability[] {
    return [
      "creative",
      "templates",
      "publishing",
      "assets_import",
      "assets_export",
    ];
  }

  actions(): ConnectedAppAction[] {
    return [
      { id: "instagram_carousel", label: "Create Instagram Carousel", capability: "creative" },
      { id: "facebook_post", label: "Create Facebook Post", capability: "creative" },
      { id: "story", label: "Create Story", capability: "creative" },
      { id: "flyer", label: "Create Flyer", capability: "creative" },
      { id: "gift_card", label: "Create Gift Certificate", capability: "creative" },
      { id: "thank_you", label: "Create Thank You Card", capability: "creative" },
      { id: "before_after", label: "Create Before & After Graphic", capability: "creative" },
    ];
  }

  async connect(opts: {
    businessId: string;
    projectId?: string;
    returnTo?: string;
  }): Promise<HublyProviderResult<{ authorizeUrl?: string }>> {
    if (!this.isConfigured()) return this.notReady();
    void opts;
    // Future: Canva Connect OAuth →
    // https://{project}.supabase.co/functions/v1/canva-oauth-callback
    return providerError(
      this.id,
      "CANVA_OAUTH_NOT_IMPLEMENTED",
      "Canva OAuth is designed but not wired yet. Creative workflows still plan assets in Hubly.",
      { retryable: false },
    );
  }

  async disconnect(opts: {
    businessId: string;
    projectId?: string;
  }): Promise<HublyProviderResult<{ disconnected: true }>> {
    if (!this.isConfigured()) return this.notReady();
    void opts;
    return providerError(
      this.id,
      "CANVA_OAUTH_NOT_IMPLEMENTED",
      "Canva disconnect is not wired yet.",
      { retryable: false },
    );
  }

  async refreshToken(opts: {
    businessId: string;
  }): Promise<HublyProviderResult<{ expiresAt?: string }>> {
    if (!this.isConfigured()) return this.notReady();
    void opts;
    return providerError(
      this.id,
      "CANVA_OAUTH_NOT_IMPLEMENTED",
      "Canva token refresh is not wired yet.",
      { retryable: false },
    );
  }

  async sync(opts: {
    businessId: string;
    projectId?: string;
  }): Promise<HublyProviderResult<{ lastSyncAt: string }>> {
    if (!this.isConfigured()) return this.notReady();
    void opts;
    return providerError(
      this.id,
      "CANVA_API_NOT_IMPLEMENTED",
      "Canva sync is not wired yet.",
      { retryable: false },
    );
  }

  async status(_opts: {
    businessId: string;
    projectId?: string;
  }): Promise<HublyProviderResult<ConnectedAppStatus>> {
    if (!this.isConfigured()) {
      return providerOk(this.id, {
        connected: false,
        health: "not_configured",
        message: "Add CANVA_CLIENT_ID and CANVA_CLIENT_SECRET to connect Canva.",
      }, "Canva not configured");
    }
    return providerOk(this.id, {
      connected: false,
      health: "disconnected",
      message: "Canva is configured but not connected for this business yet.",
    }, "Canva disconnected");
  }

  async health(): Promise<HublyProviderResult<ConnectedAppHealth>> {
    if (!this.isConfigured()) {
      return providerOk(this.id, "not_configured" as const, "Canva not configured");
    }
    return providerOk(this.id, "disconnected" as const, "Canva ready for OAuth");
  }

  async webhook(_req: {
    headers: Record<string, string>;
    body: unknown;
  }): Promise<HublyProviderResult<{ handled: boolean }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "CANVA_WEBHOOK_NOT_IMPLEMENTED",
      "Canva webhooks are not wired yet.",
      { retryable: false },
    );
  }

  async listDesigns(_opts: {
    businessId: string;
  }): Promise<HublyProviderResult<CanvaDesign[]>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "CANVA_API_NOT_IMPLEMENTED",
      "List Canva designs is not wired yet.",
      { retryable: false },
    );
  }

  async createDesign(_opts: {
    businessId: string;
    projectId?: string;
    title: string;
    templateId?: string;
    brand?: Record<string, unknown>;
    assetUrls?: string[];
    copy?: string;
  }): Promise<HublyProviderResult<CanvaDesign>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "CANVA_API_NOT_IMPLEMENTED",
      "Create Canva design is not wired yet.",
      { retryable: false },
    );
  }

  async importPhotos(_opts: {
    businessId: string;
    projectId?: string;
    fileRefs: string[];
  }): Promise<HublyProviderResult<{ imported: number }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "CANVA_API_NOT_IMPLEMENTED",
      "Import photos to Canva is not wired yet.",
      { retryable: false },
    );
  }

  async exportDesign(_opts: {
    businessId: string;
    designId: string;
    format?: "png" | "jpg" | "pdf" | "mp4";
  }): Promise<HublyProviderResult<{ exportUrl?: string }>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "CANVA_API_NOT_IMPLEMENTED",
      "Export Canva design is not wired yet.",
      { retryable: false },
    );
  }

  async listTemplates(_opts?: {
    kind?: string;
  }): Promise<HublyProviderResult<CanvaTemplate[]>> {
    if (!this.isConfigured()) return this.notReady();
    return providerError(
      this.id,
      "CANVA_API_NOT_IMPLEMENTED",
      "Browse Canva templates is not wired yet.",
      { retryable: false },
    );
  }
}

let _canva: CanvaProvider | null = null;

export function getCanvaProvider(): CanvaProvider {
  if (!_canva) {
    _canva = new CanvaProvider();
    registerConnectedApp(_canva);
  }
  return _canva;
}

/** Ensure Canva is registered in the Connected Apps engine. */
export function ensureCanvaConnectedApp(): CanvaProvider {
  return getCanvaProvider();
}
