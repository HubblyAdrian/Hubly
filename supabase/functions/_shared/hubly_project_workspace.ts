/**
 * ProjectWorkspace — provider-agnostic external workspace attached to a
 * Photography Project.
 *
 * Hubly Project is always primary. External systems (Adobe Lightroom,
 * Capture One, Dropbox, Google Drive, Canva, …) synchronize as workspaces.
 * A project may have one or more linked workspaces at the same time.
 */

import type { HublyProviderResult } from "./hubly_providers.ts";

export type ProjectWorkspaceProvider =
  | "adobe_lightroom"
  | "capture_one"
  | "dropbox"
  | "google_drive"
  | "canva"
  | "frame_io"
  | "other";

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
 * Capability-facing interface for attaching / syncing external workspaces.
 * Vendor providers (AdobeLightroomService, future DropboxService, …) implement this.
 */
export interface ExternalWorkspaceProvider {
  readonly id: ProjectWorkspaceProvider;
  isConfigured(): boolean;
  missingEnv(): string[];
  /** Start or resume a connection that yields an External Workspace link. */
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

export const PROJECT_WORKSPACE_PROVIDERS: {
  id: ProjectWorkspaceProvider;
  label: string;
  role: string;
}[] = [
  { id: "adobe_lightroom", label: "Adobe Lightroom", role: "Editing" },
  { id: "capture_one", label: "Capture One", role: "Editing" },
  { id: "dropbox", label: "Dropbox", role: "Files" },
  { id: "google_drive", label: "Google Drive", role: "Files" },
  { id: "canva", label: "Canva", role: "Design" },
  { id: "frame_io", label: "Frame.io", role: "Review" },
];
