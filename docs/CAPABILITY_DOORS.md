# The doors — what we own and cannot use

**Measured 2026-09-14 by `scripts/measure-capability-doors.mjs`.** The brief has carried
*"212 built · 49 owner-reachable · 63 with no caller anywhere"* for days without anyone stating
it as a finding. This is that finding, and the door each capability is missing.

**The spec's shape for every capability is three doors: talk to me · do it yourself · I can show
you where.** Four capabilities turned out on 2026-09-13 to have only the middle one. **They were
a sample of seventeen.**

## The headline

| | count | of 212 |
|---|---|---|
| **talk to me** — a registry action handler calls it, so the model can invoke it | **8** | 4% |
| **do it yourself** — the conversation function calls it outside a handler, so a client control reaches it | **20** | 9% |
| **both** | **3** | 1% |
| **I can show you where** | **0** | **no mechanism exists for any capability** |
| neither — called by another shared module (an internal step, not a capability) | 125 | 59% |
| **neither — called by NOTHING, anywhere** | **62** | **29%** |

**Only three capabilities in the entire product have two of the three doors:**
`applyOwnerDesignEdit`, `applyOwnerSectionMove` (as of yesterday), `applyOwnerStyleEdit`.

**Not one has the third.** "I can show you where" is item 2 of today's work order and it is
currently a promise in a script with nothing behind it anywhere in the codebase.

## The seventeen with only the middle door

The shape of 2026-09-13's four, and there are seventeen. A client control reaches these; **the
assistant cannot, and will decline correctly if asked**, because its list does not say it can.

| capability | reached by |
|---|---|
| `applyOwnerNodeDelete` · `applyOwnerNodeMove` | `nodeDelete` · `nodeMove` — **and cannot be wired to the model as they stand: they take a `NodeAddress` the model cannot construct (Lesson 49, unlit shape 6)** |
| `applyOwnerRecordEdit` | Edit details — contact, hours, services |
| `applyContactHoursToFreeform` · `applyDirectFreeformEdit` · `applyDirectDocumentPatch` | canvas click-to-edit |
| `uploadDraftLogo` · `uploadDraftPhoto` · `uploadDraftHeroImage` · `uploadAndPatchFreeformImage` · `uploadAndPatchDocumentImage` | a file the owner drops — **correctly model-unreachable; it cannot supply bytes** |
| `restampFreeformPage` | housekeeping on mount — internal |
| `applyExtractedFacts` | the extraction path — internal |
| `buildCapabilitiesPromptBlock` · `buildCapabilityKnowledgePromptBlock` · `buildOperationalStateBlock` · `createAdminClient` | prompt/infra plumbing — **false positives of the measure**, named rather than filtered so the denominator stays honest |

**Real owner capabilities with only one door: 8** — the two node operations, the record editor,
and the three canvas editors. The uploads are correctly one-door. The last four are not
capabilities at all.

## The 62 with no caller anywhere — split by whether an owner would ever want it

**51 are internal or platform, and correctly have no owner door.** Saying which is half the
value of this document.

| file | n | what it is |
|---|---|---|
| `mission_control.ts` | **18** | **our** admin dashboard — adoption, revenue, AI health, release health. Not an owner feature and must never become one |
| `hubly_brain_experience_layer.ts` | **11** | `buildGreeting`, `buildCelebration`, `buildWarning`, `buildEmptyState`… — a voice layer nothing calls. **Relevant to Part 2: check before writing new greeting composers** |
| `hubly_brain_certification.ts` | 3 | scorecards for us |
| `marketplace_ops/lite/document/booking_state` | 6 | the demand side, not built out |
| `hubly_brain_*` (chat_os, identity, preview, weekly_learning, conversation_intelligence, builder_expert) | 6 | brain scaffolding, unreferenced |
| helpers (`supabase_admin`, `booking_price`, `booking_notes`, `google_calendar_security`, `hubly_studio_business_context`, `hubly_operational_state`, `hubly_planner`) | 7 | pure functions and internal steps |

**`hubly_planner.buildHublyPlan` was checked specifically because Part 3 is My Day.** It is
**not** a day planner — it decides which Hubly *capabilities* a business needs. Not a seventh
Lesson-49 instance; checked before building, which is the point.

### The 11 an owner would plausibly want, and nothing reaches

| capability | what it would be for | why it has no door |
|---|---|---|
| `stripe.createAccountLink` · `createConnectLoginLink` | **Stripe Connect onboarding and dashboard access** | the capability is built; nothing in the owner shell opens it |
| `createJobFromBookingRequest` | a booking becomes a job | the path exists elsewhere; this one is unreferenced |
| `createBooking` (`booking_engine`) | the booking write | superseded by another path — **needs reading before anyone assumes it is the live one** |
| `syncGoogleCalendarForBusiness` · `syncEngineRun` · `syncEnginePushDelete` · `deleteGoogleEventsForBusiness` | Google Calendar two-way sync | **D-022 cut it deliberately until a business connects a calendar. 0 connections product-wide — correctly parked, not a missing door** |
| `buildCampaignPlan` · `createMarketingAsset` | marketing campaigns and assets | never given a surface |
| `sanitizeAppReturnUrl` | a helper misclassified by the verb regex | not a capability |

**So the honest count of built-and-wanted-and-unreachable is 5, not 62:** the two Stripe Connect
links, the two job/booking writers that need reading, and the marketing pair. The calendar four
are a ruled deferral with its condition already recorded.

## What this changes about the work order

1. **"Show me where" is not one capability's missing door — it is missing from all 212.** Build
   it as the mechanism it is, not as a feature of the hours flow.
2. **The three-door pattern has 3 members with two doors and none with three.** A pattern is
   worth building; it is not an abstraction over an existing population, it is the first
   instance of one.
3. **`hubly_brain_experience_layer`'s 11 voice builders must be read before Part 2 writes a
   greeting composer.** Eleven unreferenced functions named `buildGreeting`, `buildCelebration`,
   `buildEmptyState` sitting beside a task to write an arrival greeting is exactly the shape
   Lesson 49 exists for.

**Regenerate with `node scripts/measure-capability-doors.mjs`.** The numbers move as doors are
wired; the classification of the 62 is mine and is the part to argue with.
