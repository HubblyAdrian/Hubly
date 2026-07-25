# AI Create — Connect Checklist

**North Star:** At no point does the customer feel like they're completing onboarding.  
Hubly chat = **ChatGPT, white-labeled as Hubly.**

Goal: A stranger goes from “I have an idea” to “Hubly built my business.”

Nothing is checked because code merged. Check only when the experience is true with **live OpenAI**.

---

## ⭐ North Star

- [ ] At no point does the customer feel like they're completing onboarding

If this box is unchecked, AI Create is not finished.

---

## 1. Landing — first 10 seconds

- [ ] I understand what Hubly does in under 5 seconds
- [ ] I know I can type naturally
- [ ] I believe AI is going to build my business
- [ ] There is only one obvious action: start talking

## 2. First Message

- [ ] **OpenAI** responds to my first message (`discoveryAiSource === "openai"`)
- [ ] The response feels exactly like ChatGPT
- [ ] Hubly understands what I mean
- [ ] Hubly immediately starts building

**Success:** “Okay… it's already working.”

## 3. Conversation

- [ ] Hubly asks only questions that change the business
- [ ] Hubly makes intelligent assumptions
- [ ] I can interrupt naturally
- [ ] I can change my mind
- [ ] Hubly remembers everything I've said
- [ ] Nothing feels scripted
- [ ] I forget I'm onboarding

**Success:** “This feels like talking to ChatGPT.”

## 4. Live Build

Every conversation creates visible progress:

- [ ] Website updates
- [ ] Booking updates
- [ ] Packages appear
- [ ] Branding improves
- [ ] Homepage changes
- [ ] Navigation changes
- [ ] About appears
- [ ] Reviews appear
- [ ] Contact appears

**Success:** “It's building while we're talking.”

## 5. AI Intelligence

- [ ] Understands industry
- [ ] Understands customer
- [ ] Right booking strategy
- [ ] Right homepage
- [ ] Right packages
- [ ] Explains major decisions naturally

**Success:** “It knows my business.”

## 6. Website Quality (before Reveal)

- [ ] I'd publish this homepage
- [ ] I'd publish these packages
- [ ] I'd publish this booking page
- [ ] I'd be proud to share this website

**Success:** “I don't need to redesign this.”

## 7. Reveal

- [ ] Beautiful transition
- [ ] Website clickable
- [ ] Booking clickable
- [ ] CRM ready (honest empty OK)
- [ ] Dashboard ready

**Success:** “Hubly built all of this.”

## 8. Enter Hubly

- [ ] Website is live
- [ ] Booking works
- [ ] CRM exists
- [ ] Dashboard feels complete
- [ ] I know what to do next

## 9. Industry Test

Each must feel unique (live OpenAI + unique packs):

- [ ] Lawn Care
- [ ] Mobile Detailing
- [ ] Photographer
- [ ] Airbnb Cleaning
- [ ] HVAC
- [ ] Personal Trainer
- [ ] Flight Instructor
- [ ] Pressure Washing
- [ ] Spa
- [ ] Dog Groomer

## 10. CEO Test

After Create, can I honestly say YES?

- [ ] Hubly understood my business
- [ ] The AI felt like ChatGPT
- [ ] I'd publish this website
- [ ] I'd send customers to this booking page
- [ ] I trust what Hubly built
- [ ] I immediately understand why Hubly is different
- [ ] I'd pay for this

---

## Technical Connect (must pass)

| Check | How |
|-------|-----|
| `OPENAI_API_KEY` on Supabase Edge | `hubly-ai-status` / secrets |
| Create sends `intent: "discovery"` | `isDiscoveryThinkTurn` → `hubly-brain` |
| OpenAI path used | `S._is.discoveryAiSource === "openai"` after first message |
| Fallback only if OpenAI down | Local tree / `source: "fallback"` — never pretend |

Gate script (static wiring): `npm run check:ai-create-connect`

---

## Done when

A stranger types “I'm an independent fitness trainer.” (or Airbnb cleaner / flight instructor) and finishes without help, then naturally says:

> “I can't believe that just built my business.”
