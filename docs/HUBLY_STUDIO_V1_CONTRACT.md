# Hubly Studio V1.0 — Implementation Contract (Frozen)

**Status:** Frozen · do not expand the spec — iterate from real detailer usage  
**Success metric:** A mobile detailer opens Studio, generates a complete campaign, optionally customizes in Canva, and publishes in under 5 minutes.

## Phase 1 pipeline

```
Business Context
      → Campaign Engine
      → Recommendation Engine
      → Project Workspace
      → Canva (optional editing)
      → Publish (single channel: Email)
      → Analytics (V1 counters only)
```

## Business Context

One reusable object — canonical Studio input. V1 consumer = Studio only.

Built from Hubly-owned data: business identity, services, jobs, reviews, photos, promotions, posting cadence, internal seasonal calendar. Memory (facts) and DNA (tone) stay labeled separately inside the object.

## Campaign Playbooks

Strategy definitions in DB (`campaign_playbooks`), not campaign instances.

## Campaign Brief

Campaign Engine output. AI Writer consumes this object only — it does not choose strategy.

```json
{
  "campaign": "Review Spotlight",
  "goal": "Build Trust",
  "channel": "email",
  "tone": "Premium",
  "offer": null,
  "business_name": "…",
  "service_name": "…",
  "assets": { "review": "…", "logo": "…", "photo": "…" },
  "cta": "…",
  "playbook_id": "…"
}
```

### Prompt template rule

`prompt_template` may only reference fields defined in the Campaign Brief schema  
(placeholders such as `{tone}`, `{offer}`, `{business_name}`, `{service_name}`, `{review_text}`).  
It must never contain open-ended strategic instructions (e.g. “come up with a marketing campaign”).  
Strategy is owned exclusively by the Campaign Engine.

## Recommendation Engine

Allowed: completed jobs, reviews, job photos, posting cadence, internal seasonal calendar, existing promotions, Business Context.  
Not allowed in V1: weather, competitors, local events, attribution, revenue predictions, external marketing intelligence.

## Project Workspace

Owns: Campaign Overview, Preview, Pages, Assets, Version History, Export History, Campaign Brief, AI Suggestions.  
Primary CTA: **Customize in Canva**.

## Publish (V1)

**Single channel: Email** (Resend) — fastest integration, no app review, campaign packages already include email copy.  
Interface is multi-provider-ready; Instagram / Facebook / Google Business / SMS / LinkedIn are deferred.

## Analytics (V1)

Campaigns Created · Campaigns Published · Posting Frequency.  
No reach / clicks / quotes / bookings / revenue attribution in V1.

## Explicitly deferred

Weather · competitor intel · local events · multi-industry knowledge expansion · performance-based recommendations · Learning Engine · revenue attribution · AI-generated campaign strategy.

## Definition of Done

Detailer can: open Studio → get a recommendation from Hubly data → generate from playbook → optional Canva → publish to Email → see project tracked in Studio.
