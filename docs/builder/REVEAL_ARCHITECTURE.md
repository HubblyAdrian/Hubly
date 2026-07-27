# ✨ Business Reveal — Architecture (required before Development)

**Milestone:** Hubly AI Business Builder  
**Module:** 5 — Business Reveal  
**Rules:** #24–#28 · narrate, don’t dump · Save My Business on first meaningful edit  
**Status:** Architecture gate — do not start Development without founder approval  
**Related:** [CREATIVE_DIRECTOR_ARCHITECTURE.md](./CREATIVE_DIRECTOR_ARCHITECTURE.md) · [CREATIVE_REVIEW.md](./CREATIVE_REVIEW.md) · [BUSINESS_VISION.md](./BUSINESS_VISION.md) · [README.md](./README.md)

---

## Purpose

The biggest emotional moment in the Builder.

Transition the user from:

> “I'm describing my business.”

to:

> “This is my business.”

Hubly is **not** presenting a website.  
It is presenting the business created from:

Business Profile · Owner Profile · Business DNA · Research Profile · Business Vision · Creative Blueprint · Creative Review

---

## Pipeline (locked)

```
Creative Director (Module 4)
  ↓  Creative Blueprint (canonical)
Creative Review (Rule #28)
  ↓  scores + summary
Business Reveal (Module 5)
  ↓  staged ceremony
Save My Business (mid-reveal on first edit · final CTA)
  ↓
Account → Permanent Memory → Operate OS
```

---

## Experience principle — product launch, not generate

Lights dim. Background softens. Subtle motion.

Hubly says:

> I'd like to present the business we've created together.

**Never:** “Generating website…” · “Done.”

Feel: Apple introducing a product — not a software wizard finishing a form.

---

## Pre-reveal

```
🎉 Congratulations
We've finished building the first version of your business.
Ready?
              [ Reveal ]
```

---

## Reveal stages

### Stage 1 — Brand Reveal
Name · positioning line · personality chips · palette · typography · logo direction · voice · tagline · mission  
Controls: Approve · Edit · Regenerate · Ask Why

### Stage 2 — Positioning
Target customer · market position · competitive advantage  
Controls: Change · Explain · Compare

### Stage 3 — Service Catalog
Services · packages · add-ons · memberships · pricing  
Cards tagged: Imported · AI Generated · Suggested · Confidence  
Controls: Edit · Delete · Add Service · Compare Pricing

### Stage 4 — Website Preview
Full site fades in — Desktop / Tablet / Mobile switch. Presentation first (no deep editor yet).  
Sections: Hero · Gallery · Services · Reviews · Booking · Memberships · FAQ · Footer  
Controls: Preview Live · Edit Website · Regenerate Section · Compare Layout

### Stage 5 — Booking Experience
Animated walkthrough: book → questions → availability → confirmation → emails → review request  
Controls: Preview Booking · Edit Questions · Edit Deposits

### Stage 6 — Marketing Foundation
Email templates · SMS style · campaign themes · referral · social voice

### Stage 7 — Growth Strategy
Opportunities with estimates (e.g. ceramic +$3,800/mo · membership +$1,200/mo · fleet after Month 6)  
Controls: Apply · Learn More · Skip  
Must align to **Business Vision** when present.

### Stage 8 — Creative Review (Rule #28)
Scores: Brand · Website · Trust · Conversion · SEO · Revenue Potential — each expandable (Why · Suggestions · Future)  
Director summary: confidence + honest improvement areas.

### Stage 9 — Your Business Is Ready
Checklist: Website · Booking · Services · Pricing · Brand · Marketing · AI Coach · CRM  

CTA:

**Save My Business →**

Not “Create Account.” Psychologically: protect what you built — don’t “sign up for software.”

---

## Save My Business — during the reveal (not only after)

Account creation should **not** interrupt the ceremony up front.

If the user is halfway through exploring and clicks **Edit Hero** (first meaningful edit), they have invested emotionally. Work must not be lost on tab close.

### Lightweight save prompt (on first edit)

> You're making your first edit. Let's save your business so you can keep building from any device.

Offer:

- Continue with Google  
- Continue with Apple  
- Continue with Microsoft  
- Email & Password  

On success: return **exactly** to the same reveal stage / edit context.  
Hubly Session → `upgradeToAccount` → Permanent Memory seed. Nothing recreated.

Final Stage 9 **Save My Business** remains for users who only browse without editing.

---

## AI behavior

- **Narrate** each stage — don’t dump walls of UI  
- Every recommendation includes **Ask Why** / explanation  
- Cite DNA / Research / Vision / Creative Review when relevant  
- Example: “I featured Ceramic Coating first because it has the highest revenue potential in your market — and your vision is premium Dallas.”

---

## User controls

Approve · Edit · Regenerate · Compare · Ask Why · Save · Back · Pause

---

## Outputs

| Output | Notes |
|--------|-------|
| Business Blueprint Approved | User-accepted staged reveals |
| Creative Blueprint Locked | Canonical Module 4 output accepted post-review |
| Creative Review Accepted | Scores presented; optional suggestions applied |
| Ready for Account / Upgraded | Save My Business complete |

---

## Must not

- Open with “Create Account” before emotional investment  
- Skip Creative Review stage  
- Feel like a website generator finish screen  
- Lose edit progress without save opportunity  
- Bypass canonical objects (Rules #26–#28)  
- Modify architecture in UI without reopening  

---

## Stage 1 vs Stage 2

| Stage 1 | Stage 2 |
|---------|---------|
| Staged reveal UI + previews from Creative Blueprint | Filmic motion / cinematic lighting |
| Device frame switches (desktop/tablet/mobile) | Live subdomain preview publish |
| Mid-reveal OAuth / email save prompt | Full SSO polish + device sync |
| Creative Review score cards | Continuous post-launch re-review |

---

## Workflow

Architecture → Development → QA → MAT → CMV → Approval → Merge → Lock  
Do not skip stages.
