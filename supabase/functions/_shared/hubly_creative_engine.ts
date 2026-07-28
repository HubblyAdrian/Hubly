/**
 * Hubly Core — Creative Engine
 *
 * Platform creative system used by every industry (photography, detailing,
 * cleaning, landscaping, …). Not photography-only.
 *
 * Discovers Connected Apps that declare `creative` (or templates/publishing)
 * and routes design workflows through the provider interface — never by
 * hardcoding Canva / Adobe / Frame.io in the UI.
 *
 * Flow (target):
 *   Project assets + Business DNA/branding
 *     → Creative Engine.createMarketingAsset
 *     → Connected App (CanvaProvider, …)
 *     → export back into Hubly Project
 *     → schedule / publish / website
 */

import {
  getConnectedApp,
  listConnectedAppsByCapability,
  type ConnectedAppAction,
  type ConnectedAppProvider,
} from "./hubly_connected_apps.ts";
import { resolveProviderForCapability } from "./hubly_action_engine.ts";
import { ensureCanvaConnectedApp } from "./hubly_provider_canva.ts";
import {
  providerError,
  providerOk,
  type HublyProviderResult,
} from "./hubly_providers.ts";

export type CreativeAssetKind =
  | "instagram_carousel"
  | "facebook_post"
  | "story"
  | "flyer"
  | "gift_card"
  | "thank_you"
  | "before_after"
  | "other";

export type CreateMarketingAssetInput = {
  businessId: string;
  projectId?: string;
  /** Preferred provider; defaults to first creative Connected App (usually Canva). */
  providerId?: string;
  kind: CreativeAssetKind;
  title?: string;
  /** Brand tokens from Business Memory / DNA — never invent secrets. */
  brand?: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    contact?: string;
  };
  photoUrls?: string[];
  copy?: string;
  templateId?: string;
};

export type CreateMarketingAssetResult = {
  providerId: string;
  designId?: string;
  editUrl?: string;
  exportUrl?: string;
  kind: CreativeAssetKind;
  status: "planned" | "created" | "exported" | "not_configured";
};

export type CreativeEngineCatalogItem = {
  providerId: string;
  providerName: string;
  actions: ConnectedAppAction[];
  capabilities: string[];
};

function ensureCreativeProvidersRegistered(): void {
  ensureCanvaConnectedApp();
}

export function listCreativeProviders(): ConnectedAppProvider[] {
  ensureCreativeProvidersRegistered();
  const creative = listConnectedAppsByCapability("creative");
  const templates = listConnectedAppsByCapability("templates");
  const map = new Map<string, ConnectedAppProvider>();
  for (const p of [...creative, ...templates]) map.set(p.id, p);
  return Array.from(map.values());
}

export function creativeCatalog(): CreativeEngineCatalogItem[] {
  return listCreativeProviders().map((p) => ({
    providerId: p.id,
    providerName: p.name,
    actions: typeof p.actions === "function" ? p.actions() : [],
    capabilities: p.capabilities(),
  }));
}

/**
 * Create a marketing asset via a creative-capable Connected App.
 * Prefer capability resolution over hardcoded provider ids (AI never says “Use Canva”).
 * Fails honestly when no creative provider is configured.
 */
export async function createMarketingAsset(
  input: CreateMarketingAssetInput,
): Promise<HublyProviderResult<CreateMarketingAssetResult>> {
  ensureCreativeProvidersRegistered();
  const provider =
    (input.providerId ? getConnectedApp(input.providerId) : null) ||
    resolveProviderForCapability("creative") ||
    resolveProviderForCapability("templates");
  if (!provider) {
    return providerError(
      "creative_engine",
      "CAPABILITY_UNAVAILABLE",
      "Need: Marketing Graphics. Install a creative Connected App from the Apps Marketplace.",
      { retryable: false },
    );
  }
  if (!provider.capabilities().includes("creative") &&
    !provider.capabilities().includes("templates")) {
    return providerError(
      "creative_engine",
      "CAPABILITY_MISSING",
      `Need: Marketing Graphics. The selected app does not declare creative capabilities.`,
      { retryable: false },
    );
  }
  if (!provider.isConfigured()) {
    return providerOk(
      "creative_engine",
      {
        providerId: provider.id,
        kind: input.kind,
        status: "not_configured" as const,
      },
      "Need: Marketing Graphics. Connect a creative app to create designs. Hubly still stores the project plan.",
      { capability: "creative", providerRequired: true },
    );
  }

  // Vendor-specific create lives on the provider (CanvaProvider.createDesign, …)
  const creative = provider as ConnectedAppProvider & {
    createDesign?: (opts: Record<string, unknown>) => Promise<HublyProviderResult<{
      id: string;
      editUrl?: string;
      exportUrl?: string;
    }>>;
  };
  if (typeof creative.createDesign === "function") {
    const created = await creative.createDesign({
      businessId: input.businessId,
      projectId: input.projectId,
      title: input.title || input.kind,
      templateId: input.templateId,
      brand: input.brand,
      assetUrls: input.photoUrls,
      copy: input.copy,
    });
    if (!created.ok) {
      return created as HublyProviderResult<CreateMarketingAssetResult>;
    }
    return providerOk(
      "creative_engine",
      {
        providerId: provider.id,
        designId: created.data?.id,
        editUrl: created.data?.editUrl,
        exportUrl: created.data?.exportUrl,
        kind: input.kind,
        status: "created" as const,
      },
      "Marketing graphic created via Connected Apps.",
    );
  }

  return providerError(
    "creative_engine",
    "CREATE_NOT_SUPPORTED",
    "Need: Marketing Graphics. Connected creative app does not implement design creation yet.",
    { retryable: false },
  );
}

export const HublyCreativeEngine = {
  listProviders: listCreativeProviders,
  catalog: creativeCatalog,
  createMarketingAsset,
};
