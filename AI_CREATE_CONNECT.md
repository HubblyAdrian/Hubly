# AI Create — Connect Checklist

**North Star:** At no point does the customer feel like they're completing onboarding.  
Hubly chat = **ChatGPT, white-labeled as Hubly.**

Goal: A stranger goes from “I have an idea” to “Hubly built my business.”

Nothing is checked because code merged. Check only when the experience is true with **live OpenAI**.

**Live Edge (2026-07-25):** `hubly-brain` discovery → `aiSource: openai` / `gpt-5.5` (**PASS** on project `rtwxxkxpkqdrhclkozma`).

---

## Engineering status (Cursor)

Status key: **DONE** wiring + live path proven · **PARTIAL** works but not DoD · **MISSING** not shipped

### 1. AI Conversation

| Item | Status | Notes |
|------|--------|-------|
| First message always goes through OpenAI | **DONE** | `intent: discovery` → Brain; live `aiSource=openai` |
| Remove scripted onboarding flow | **PARTIAL** | Chat is OpenAI + silent; studio still uses pack choreography |
| AI maintains conversation context | **DONE** | History + facts on each discovery turn |
| AI can change direction naturally | **DONE** | Prompt + follow-up studio apply |
| AI asks only when information changes the output | **DONE** | System prompt enforced |
| AI makes intelligent assumptions | **DONE** | Prompt + fallback assumptions |
| AI responses stream naturally | **MISSING** | Full JSON turn then reply (next big ChatGPT-feel win) |
| Graceful fallback if OpenAI is unavailable | **DONE** | Local discovery + honest `source: fallback` |

### 2. Live Business Creation

| Item | Status | Notes |
|------|--------|-------|
| Website updates live | **DONE** | Live studio + Apply to business |
| Booking page updates live | **DONE** | Booking chips / wizard seeded |
| Packages update live | **DONE** | Pack chips → `S.services` |
| Branding updates live | **DONE** | Logo / brand pulse |
| Navigation updates live | **PARTIAL** | Section chips; full nav rewrite still light |
| Homepage updates live | **DONE** | Hero rewrite during Create |
| About page updates live | **PARTIAL** | About seeded on apply; live pulse improved |
| Services update live | **DONE** | Packages / services section |

### 3. Business Understanding

| Item | Status | Notes |
|------|--------|-------|
| Business type | **DONE** | `industry` / `industryId` |
| Target customer | **DONE** | `facts.customer` |
| Brand voice | **PARTIAL** | `brandVoice` in discovery schema; maps via positioning |
| Website style | **PARTIAL** | `visualStyle` in schema; theme still pack-led |
| Booking strategy | **PARTIAL** | `bookingStrategy` fact → booking blurb |
| Package structure | **DONE** | Industry packs + AI facts |
| Primary call-to-action | **DONE** | Book now / consult elevation |

### 4. Website Generation

| Item | Status | Notes |
|------|--------|-------|
| Homepage | **DONE** | |
| About page | **PARTIAL** | `ownerBio` / about text seeded per trade |
| Services page | **DONE** | |
| Contact page | **PARTIAL** | Contact blurb seeded; phone/email still owner |
| Booking page | **DONE** | |
| Navigation | **DONE** | Storefront template |
| Footer | **DONE** | |

### 5. Booking Generation

| Item | Status | Notes |
|------|--------|-------|
| Correct booking flow | **DONE** | Blueprint-driven |
| Correct services | **DONE** | |
| Correct packages | **DONE** | Trade-specific meta |
| Correct durations | **DONE** | |
| Appropriate add-ons | **DONE** | Seeded from blueprint `defaultAddons` on Create apply |
| Payment configuration | **PARTIAL** | Trade default later/deposit; Stripe Connect still owner setup |

### 6. Reveal

| Item | Status | Notes |
|------|--------|-------|
| Website preview | **DONE** | |
| Booking preview | **DONE** | |
| Packages preview | **DONE** | |
| CRM preview | **DONE** | Honest empty OK |
| "Enter Hubly" transition | **DONE** | |

### 7. Hubly Home

| Item | Status | Notes |
|------|--------|-------|
| Website exists | **DONE** | |
| Booking exists | **DONE** | |
| CRM is configured | **DONE** | Ready empty pipeline |
| Dashboard is populated | **DONE** | Create-ready home |
| No empty placeholder states | **PARTIAL** | Honest CRM OK; avoid “still generating” when services exist |

### 8. Industry Personalization

| Trade | Status | Notes |
|-------|--------|-------|
| Mobile Detailer | **DONE** | Unique pack + blueprint |
| Photographer | **DONE** | |
| Fitness Trainer | **DONE** | Dedicated `fitness` blueprint (no longer spa alias) |
| Airbnb Cleaner | **DONE** | cleaning pack |
| HVAC | **DONE** | |
| Lawn Care | **DONE** | |
| Pressure Washing | **DONE** | |
| Spa | **DONE** | |
| Dog Groomer | **DONE** | Dedicated `dog_grooming` blueprint |
| Flight Instructor | **DONE** | Dedicated `flight_instruction` blueprint |

### 9. General Polish

| Item | Status | Notes |
|------|--------|-------|
| Smooth transitions | **DONE** | |
| No unnecessary loading screens | **PARTIAL** | Full-wait until streaming ships |
| No dead ends | **DONE** | |
| Mobile responsive | **DONE** | |
| Error handling | **DONE** | |
| Recovery from failed AI responses | **DONE** | Fallback discovery |

---

## Experience checklist (human / live OpenAI)

### ⭐ North Star

- [ ] At no point does the customer feel like they're completing onboarding

### 1. Landing — first 10 seconds

- [ ] I understand what Hubly does in under 5 seconds
- [ ] I know I can type naturally
- [ ] I believe AI is going to build my business
- [ ] There is only one obvious action: start talking

### 2. First Message

- [ ] **OpenAI** responds to my first message (`discoveryAiSource === "openai"`)
- [ ] The response feels exactly like ChatGPT
- [ ] Hubly understands what I mean
- [ ] Hubly immediately starts building

### 3. Conversation

- [ ] Hubly asks only questions that change the business
- [ ] Hubly makes intelligent assumptions
- [ ] I can interrupt naturally
- [ ] I can change my mind
- [ ] Hubly remembers everything I've said
- [ ] Nothing feels scripted
- [ ] I forget I'm onboarding

### 4–10

See prior sections — website quality, Reveal, Enter Hubly, industry uniqueness, CEO test. Still **unchecked until stranger sessions**.

---

## Technical Connect (must pass)

| Check | How | Live |
|-------|-----|------|
| `OPENAI_API_KEY` on Edge | `hubly-ai-status` | ✓ configured |
| Create sends `intent: "discovery"` | `isDiscoveryThinkTurn` | ✓ |
| OpenAI path used | `discoveryAiSource === "openai"` | ✓ Edge smoke PASS |
| Fallback only if OpenAI down | `source: "fallback"` | ✓ |
| Dedicated blueprints (fitness / flight / dog) | registry + files | ✓ |

Gate script (static wiring): `npm run check:ai-create-connect`  
Deploy Brain: `./scripts/deploy-hubly-brain.sh`

---

## Definition of Done

Cursor can check off AI Create only when:

1. A complete business is generated from one conversation.
2. Every generated asset is functional (website, booking, packages, CRM).
3. No scripted onboarding remains.
4. AI Create works across supported industries.
5. The Create flow ends in a ready-to-use Hubly workspace.

**Current gap to DoD:** streaming replies, fully AI-driven studio (less pack theater), stranger validation sessions (`GATE_1_VALIDATION.md`).

### Create UX fixes (2026-07-25)

- No auto-jump to Reveal — **Keep talking** is primary; “Show me what you built” is opt-in
- Live build paced slower so owners can type
- Fitness / flight / dog groomer use **real trade media** (not spa stock)
- Full-site preview scrollable; **Preview & edit** before Enter Hubly Home
- Home no longer duplicates the website card when the link is already on top
- **View website** opens the real scrollable site (not the left studio card)
- **Enter Hubly Home** is high-contrast (white button)
- OpenAI Creative Director designs layout/accent/copy on Create — not Soft Aurora by default
- Create stays in **chat**: Keep talking focuses the composer and replies in-thread (never a dead chip)
- Ready state is **chat-first** (compact strip + open chips) — no takeover wall without Back
- Left studio is a **smaller proof rail**; conversation is the main column
- Left cards open **real Website / Booking / Packages** (customer layout + Edit packages)
- From those surfaces, **← Back to chat** returns to Create (not a dead-end into Home/editor)

---

## Next implementation order

1. Stream discovery replies (ChatGPT feel)
2. Drive live studio from `buildingActions` / fact deltas; retire scripted stages when `aiSource==="openai"`
3. Deeper editor-first Create (closer to Website Editor mock) without rushing into Home
4. CEO `/demo` pass + log sessions
