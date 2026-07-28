/**
 * Project-scoped Connected Apps links (internal: workspaces).
 *
 * Product language: Connected Apps (“Connect Dropbox”).
 * Table: photography_project_workspaces (and future generic project_connections).
 *
 * Hubly Core owns the Connected Apps engine; Projects attach providers.
 * Reusable across industries — photography is the first consumer, not the owner.
 */

import type { HublyProviderResult } from "./hubly_providers.ts";
import type { ConnectedAppId } from "./hubly_connected_apps.ts";

/** @deprecated Prefer ConnectedAppId — kept for existing workspace rows. */
export type ProjectWorkspaceProvider = ConnectedAppId | "other";

export type ProjectWorkspaceSyncState =
  | "unlinked"
  | "pending"
  | "linked"
  | "syncing"
  | "synced"
  | "error";

export type ProjectWorkspace = {
  id: string;
  projectId: string;
  businessId: string;
  provider: ProjectWorkspaceProvider;
  externalId?: string | null;
  displayName?: string | null;
  syncState: ProjectWorkspaceSyncState;
  lastSyncAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ProjectWorkspaceUpsert = {
  projectId: string;
  businessId: string;
  provider: ProjectWorkspaceProvider;
  externalId?: string | null;
  displayName?: string | null;
  syncState?: ProjectWorkspaceSyncState;
  lastSyncAt?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * @deprecated Prefer ConnectedAppProvider from hubly_connected_apps.ts.
 * Kept so Adobe Lightroom workspace helpers keep compiling during cutover.
 */
export interface ExternalWorkspaceProvider {
  readonly id: ProjectWorkspaceProvider;
  isConfigured(): boolean;
  missingEnv(): string[];
  connectWorkspace(opts: {
    businessId: string;
    projectId: string;
    returnTo?: string;
  }): Promise<HublyProviderResult<{ authorizeUrl?: string; workspace?: ProjectWorkspace }>>;
  disconnectWorkspace(opts: {
    businessId: string;
    projectId: string;
    workspaceId?: string;
  }): Promise<HublyProviderResult<{ disconnected: true }>>;
  syncWorkspace(opts: {
    businessId: string;
    projectId: string;
    workspaceId?: string;
  }): Promise<HublyProviderResult<ProjectWorkspace>>;
}

/** Product catalog for Connected Apps UI (project scope). */
export const PROJECT_WORKSPACE_PROVIDERS: {
  id: ProjectWorkspaceProvider;
  label: string;
  role: string;
}[] = [
  { id: "adobe_lightroom", label: "Adobe Lightroom", role: "Editing" },
  { id: "canva", label: "Canva", role: "Creative" },
  { id: "frame_io", label: "Frame.io", role: "Review" },
  { id: "dropbox", label: "Dropbox", role: "Storage" },
  { id: "google_drive", label: "Google Drive", role: "Storage" },
  { id: "capture_one", label: "Capture One", role: "Editing" },
  { id: "meta", label: "Meta", role: "Publishing" },
  { id: "google_business", label: "Google Business", role: "Local" },
];
