/**
 * Section 18 — Founder Acceptance & Brain Certification
 *
 * Graduation scorecard for Hubly Brain Milestone 1.
 * Scenarios are executed by the release-gate harness; this module owns
 * the versioned scorecard, last certificate snapshot, and Mission Control surface.
 */

export const CERTIFICATION_VERSION = "1.0.0";
export const CERTIFICATION_OWNER = "hubly_brain" as const;
export const MILESTONE1_BRAIN_VERSION = "1.0";

export type CertificationDimensionId =
  | "thinking"
  | "memory"
  | "reasoning"
  | "identity"
  | "decisionMaking"
  | "capabilityDiscovery"
  | "missionControl"
  | "reliability"
  | "businessKnowledge";

export type CertificationDimension = {
  id: CertificationDimensionId;
  label: string;
  score: number; // 0–100
  passed: boolean;
  detail: string;
};

export type FounderScenarioResult = {
  id: string;
  title: string;
  request: string;
  passed: boolean;
  checks: string[];
  failures: string[];
};

export type BrainCertificationScorecard = {
  version: typeof CERTIFICATION_VERSION;
  overall: number;
  dimensions: Record<CertificationDimensionId, CertificationDimension>;
  scenariosPassed: number;
  scenariosTotal: number;
  founderBenchmarksOk: boolean;
  validationSuitesOk: boolean;
  documentationOk: boolean;
  certified: boolean;
  checkedAt: string;
};

export type Milestone1Certificate = {
  title: "Milestone 1 Completion Certificate";
  product: "Hubly Brain";
  version: typeof MILESTONE1_BRAIN_VERSION;
  status: "Certified" | "Not Certified";
  date: string;
  release: "Milestone 1";
  pr: string;
  validationSuite: string;
  founderApproval: string;
  nextMilestone: "1.5 — Builder Engine";
  certificationScore: number;
  scorecardPath: string;
  certificatePath: string;
};

export type BrainCertificationSnapshot = {
  version: typeof CERTIFICATION_VERSION;
  owner: typeof CERTIFICATION_OWNER;
  scorecard: BrainCertificationScorecard | null;
  certificate: Milestone1Certificate | null;
  scenarioCount: number;
  lastCheckedAt: string | null;
};

const DIMENSION_META: Record<
  CertificationDimensionId,
  { label: string }
> = {
  thinking: { label: "Thinking" },
  memory: { label: "Memory" },
  reasoning: { label: "Reasoning" },
  identity: { label: "Identity" },
  decisionMaking: { label: "Decision Making" },
  capabilityDiscovery: { label: "Capability Discovery" },
  missionControl: { label: "Mission Control" },
  reliability: { label: "Reliability" },
  businessKnowledge: { label: "Business Knowledge" },
};

let lastScorecard: BrainCertificationScorecard | null = null;
let lastCertificate: Milestone1Certificate | null = null;
let lastScenarioCount = 0;

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Build a dimension score from pass ratio. */
export function scoreDimension(
  id: CertificationDimensionId,
  passed: number,
  total: number,
  detail = "",
): CertificationDimension {
  const score = total <= 0 ? 0 : clampPct((passed / total) * 100);
  return {
    id,
    label: DIMENSION_META[id].label,
    score,
    passed: score >= 100,
    detail: detail || `${passed}/${total}`,
  };
}

export function buildCertificationScorecard(opts: {
  dimensions: Record<CertificationDimensionId, CertificationDimension>;
  scenariosPassed: number;
  scenariosTotal: number;
  founderBenchmarksOk: boolean;
  validationSuitesOk: boolean;
  documentationOk: boolean;
  checkedAt?: string;
}): BrainCertificationScorecard {
  const dims = opts.dimensions;
  const values = Object.values(dims).map((d) => d.score);
  const overall = values.length
    ? clampPct(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
  const certified =
    overall >= 100 &&
    opts.scenariosPassed === opts.scenariosTotal &&
    opts.scenariosTotal > 0 &&
    opts.founderBenchmarksOk &&
    opts.validationSuitesOk &&
    opts.documentationOk;

  return {
    version: CERTIFICATION_VERSION,
    overall,
    dimensions: dims,
    scenariosPassed: opts.scenariosPassed,
    scenariosTotal: opts.scenariosTotal,
    founderBenchmarksOk: opts.founderBenchmarksOk,
    validationSuitesOk: opts.validationSuitesOk,
    documentationOk: opts.documentationOk,
    certified,
    checkedAt: opts.checkedAt || new Date().toISOString(),
  };
}

export function buildMilestone1Certificate(opts: {
  scorecard: BrainCertificationScorecard;
  pr?: string;
  founderApproval?: string;
  date?: string;
}): Milestone1Certificate {
  const certified = opts.scorecard.certified;
  return {
    title: "Milestone 1 Completion Certificate",
    product: "Hubly Brain",
    version: MILESTONE1_BRAIN_VERSION,
    status: certified ? "Certified" : "Not Certified",
    date: opts.date || opts.scorecard.checkedAt.slice(0, 10),
    release: "Milestone 1",
    pr: opts.pr || "https://github.com/HubblyAdrian/Hubly/pull/196",
    validationSuite: "npm run milestone1 · npm run check:section16 · npm run check:section18",
    founderApproval: opts.founderApproval || (certified ? "Pending Founder Sign-Off" : "Not ready"),
    nextMilestone: "1.5 — Builder Engine",
    certificationScore: opts.scorecard.overall,
    scorecardPath: "docs/HUBLY_BRAIN_SECTION18_PROOF.json",
    certificatePath: "docs/releases/MILESTONE1_CERTIFIED.md",
  };
}

/** Persist last certification for Mission Control / HublyAI. */
export function recordBrainCertification(opts: {
  scorecard: BrainCertificationScorecard;
  certificate: Milestone1Certificate;
  scenarioCount: number;
}): void {
  lastScorecard = opts.scorecard;
  lastCertificate = opts.certificate;
  lastScenarioCount = opts.scenarioCount;
}

export function getBrainCertificationSnapshot(): BrainCertificationSnapshot {
  return {
    version: CERTIFICATION_VERSION,
    owner: CERTIFICATION_OWNER,
    scorecard: lastScorecard,
    certificate: lastCertificate,
    scenarioCount: lastScenarioCount,
    lastCheckedAt: lastScorecard?.checkedAt ?? null,
  };
}

export function clearCertificationForTests(): void {
  lastScorecard = null;
  lastCertificate = null;
  lastScenarioCount = 0;
}

/** Render founder-facing Markdown certificate. */
export function renderMilestone1CertificateMarkdown(
  cert: Milestone1Certificate,
  scorecard: BrainCertificationScorecard,
): string {
  const dimLines = Object.values(scorecard.dimensions)
    .map((d) => `| ${d.label} | ${d.score}% |`)
    .join("\n");

  return `# Milestone 1 Completion Certificate

## Hubly Brain

| Field | Value |
|-------|-------|
| **Product** | ${cert.product} |
| **Version** | ${cert.version} |
| **Status** | **${cert.status}** |
| **Date** | ${cert.date} |
| **Release** | ${cert.release} |
| **PR** | ${cert.pr} |
| **Validation Suite** | ${cert.validationSuite} |
| **Founder Approval** | ${cert.founderApproval} |
| **Next Milestone** | ${cert.nextMilestone} |
| **Certification Score** | ${cert.certificationScore}% |

## Hubly Brain Certification Scorecard

| Dimension | Score |
|-----------|------:|
| **Overall** | **${scorecard.overall}%** |
${dimLines}

## Scenarios

${scorecard.scenariosPassed}/${scorecard.scenariosTotal} founder acceptance scenarios passed.

- Founder Benchmark Suite: ${scorecard.founderBenchmarksOk ? "Pass" : "Fail"}
- Validation suites: ${scorecard.validationSuitesOk ? "Pass" : "Fail"}
- Documentation: ${scorecard.documentationOk ? "Pass" : "Fail"}

---

*This certificate is generated by Section 18 — Founder Acceptance & Brain Certification.*  
*Machine proof: \`${cert.scorecardPath}\`*
`;
}

export const HublyCertification = {
  version: CERTIFICATION_VERSION,
  owner: CERTIFICATION_OWNER,
  scoreDimension,
  buildScorecard: buildCertificationScorecard,
  buildCertificate: buildMilestone1Certificate,
  record: recordBrainCertification,
  snapshot: getBrainCertificationSnapshot,
  renderMarkdown: renderMilestone1CertificateMarkdown,
  clearForTests: clearCertificationForTests,
};
