/**
 * Node binding for Section 16 — Validation & Quality Assurance.
 * Wires quality-core to existing Hubly Brain mirrors.
 */
import {
  HublyQuality,
  bindQualityDeps,
  SCENARIO_LIBRARY,
  FOUNDER_BENCHMARK_SUITE,
  BUSINESS_GENERATION_INDUSTRIES,
  QUALITY_VERSION,
  QUALITY_OWNER,
  getQualityManifest,
  getLastQualityReport,
  getQualityScoreSnapshot,
  clearQualityForTests,
  runAndStoreFullQualitySuite,
} from "./quality-core.mjs";

import { think } from "./think.mjs";
import {
  evaluateAgainstConstitution,
  applyHublyIdentity,
} from "./identity-system.mjs";
import {
  persistBusinessMemoryLocal,
  loadBusinessMemoryLocal,
  normalizeBusinessMemory,
} from "./business-memory.mjs";
import {
  persistWorkspaceMemoryLocal,
  loadWorkspaceMemoryLocal,
  normalizeWorkspaceMemory,
} from "./workspace-memory.mjs";
import {
  persistConversationIntelligenceLocal,
  loadConversationIntelligenceLocal,
  normalizeConversationIntelligence,
} from "./conversation-intelligence.mjs";
import { loadBusinessDnaKnowledge } from "./dna-knowledge.mjs";
import {
  whoOwnsCapability,
  planRegistryRoute,
  ensureRegistriesBootstrapped,
} from "./registries.mjs";
import { listExperts, runExpert } from "./expert-framework.mjs";
import { ensureExpertsRegistered } from "./initial-experts.mjs";
import {
  ownerSafeError,
  withTimeout,
  gracefulDegrade,
  assertMemoryIsolation,
  assertExpertPermission,
  listAuditLog,
  auditAiAction,
} from "./reliability.mjs";

let BOUND = false;

export function ensureQualityBound() {
  if (BOUND) return;
  ensureExpertsRegistered();
  ensureRegistriesBootstrapped();
  bindQualityDeps({
    think,
    evaluateAgainstConstitution,
    applyHublyIdentity,
    persistBusinessMemoryLocal,
    loadBusinessMemoryLocal,
    persistWorkspaceMemoryLocal,
    loadWorkspaceMemoryLocal,
    persistConversationIntelligenceLocal,
    loadConversationIntelligenceLocal,
    normalizeBusinessMemory,
    normalizeWorkspaceMemory,
    normalizeConversationIntelligence,
    loadBusinessDnaKnowledge,
    whoOwnsCapability,
    planRegistryRoute,
    listExperts,
    runExpert,
    ownerSafeError,
    withTimeout,
    gracefulDegrade,
    assertMemoryIsolation,
    assertExpertPermission,
    listAuditLog,
    auditAiAction,
  });
  BOUND = true;
}

export async function runQualityGate() {
  ensureQualityBound();
  return runAndStoreFullQualitySuite();
}

export {
  HublyQuality,
  SCENARIO_LIBRARY,
  FOUNDER_BENCHMARK_SUITE,
  BUSINESS_GENERATION_INDUSTRIES,
  QUALITY_VERSION,
  QUALITY_OWNER,
  getQualityManifest,
  getLastQualityReport,
  getQualityScoreSnapshot,
  clearQualityForTests,
  ensureQualityBound as bindQuality,
};
