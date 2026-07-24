# Memory Guide

**Version:** 1.0.0  
**Purpose:** How Hubly remembers — three systems, never one blob.

## Overview

| System | Answers | Owner |
|--------|---------|-------|
| **Business Memory** | What is true about the business? | Hubly Brain |
| **Workspace Memory** | How does this owner like to work? | Hubly Brain |
| **Conversation Intelligence** | What are we working on right now? | Hubly Brain |

Raw chat turns (if stored) are **not** Conversation Intelligence. See [ADR-0002](../adr/0002-memory-separation.md).

---

## Business Memory

### What it stores

Facts: name, industry, services, location, offers, brand surface fields, versions, changelog.

### Who can read

Experts (via Brain context), Decision/Reasoning, Mission Control inspectors.

### Who can update

**Hubly Brain only** commits. Experts may *suggest* patches; Brain merges with importance rules.

### Lifecycle

Create → normalize → suggest → Brain commit → version bump → changelog → query/retrieve.

### Versioning

`memoryVersion` increments on commit. History supports inspect/compare/restore patterns (Section 5).

### Retrieval

`queryBusinessMemory` / Brain load by `businessId`. Always isolated per business.

**Code:** `hubly_brain_memory.ts`

---

## Workspace Memory

### What it stores

Sidebar order, dashboard layout, hidden modules/tools, pinned actions, favorites, working style.

### Who can read

Brain, Workspace-aware experts (read-only), Mission Control.

### Who can update

Brain commits owner preference changes (e.g. “Move Jobs above Customers”).

### Lifecycle

Seed defaults → owner preference turns → Brain commit → persist local/remote.

### Versioning

Workspace `memoryVersion` + history entries.

### Retrieval

`queryWorkspaceMemory` for “what does my workspace look like?” style questions.

**Code:** `hubly_brain_workspace_memory.ts`

---

## Conversation Intelligence

### What it stores

Active goal/project/topic, threads, pending decisions, open questions, commitments, deferred ideas, emotional/ai context — **structured working memory**, not a transcript.

### Who can read

Brain, CI retrieval, Mission Control.

### Who can update

Brain applies CI turns after think. Experts do not write CI directly.

### Lifecycle

Normalize → apply turn → persist per businessId → query (“what are we working on?”).

### Versioning

`intelligenceVersion` + schema version.

### Retrieval

`queryConversationIntelligence` — never confuse with Business Memory facts.

**Code:** `hubly_brain_conversation_intelligence.ts`

---

## Isolation rules

1. Distinct `businessId` keys for all stores  
2. Never copy CI into Business Memory or vice versa  
3. Reliability caches keyed by businessId  
4. Security suite (Section 16) proves isolation  

## Extension tips

- Need new **facts** → Business Memory fields + Brain commit path  
- Need new **UI prefs** → Workspace Memory paths  
- Need new **engagement state** → CI fields (not chat logs)  
