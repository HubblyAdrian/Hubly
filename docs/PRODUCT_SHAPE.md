# Product shape — decisions of record

A record of product direction Adrian and Claude settled in conversation on 2026-08-29.
**This is not a build order.** None of it exists in the repo yet; it is written down so
the next builds share one picture. Where a thing is decided, it is stated as direction;
where it is unknown, it is marked unknown rather than resolved. It pairs with the
read-only surveys `docs/SHELL_TERRAIN.md` (what exists today) and
`docs/BOOKING_DESTINATION.md` (where a booking actually goes).

---

## 1. Three entitlements, not three products

An account carries **flags**, not a type: **Marketplace provider**, **Hubly website**,
**Storefront**. One account can hold more than one. There is **no universal left-rail
tab** — the rail renders **per entitlement**. The Website Editor is universal *only for
accounts that have a site*; a marketplace-only provider has no website and therefore no
Website Editor. (Corrects the earlier note that treated the Website Editor as the one
shell tab everyone gets — see `docs/OPEN_FINDINGS.md` "Post-claim editor".)

Consequence for the shell: the post-claim shell is not one fixed set of tabs. It is a
rail assembled from the entitlements an account holds, and it must handle an account that
holds several at once.

---

## 2. Marketplace — the demand engine

The Marketplace is where demand originates: a stranger lands on **Hubly's own page** and
says what they need. Hubly asks **where, when, and the details**, then **matches one
provider** in that area — **Uber-style, one match, not a list of quotes**.

- **Ranking:** coverage (is the provider in this area) is the signal that exists today.
  Jobs completed and reviews come later, once either of those exists as real data — not
  before (today both are effectively empty; see `SHELL_TERRAIN.md` §4/§5).
- **Economics:** a **non-Hubly provider keeps 70%**; a **Hubly account keeps 75%** — i.e.
  Marketplace takes 25–30%, because it delivers the customer.

**No-provider-in-area is not a dead end.** Capture the request and promise a human will
find someone, with a **real time bound** ("give me until tomorrow morning") and a calm
voice — *let us do the work, we'll find someone for you.*

- That promise is **only honest if the request reaches Adrian's phone immediately.** A
  captured request sitting in a table is exactly the **dead-drop shape** documented in
  `BOOKING_DESTINATION.md` (a request whose only home is a surface no one opens, with no
  provable notification). The capture and the alert are one feature, not two.
- **Unmatched requests are the recruiting roadmap:** each one names the **trade and city**
  to go sign up next, **with a customer already waiting.** Treat the unmatched queue as
  the go-to-market list, not an error log.

**The constraint that decides whether any of this works: provider response time.** Uber
works because drivers answer in seconds. Home-service providers are under a hood or on a
ladder and cannot. And today Hubly's *only* notification path is **email with unproven
delivery**, to owners who **don't open the dashboard** (`BOOKING_DESTINATION.md`: no
delivery ledger predates 2026-08-20; the operating owner acted only via the dashboard,
never a proven notification). One-match-fast is the product's core bet, and the
weakest link is reaching the provider in time. This is the open risk, not a solved detail.

---

## 3. Storefront is a third mode, above vertical

The **top-level distinction is what a business sells**: **time** (bookings) or **goods and
digital products** (storefront). That choice **determines the backend and the record**,
not just the page. **Vertical** — detailer, photographer, restaurant — sits *below* the
mode and mostly drives **vocabulary and defaults**, not architecture.

- Storefront must support **both physical products and courses** (a digital product).
- Storefront **shares** the generator, the chat, the anchors, the claim flow, and the
  shell. **Only the transaction layer and the record differ.**
- **Explicit constraint:** Storefront **must not become a separate codebase.** If it forks
  the generator/chat/claim/shell, every fix gets made twice. It is a mode of the same
  product, reusing the same machinery, with a different transaction layer bolted to the
  same spine.

---

## 4. Storefront pricing

- **Free at 5%** (on top of Stripe's own processing), **or $29/mo and Hubly takes
  nothing.** Breakeven is **~$580/mo in sales**.
- Hubly should **proactively tell a seller which plan is cheaper for them**, based on their
  **actual sales** — not make them work out the breakeven.
- **The principle behind the number: charge for demand, not for software.** Marketplace
  earns 25–30% because it *delivers the customer*. A storefront's traffic comes from the
  owner, so the storefront is **priced to acquire, not to monetize.**

Two notes to carry forward:
- **5% + processing is ~8% all-in.** That is fine on a course (near-zero marginal cost) and
  **heavy on a physical product with thin margin** — **expect the first complaints there.**
- **Build on Stripe Connect from day one**, with the **application fee set to zero for
  storefront**, so Marketplace's revenue split doesn't require a second money layer bolted
  on later. One Connect foundation, fee = 0 for storefront, fee > 0 for Marketplace.
- **Regulatory note:** taking a **percentage of other people's transactions** puts Hubly in
  a **different regulatory position** than a website builder that only charges subscription.
  Flagged, not resolved.

---

## 5. The vertical must be a stored fact

Today the generator **infers** what kind of business it is and **discards** it, so nothing
downstream can be trade-aware — the **same failure class** as the missing anchor (finding
#8) and the missing notification ledger (`BOOKING_DESTINATION.md`): a fact known at the
moment of generation and thrown away, so later steps have to re-guess it or can't act.

Store, at generation time:
- **mode** — `service` / `storefront` / `both`;
- a **canonical trade** — the value Marketplace matching keys off;
- the **model's own descriptor, in its own words** — for copy and voice.

Rules:
- An **unclassified** business must **degrade to the concierge path** (a human finds a
  match), **never guess** — **a wrong match is worse than no match.**
- The owner must be able to **correct** the classification.
- **Real-corpus proof this matters:** *detailing chemicals and courses* is a **storefront**
  (it sells goods and courses), **not a detailer** — but it renders under a `detailing`
  business_type today, and a **fixed list would confidently mis-file it.** The classifier
  must be the model's judgment stored as a fact, correctable, not a hard-coded taxonomy.

---

## 6. The booking destination is broken

Clicking **"Book the cart"** on dawn-patrol lands on a **generic page** reading **"Your
Business"** with a **"YB" avatar** and **"Add services to show them here"** — **owner-facing
placeholder copy shown to a customer**, and **none of the four services** we verified are in
the record appear on it.

- **Unknown and untested:** whether this is **draft-only**, or **also broken for claimed
  businesses.** **Do not resolve by guessing** — this is the next thing to check (see §7).

The destination must **carry the business's identity**: its **name**, its **real services**,
and the **generated site's palette and type**, so it **looks like it belongs** to the site
the customer just came from — not a generic shell.

Its **shape is set by conversation, from five questions** — not per-vertical templates:
1. Is it an **order** or an **inquiry**?
2. Does the **price depend on something the customer supplies**?
3. Does it consume a **time slot** or a **date**?
4. **Whose location** — the customer's or the business's?
5. Is there a **deposit**?

Those five answers, gathered in chat, determine the booking/checkout shape — the same
"let the conversation set the structure" discipline used elsewhere, not a fixed form per
trade.

---

## 7. Open, and marked as open

These are **named blanks**, not to be invented:
- **The paying company's storefront scope and deadline.** Adrian has not provided the
  agreed scope or the deadline for the storefront build. Left blank on purpose until he
  does — do not infer one.
- **Whether the booking page also fails for claimed businesses** (§6). Draft-only vs
  broken-for-everyone is untested; check before designing the fix.
- **Adrian's two phone tests** (Claude Code cannot run a real iOS Safari, so these are
  his): (a) **HEIC on the price-list path** — does iOS transcode on pick and does the
  price list read through; (b) **whether a second photo can be sent in one conversation**
  (the photo ask arms once; see `docs/OPEN_FINDINGS.md` #6).

---

## 8. The Website workspace editor — direction (recorded 2026-08-31, mostly not built)

The claimed shell is now two modes on one generic switch: **Home** (the conversation is the
screen) and a **workspace** (the thing becomes the large canvas, chat drops to an assistant
panel). Website is the first workspace. This section records where its editor is going. **Only
the two things at the end are built; the rest is the picture, not a build order.**

**The model.** Hubly is the AI and the builder; the canvas is the *real* live site; manual
controls appear **contextually, not as a permanent toolbox**. The target:
- **Hovering a section outlines it**; **selecting one opens a small contextual inspector** —
  content, image, layout, style, visibility — for that section only.
- A **compact canvas toolbar** carries Desktop/Mobile and Undo (nothing else permanent).
- A **Sections control opens on demand** for reorder, hide, duplicate.
- **The AI highlights the section it is about to change before changing it** — the same
  "name what you're about to touch" discipline the chat side already follows.
- **Style discovery at first build** — a few real visual directions to choose from — rather
  than dropping the owner into a blank editor.

**Two honest constraints that bind any future editor sketch:**
- **There is no draft-versus-live model, and that is deliberate.** Every edit goes live the
  instant it's made (a new document version). So **there is no Publish button** — any toolbar
  mock that shows one is describing a system we chose not to build. The safety is reversibility
  (Undo), not a staging area.
- **"Pick a style and Hubly rebuilds the site" is the destructive rebuild we retired** (it
  discarded 18 accumulated edits). If style-switching returns, it is a full regeneration and it
  gets the standing treatment: **name exactly what will be lost before the owner agrees**
  (`planFreeformRegeneration` already computes the carried/lost edits). Small changes are
  instant and reversible; only the irreversible one asks first.

**What IS built now (this session):**
- **Autosave + Undo, no Save button.** No draft state, no Publish, no "you've made N changes,
  save them?" prompt — those breed unsaved-changes dialogs, the edit-for-an-hour-and-never-
  publish failure, and confirmation fatigue. Undo is *step back one version*: the RPC
  `restore_prev_business_document` appends the previous version's content as a **new** version
  forward (history is never destroyed). It is offered two ways — an **Undo action beside the
  change's confirmation message** (the message-carries-an-action primitive, `hcAttachMessage
  Action`) and **in words** ("put that back" / "undo that", matched before the model sees it) —
  and it **says what it restored** ("Put the photo back the way it was"), never a bare "done".
- Two known refinements, deliberately deferred: **Undo is single-step for v1** (pressing it
  again would restore the pre-undo state — a toggle, not a stack; a real multi-level history is
  future), and the confirmation names the **kind** ("the photo", "the wording") but not the
  specific card ("Basic Mow photo") — the specific name needs a label→service-name map.

## 9. Filed for later (recorded 2026-08-31, not now)

- **Pricing.** Free to claim, edit and publish on `myhubly.app`, and free **through the first
  booking**. Paid only when Hubly starts *doing business* for them — ongoing bookings, jobs and
  customers, taking payment, own domain. Market anchor: Jobber Core **$49/mo**, Housecall Pro
  Basic **$79/mo** for one user, so **$29 is under-priced; $39–49 is defensible**. Storefront is
  already decided (free-with-5% or $29/mo on Connect); Marketplace at 70/75. **Before finalising:
  log tokens per business** so cost-per-customer is a real number, not a fear.
- **Bring your own domain.** One **CNAME** (A/ALIAS for the apex), registered via the **Vercel
  API** with automatic SSL, plus registrar-specific instructions in chat. **Never take over their
  nameservers** — their email **MX** records live in the same DNS, and moving it kills their email
  on launch day. The domain points at us; the DNS stays theirs.
- **Read their existing site.** "What's your website address?" → fetch it, extract services,
  prices, hours, phone, area, and **their own photos**, and rebuild from that. Fixes the
  thin-record problem that made tonight's pages sparse, gives real work photos instead of stock,
  and is the strongest switching pitch available. (Pairs with the `website.analyze` real-fields
  rule already in the generation prompt — only what genuinely came back is cited as real.)

---

*This document authorizes nothing. It is the shared picture; each build gets its own
decision.*
