# Mission Control Guide

**Version:** 1.0.0  
**Purpose:** Engineering headquarters for Hubly Brain — not a customer dashboard.

## Surfaces

| Surface | What you see |
|---------|----------------|
| Live AI Activity | Expert / Brain status |
| Expert Activity | Runs, success/failure, latency, confidence |
| Memory | Inspect notes for Business / Workspace / CI |
| Decision Graph | Keys/edges from recent reasoning |
| Builder Actions | Milestone 1.5 placeholder |
| Capability / Knowledge Registry | Installed tools & sources |
| Brain Timeline | Flight events |
| AI Health | ok rate, latency, provider status |
| Replay | Full request → response path |
| Performance / Cost / Reliability | Section 14 metrics |
| Trust Score | Engineering dependability score |
| Quality Score | Section 16 intelligence validation health |
| Platform Inventory | Feature Manifests |
| **Documentation** | Versioned architecture docs index (Section 17) |
| **Brain Certification** | Founder Acceptance scorecard + Milestone 1 certificate (Section 18) |

## Replay

`recordFlightRecorder` / `replayExecution(executionId)`:

request → memories → DNA → experts → reasoning → decisions → capabilities → knowledge → response → memory writes.

## Trust Score

Live engineering signal (not customer-facing): AI Reliability, Memory Integrity, Decision Quality, Performance, Expert Success, Provider Health.

## Quality Score

From Validation & Quality Assurance suite: Routing, Memory, Reasoning, Identity, Business DNA, Decision Engine, Capabilities, Builder Readiness.

Run: `npm run check:section16` (stores last report for Mission Control).

## Brain Timeline

Ordered flight events with `t` offsets for visualization.

## Health metrics

`aiHealth`: executions, okRate, avgLatencyMs, avgConfidence, errors, providerStatus (`ready` / `degraded`).

## Platform Inventory

`getPlatformInventory()` — manifests, builders, integrations, industries, UI extension points, health counts.

## Documentation index

`HublyDocs.catalog()` / snapshot `documentation` field lists all architecture guides + ADRs with versions and paths so engineers never hunt Slack for “where is the lifecycle doc?”.

## Code

`hubly_brain_mission_control.ts` · `hubly_brain_docs.ts`  
Prove: `npm run check:section12` · `npm run check:section17`
