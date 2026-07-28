/**
 * Bootstrap: register built-in Connected Apps into the registry.
 * Intent / Planner / Creative call this — never import vendors from UI.
 */

import { ensureCanvaConnectedApp } from "./hubly_provider_canva.ts";
import { getAdobeLightroomService } from "./hubly_provider_lightroom.ts";

let _done = false;

export function ensureHublyConnectedAppsRegistered(): void {
  if (_done) return;
  ensureCanvaConnectedApp();
  getAdobeLightroomService();
  _done = true;
}

/** Test-only — allow re-bootstrap after clearConnectedAppRegistryForTests. */
export function resetConnectedAppsBootstrapForTests(): void {
  _done = false;
}
