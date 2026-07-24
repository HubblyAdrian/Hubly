# Section 17 — Architecture Documentation & Developer Experience

**Status:** Pass (pending Founder Approval)  
**Release Gate:** Milestone 1 · Section 17 of 18

## Rename

Formerly “Documentation.” Hubly is a platform — docs must explain how the system **thinks** and how engineers extend it safely, not only where files live.

## Objective

Create the definitive engineering documentation so any future developer can understand, extend, and maintain Hubly without reverse-engineering the codebase or tribal knowledge.

## Deliverables

| Guide | Path |
|-------|------|
| System Architecture | `docs/architecture/SYSTEM_ARCHITECTURE.md` |
| AI Lifecycle | `docs/architecture/AI_LIFECYCLE.md` |
| Builder Engine Spec (1.5 prep) | `docs/architecture/BUILDER_ENGINE_SPEC.md` |
| Memory | `docs/architecture/MEMORY_GUIDE.md` |
| Expert Development | `docs/architecture/EXPERT_DEVELOPMENT.md` |
| Business DNA | `docs/architecture/BUSINESS_DNA_GUIDE.md` |
| Capabilities | `docs/architecture/CAPABILITY_GUIDE.md` |
| Mission Control | `docs/architecture/MISSION_CONTROL_GUIDE.md` |
| Coding Standards | `docs/architecture/CODING_STANDARDS.md` |
| Constitution (engineering) | `docs/architecture/CONSTITUTION_GUIDE.md` |
| Developer Onboarding | `docs/architecture/DEVELOPER_ONBOARDING.md` |

## Architecture Decision Records

`docs/adr/` preserves *why*:

1. Hubly Brain is the only AI entry point  
2. Business Memory ≠ Conversation Intelligence  
3. Experts cannot write memory directly  
4. Capabilities are registry-driven  
5. All AI passes through Experience Director  

## Versioned catalog

`supabase/functions/_shared/hubly_brain_docs.ts` (`HUBLY_DOCS_VERSION`)  
Mission Control snapshot field: `documentation`  
HublyAI export: `HublyDocs`

## Prove

```bash
npm run check:section17
```

## Stop rule

Do not start Section 18 until Founder Approval.
