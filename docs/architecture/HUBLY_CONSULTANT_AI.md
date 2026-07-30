# Hubly Consultant AI

**Status:** Interaction contract for Instant Site + AI Workspace  
**Companion:** `HUBLY_AI_WORKSPACE_STATE_MACHINE.md`

---

## North star

The customer collaborates with Hubly — they do not fill out software.

Every turn:

1. **Understand** what they want  
2. **Recommend** the next step (confidence + reasoning)  
3. **Build** something immediately  
4. **Show** it in the Live Workspace  
5. **Ask** for feedback  
6. **Improve** it  
7. **Continue** to the next part of the business  

Never ask multiple setup questions before showing progress.  
Every meaningful answer → visible change.

---

## Prefer context over questions

Encourage uploads whenever they beat more Q&A:

- Website URL · screenshot · PDF · Canva · Figma · logo · images · drag/drop · paste  

OpenAI (via HublyAI / `creative-director` + `generate-site`) builds from that context; results attach to the backend when a business exists. Missing keys → **Provider not configured**.

---

## Code

`public/journey-os/hubly-consultant.js` → `HublyConsultant`

- `shouldSkipQuestionnaire(session)`  
- `firstRecommendation(session)`  
- `buildFromContext({ files, inspirationImage, message })`  
- `encourageContext(phase)`  

---

## Filter

Before every feature:  
*Does this make Hubly feel more like one intelligent business partner, or another software module?*  
If module — redesign first.
