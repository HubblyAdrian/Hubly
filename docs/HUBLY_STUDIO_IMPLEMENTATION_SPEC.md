# Hubly Studio — Implementation Spec

**Status:** V1.0 frozen — see `docs/HUBLY_STUDIO_V1_CONTRACT.md`  
**Success metric:** Mobile detailer generates a campaign, optionally customizes in Canva, publishes by email in under 5 minutes.

## Pipeline

Business Context → Campaign Engine → Recommendation Engine → Project Workspace → Canva (optional) → Publish (Email) → Analytics (counters)

## Screens

Home · AI Creator · Projects · Template Gallery · Brand Kit · Publish Center · Analytics · **Project Workspace** (replaces canvas editor)

Primary workspace CTA: **Customize in Canva**  
V1 publish channel: **Email** (Resend) — multi-provider interface ready for later

## Prompt template rule

`prompt_template` may only reference Campaign Brief schema fields. Never open-ended strategy.

## Deferred

Weather · competitors · local events · multi-industry expansion · performance recommendations · Learning Engine · revenue attribution · AI-chosen strategy

Iterate from real detailer usage — do not expand this spec further without field evidence.
