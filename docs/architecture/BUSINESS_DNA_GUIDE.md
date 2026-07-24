# Business DNA Guide

**Version:** 1.0.0  
**Purpose:** How Hubly learns *what kind of business* this is — without mixing facts and interpretation.

## Rule

**Business Memory is factual. Business DNA is interpretive. Never combine them.**

DNA teaches Hubly how an industry operates (psychology, trust, pricing patterns, homepage order, seasonality) with evidence metadata.

## Add a new industry

No application code changes required:

```ts
import { HublyPlatform } from "./hubly_brain_platform.ts";
// or registerDnaIndustryPack from hubly_brain_dna_knowledge.ts

HublyPlatform.registerIndustry("pool cleaning", poolCleaningPack);
```

Brain’s `loadBusinessDnaKnowledge({ industry: "pool cleaning" })` will load the registered pack.

Built-in example: pressure washing pack. Generic fallback exists for unknown industries.

## Update Business DNA

1. Edit pack fields (psychology, website intelligence, evidence[], etc.)  
2. Bump `knowledgeVersion`  
3. Re-register pack (same industry key)  
4. Run multi-industry validation (Section 16) — fingerprints must remain distinct across industries  

## Version Business DNA

| Field | Role |
|-------|------|
| `schemaVersion` | Pack schema compatibility |
| `knowledgeVersion` | Content revision |
| Evidence `lastReviewed` | Claim freshness |

Incompatible schema → reject at Platform validation / document in Feature Manifest `migrationRequirements`.

## Validate Business DNA

Every claim should carry:

- `source`  
- `confidence`  
- `lastReviewed`  
- `appliesTo` (industry / region / stage)  

Section 16 multi-industry suite proves pressure washing ≠ photography, lawn care ≠ HVAC.

## Add regional intelligence

Set `regionalIntelligence` on the pack:

- country / state / city  
- climate  
- regionalBuyingBehavior  
- localTerminology  

`loadBusinessDnaKnowledge` merges request/memory city/state into the pack when loading.

## Who reads / who writes

| Actor | DNA |
|-------|-----|
| Experts | Read only |
| Brain | Loads packs |
| Platform | Registers/unregisters industry packs |
| Community learning | Placeholder — automatic learning **not** implemented |

## Feature Manifest

Industry packs registered via Platform get `industry.*` manifests for Mission Control inventory.
