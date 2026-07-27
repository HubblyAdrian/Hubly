# 🔍 AI Research Engine — Architecture (required before Development)

**Milestone:** Hubly AI Business Builder  
**Module:** 3 — AI Research Engine  
**Rules:** #24 · #25 · #26 · research before build · never block the Builder  
**Inputs:** Module 2 outputs (Hubly Session · Business Profile · Owner Profile · Business DNA · imports · conversation)  
**Status:** 🔒 Architecture locked (Agency frozen) · Development after Module 2  
**Related:** [DISCOVERY_ARCHITECTURE.md](./DISCOVERY_ARCHITECTURE.md) · [HUBLY_MEMORY.md](../HUBLY_MEMORY.md) · [README.md](./README.md)

---

## Purpose

**Research the business before building it.**

This is where Hubly proves it is intelligent. The user should feel like they hired a team of researchers — not that they are waiting on a spinner.

By the end of Module 3, Hubly should know more about the business than the owner expected, and produce a **Research Profile** for Module 4 (Creative Director).

Almost **no user interaction** required. Parallel research. Live discovery timeline.

---

## Purpose statement

> Research the business before building it.

The AI gathers public signals, identifies patterns, and prepares everything the Creative Director needs. Trust is earned by **watching meaningful insights appear** — not by claiming “AI analyzed your business.”

---

## Inputs (from Module 2)

| Input | Notes |
|-------|-------|
| Hubly Session | Temporary Memory |
| Business Profile | Industry, services, location, pricing, brand, website |
| Owner Profile | Experience, goals, communication, growth, stage, risk, preferred customers |
| Business DNA | Combined ≥ 90% |
| Website / Instagram / Facebook / Google Business | Import analysis + URLs |
| Uploaded photos | If any |
| Conversation history | Landing + Discovery |

Owner Profile shapes **how** research is framed (e.g. recurring-revenue lens for steady-growth founders) without inventing fake market data.

---

## Experience principle — not a loading screen

Do **not** show:

> Analyzing…

Do show an **AI employee at work**:

- “Reading your Services page…”
- “Comparing your pricing to nearby businesses…”
- “Choosing your strongest gallery photos…”
- “Looking for recurring revenue opportunities…”
- “Reviewing customer feedback…”
- “Finding your competitive advantages…”

By Module 4, the user already trusts Hubly because they **watched** it discover insights.

---

## Screen layout

```
🔍 Researching Your Business
Shine Mobile Detailing
██████████░░░░░░░░   (20–60 seconds typical)

✓ Reading Website
✓ Understanding Services
✓ Analyzing Branding
⏳ Reading Reviews
⏳ Detecting Competitors
⏳ Building Pricing Model
⏳ Finding Local Market

Live Activity
  "Found 9 services"
  "Detected ceramic coatings"
  "Found 174 reviews"
  …
```

Background: subtle network / document motion (atmosphere, not noise). Prefer progress cards over abstract glow spam.

---

## AI tasks (parallel)

| # | Task | Reads | Extracts |
|---|------|-------|----------|
| 1 | Website Analysis | Home, services, about, contact, FAQ, gallery, booking | Brand voice, services, public pricing, CTAs, trust, offers, FAQ |
| 2 | Google Business | Rating, reviews, categories, hours, photos, keywords | Sentiment, mentioned services, strengths, weaknesses |
| 3 | Instagram | Bio, posts, captions, hashtags, engagement, before/after | Personality, visual style, themes, popular services |
| 4 | Facebook | About, services, reviews, photos | Page signals |
| 5 | Competitor Discovery | Local market search | Top competitors, avg pricing, common services, gaps |
| 6 | Market Analysis | Demand / seasonality signals | High-demand services, premium + membership opportunities |
| 7 | Brand Analysis | Visual + copy signals | Luxury / modern / friendly / premium / budget / professional scores + suggestions |
| 8 | Photo Analysis | Galleries + uploads | Quality, lighting, B&A effectiveness, hero + gallery order, missing shots |
| 9 | Service Discovery | All sources | Proposed catalog: Imported · AI Suggested · Missing Opportunity |
| 10 | Pricing Intelligence | Business vs market | Positioning delta (e.g. “~15% below comps for ceramic”) |

Stage 1 may use **local / cached / previously imported** signals plus deterministic heuristics where live vendor APIs are deferred (Stage 2). Partial research must still produce a Research Profile.

---

## Live timeline

Discoveries stream as they complete:

```
✓ Website analyzed
✓ Found 8 services
✓ Imported 32 gallery photos
✓ Identified premium brand style
✓ Found ceramic coating expertise
✓ Detected membership opportunity
✓ Recommended pricing adjustments
```

Membership / growth suggestions should respect **Owner Profile** when present.

---

## Confidence

Every finding includes confidence (e.g. Ceramic Coating 98% · Pricing 72% · Competitor Match 81%).

Low-confidence findings are flagged for review later — never silently treated as truth.

---

## User controls

Pause · Retry · Skip unavailable sources · Continue when complete

---

## Error handling

| Failure | Behavior |
|---------|----------|
| Website unavailable | Continue with other sources |
| Instagram private | Skip |
| Google Business missing | Continue |
| All sources fail | Still emit best-effort Research Profile from Module 2 DNA |

**Nothing should stop the Builder.**

---

## Caching / Session

- Results cached in **Hubly Session** (Temporary Memory)
- Zero duplicate analysis for the same URL + fingerprint in-session
- Survives refresh (resume timeline / show completed Research Profile)

---

## Outputs — Research Profile

**Canonical object.** Feeds Module 4 Creative Director (with Business Vision):

| Block | Contents |
|-------|----------|
| Market insights | Demand, seasonality, opportunities |
| Competitor insights | Comps, gaps |
| Brand insights | Scores + suggestions |
| Services | Imported / suggested / missing |
| Pricing intelligence | Positioning vs market |
| Content inventory | Pages, FAQ, offers, CTAs |
| Visual inventory | Photos, hero candidates, gaps |
| SEO observations | Keywords, categories |
| Confidence map | Per finding |
| Owner-aware notes | How Owner Profile shaped priorities |

---

## Must not

- Feel like a spinner / empty loading screen
- Block the Builder on a single source failure
- Re-run identical analysis in the same session
- Ignore Business Profile / Owner Profile from Module 2
- Redesign locked Landing or Discovery architecture
- Invent live vendor integrations in Stage 1 without labeling Stage 2
- Claim fabricated review counts or competitor data as verified when confidence is low

---

## Stage 1 vs Stage 2

| Stage 1 (OS) | Stage 2 |
|--------------|---------|
| Parallel task orchestration + live timeline UX | Deeper live Google / Instagram / Maps APIs |
| Website HTML analysis (extend `/api/import-analyze`) | Full crawler + sitemap walk |
| Heuristic competitor / market cards from known trade + location | Live SERP / Places enrichment |
| Research Profile in Hubly Session | Server-persisted research jobs |
