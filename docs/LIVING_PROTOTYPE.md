# Living Prototype — Customer Experience Source of Truth

**Purpose:** One interactive journey that always represents the current Hubly vision.  
**Rule:** If we ship experience improvements, this path must reflect them.

---

## The flow

```
Landing (hubly.app /)
  ↓ CTA / “Tell Hubly about your business”
Conversation (Create · Discovery) — ChatGPT feel + live studio
  ↓ website / booking / packages appear while talking
Reveal — “I built your business” + clickable surfaces
  ↓ Continue
Save (account if needed)
  ↓
Hubly Home (Operate · OS Dashboard)
  ↓
Website · CRM · Jobs · Revenue  (same OS, personalized content)
```

---

## How to walk it (founder)

1. Incognito → **hubly.app** (classic landing)  
2. Start a business (seed prompt) → **/signup** Create conversation  
3. Watch the **Live studio** (right side): website, booking, packages update as you talk  
4. Finish → Reveal: **I built your business**  
5. Continue → Operate Home (Dashboard)  
6. Open Website / Customers / Jobs — same OS nav  

---

## Visible surfaces (must stay honest)

| Step | Customer must see |
|------|-------------------|
| Discovery | Conversation + live website/booking/packages studio |
| Reveal | One celebration + clickable previews (not reports) |
| Home | Website hero + OS modules |

---

## Gate

```bash
npm run check:experience-first
```

Related: [`EXPERIENCE_FIRST.md`](./EXPERIENCE_FIRST.md) · [`HUBLY_OS.md`](./HUBLY_OS.md)
