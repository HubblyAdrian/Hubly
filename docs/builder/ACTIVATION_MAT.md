# 🚀 Business Activation — Module Acceptance Test (MAT)

**Module:** 6 — Business Activation  
**Architecture:** [ACTIVATION_ARCHITECTURE.md](./ACTIVATION_ARCHITECTURE.md)  
**Checklist:** [ACTIVATION_CHECKLIST.md](./ACTIVATION_CHECKLIST.md)  
**Gate:** MAT must pass before merge of Stage 1 Activation Development

---

## Connections

| # | Test | Result |
|---|------|--------|
| C1 | Stripe connect path (or Stage 1 soft-connect + honest later) | ⏳ |
| C2 | Calendar connect path | ⏳ |
| C3 | Domain connect / suggest path | ⏳ |
| C4 | Skip never permanently blocks Launch | ⏳ |

---

## Business

| # | Test | Result |
|---|------|--------|
| B1 | Hours saved | ⏳ |
| B2 | Travel area saved when mobile | ⏳ |
| B3 | Shop path skips travel | ⏳ |

---

## AI

| # | Test | Result |
|---|------|--------|
| A1 | Automations enable / customize / skip | ⏳ |
| A2 | Readiness score calculated | ⏳ |
| A3 | Why-language present on activation cards | ⏳ |

---

## Launch

| # | Test | Result |
|---|------|--------|
| L1 | Website publishes / goes live (Stage 1 definition) | ⏳ |
| L2 | Booking activates | ⏳ |
| L3 | Dashboard opens after Launch | ⏳ |
| L4 | Home loads correctly | ⏳ |
| L5 | Hard minimum enforced (name · ≥1 service · booking) | ⏳ |
| L6 | Optional gaps do not block Launch | ⏳ |

---

## Pipeline / framing

| # | Test | Result |
|---|------|--------|
| P1 | Entered only after Reveal (Blueprint → Review → Reveal) | ⏳ |
| P2 | Module named / framed Business Activation (not Setup) | ⏳ |
| P3 | Save My Business is account framing (not Create Account) | ⏳ |

---

## Validation

| # | Test | Result |
|---|------|--------|
| V1 | Console errors = 0 | ⏳ |
| V2 | Responsive = PASS | ⏳ |
| V3 | Accessibility = PASS | ⏳ |
| V4 | CMV locked modules PASS | ⏳ |
| V5 | Rules #26–#28 / architecture docs not altered by UI | ⏳ |

---

## Acceptance criteria

1. Feels like mission control preparing for launch — not an integrations form.  
2. Launch never blocked by optional connections.  
3. Launch transitions into Operate Home Dashboard.  
4. Design phase (Reveal) clearly complete before Activation.  
5. Why-language on every major activation step.

---

## Sign-off

| Role | Status |
|------|--------|
| Architecture approval | ⏳ |
| Self QA | ⏳ |
| MAT | ⏳ |
| CMV | ⏳ |
| Founder approval | ⏳ |
| Merge → Lock Module 6 Stage 1 OS | ⏳ |
