# Coding Standards

**Version:** 1.0.0  
**Purpose:** Naming, boundaries, errors, logging, versioning, and testing expectations for Hubly Brain / Platform.

## Naming conventions

| Kind | Pattern | Example |
|------|---------|---------|
| Brain modules | `hubly_brain_<domain>.ts` | `hubly_brain_decision.ts` |
| Exports | `Hubly` + PascalCase API | `HublyMissionControl` |
| Expert ids | snake_case | `creative_director` |
| Capability ids | snake_case | `arrival_windows` |
| Feature Manifest ids | `kind.name` | `expert.seo_expert` |
| Check scripts | `check-sectionN-<slug>.mjs` | `check-section16-quality.mjs` |
| Proof JSON | `HUBLY_BRAIN_SECTIONN_PROOF.json` | |
| Branches | `cursor/<descriptive-name>-2662` | |

## Folder structure

```
supabase/functions/_shared/   ← Brain + platform runtime (Deno)
scripts/                      ← release gates + Node mirrors
scripts/lib/                  ← esbuild/hand mirrors of shared modules
docs/architecture/            ← system of record for DX
docs/adr/                     ← Architecture Decision Records
docs/HUBLY_BRAIN_SECTION*.md  ← per-section evidence prose
tests/hubly-brain.test.mjs    ← runs section gates
```

## Module boundaries

1. **Provider I/O** only inside `hubly_ai.ts` (and explicit provider adapters).  
2. **Experts** never import provider clients.  
3. **Memory commits** only through Brain memory APIs.  
4. **Owner-facing text** must pass Experience Director.  
5. **New modules** register — do not edit `think` expert lists.  
6. Node mirrors must share singletons (esbuild `external`) when state matters.

## Error handling

- Use `ownerSafeError` / Identity correction voice for anything owner-visible.  
- Never leak stacks, `.ts:line`, API keys, or provider names to owners.  
- Prefer graceful degrade + queue (Reliability) over hard failure.  
- Experts: `failureBehavior` `fallback_local` or `skip`; Brain continues.

## Logging

- Expert framework discovery log (`register` / `execute` / `retry`).  
- Platform logs (`validate` / `register` / `unregister`).  
- Mission Control flights for end-to-end paths.  
- Reliability audit log for security-sensitive actions.  
- Keep owner UI free of debug noise.

## Versioning

- Modules export `*_VERSION` constants.  
- Feature Manifests declare `minHublyBrainVersion`.  
- Docs index version bumps when architecture guides change.  
- ADRs are append-only; supersede with a new ADR, don’t rewrite history silently.

## Testing expectations

| Level | What |
|-------|------|
| Section gates | Behavioral proofs + proof JSON |
| `npm run milestone1` | All 18 sections |
| Section 16 | Intelligence validation + Scenario Library + Founder Benchmarks |
| New expert/capability | Register → discover → use → unregister without Brain edits |

**Do not** call a section “done” without automated verification.
