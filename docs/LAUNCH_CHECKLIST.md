# Hubly Launch Checklist

Not a technical checklist. A **customer checklist**.

For every item, answer one question:

> **Can a real business owner depend on Hubly for this today?**

If the answer is no, the milestone is not done.

Architecture is frozen. Connectors stay generic. We do not invent new Brain layers.
We ship production-ready customer outcomes.

---

## How to use this file

1. At the start of every sprint ask:  
   **If a customer signed up today, what is the biggest thing preventing them from relying on Hubly?**
2. Find that gap in this checklist.
3. Build it until a real owner can depend on it.
4. Check the box only when the answer is honestly **yes**.
5. Ship. Repeat.

**Current focus:** Milestone 2 — Business Launched  
(A website alone is not a launch. Customers must be able to hire the business.)

---

## Milestone 1 — Business Created

**Outcome:** A brand-new owner describes their business and a real company now exists inside Hubly.

**Owner feeling:** “I have a real company now.”

| Dependable today? | Customer proof |
|---|---|
| [ ] | Owner can describe the business in conversation and Hubly creates it |
| [ ] | Business Identity exists (name, voice, positioning) |
| [ ] | Logo exists |
| [ ] | Brand colors exist |
| [ ] | Website exists with Homepage, About, Services, Gallery, Contact |
| [ ] | Booking page exists |
| [ ] | SEO is generated (title, description, share tags) |
| [ ] | FAQ schema is present on the live site |
| [ ] | LocalBusiness schema is present on the live site |
| [ ] | Sitemap is available on the live site |
| [ ] | robots.txt is available on the live site |
| [ ] | Analytics events fire (page view, book click, form submit) |
| [ ] | AI copy is based on Business DNA and is editable by the owner |
| [ ] | CRM foundation is created with the business |
| [ ] | No fake testimonials, fake reviews, or fake urgency anywhere |

**Milestone done when:** every row above is yes for a paying owner on a fresh signup.

---

## Milestone 2 — Business Launched ★ CURRENT PRIORITY

**Outcome:** Customers can actually hire the business. The owner can operate without another website platform.

**Owner feeling:** “I can run my business on Hubly.”

| Dependable today? | Customer proof |
|---|---|
| [ ] | Website publishes reliably to a live URL |
| [ ] | Booking accepts real appointments |
| [ ] | Calendar Connection works (availability stays true) |
| [ ] | Payments Connection works (deposits / checkout can succeed) |
| [ ] | Contact forms work and create real leads |
| [ ] | Emails send for booking / lead events |
| [ ] | Business can receive leads without manual setup theater |
| [ ] | Domain connection workflow exists (Domain Connector only — no registrar-specific Runtime code) |
| [ ] | Connection status is clear (“Domain / Stripe / Calendar connection required” when missing) |
| [ ] | Business Health is visible after launch |
| [ ] | Timeline shows what Hubly did to launch the business |
| [ ] | A paying owner could realistically stop using another website platform |

**Milestone done when:** a paying customer could leave Squarespace/Wix/etc. and hire customers through Hubly.

**Business Launch experience includes:** Business Identity · Publishing · Domain connection workflow · Connection status · Business Health · Timeline.

---

## Milestone 3 — First Customer

**Outcome:** A homeowner hires a business entirely through conversation.

**Homeowner feeling:** “I just described what I needed and it got handled.”

Homeowner types: *“I need my driveway pressure washed.”*

| Dependable today? | Customer proof |
|---|---|
| [ ] | Customer can describe a job in natural language |
| [ ] | Hubly understands the request (no category browsing) |
| [ ] | Customer Memory is created |
| [ ] | Customer Profile is created |
| [ ] | Matching finds the right businesses |
| [ ] | Ranking is intelligent (including Business DNA fit) |
| [ ] | Booking completes |
| [ ] | Payment succeeds |
| [ ] | Business receives notification |
| [ ] | Customer receives confirmation |
| [ ] | No marketplace terminology in the customer experience |

**Milestone done when:** a homeowner successfully hires a business end-to-end.

---

## Milestone 4 — Business Running

**Outcome:** The business runs inside Hubly with minimal manual work.

**Owner feeling:** “Hubly keeps the day moving without me babysitting software.”

| Dependable today? | Customer proof |
|---|---|
| [ ] | CRM grows automatically from bookings, quotes, reviews, payments |
| [ ] | Jobs update automatically |
| [ ] | Payments sync automatically |
| [ ] | Timeline updates automatically |
| [ ] | Hubly Daily works as the owner homepage |
| [ ] | Business Health updates from real activity |
| [ ] | Calendar stays synchronized |
| [ ] | Messaging works for real customer communication |

**Milestone done when:** day-to-day operations require minimal manual software work.

---

## Milestone 5 — Business Growing

**Outcome:** Hubly acts like a proactive employee.

**Owner feeling:** “I have someone working on the business every morning.”

### Hubly Daily

| Dependable today? | Customer proof |
|---|---|
| [ ] | Shows what happened yesterday |
| [ ] | Shows what’s happening today |
| [ ] | Shows Business Health |
| [ ] | Gives recommendations |
| [ ] | Names one thing Hubly will handle automatically |
| [ ] | Names one thing the owner should do |

### AI Coach

| Dependable today? | Customer proof |
|---|---|
| [ ] | Surfaces opportunities without waiting for questions |
| [ ] | Recommendations are driven by Business Health |
| [ ] | Advice is specific (pricing, reviews, photos, capacity, promotions) |

### Living Business

| Dependable today? | Customer proof |
|---|---|
| [ ] | Website updates after new reviews |
| [ ] | Homepage/services update after service changes |
| [ ] | Gallery updates after new photos |
| [ ] | SEO updates after business changes |
| [ ] | Business DNA evolves from real outcomes |

### AI Marketing

When the owner says *“I need more customers,”* Hubly can dependably:

| Dependable today? | Customer proof |
|---|---|
| [ ] | Improve website copy |
| [ ] | Generate Google Ads (via Advertising Connector when connected) |
| [ ] | Generate Meta Ads (via Advertising Connector when connected) |
| [ ] | Generate emails |
| [ ] | Generate social posts |
| [ ] | Improve SEO |
| [ ] | Suggest promotions |

**Milestone done when:** growth work happens through conversation and real business data — not dashboards the owner has to operate.

---

## Connector rule (infrastructure, not product)

Connectors remain generic. Runtime never contains vendor-specific code.

Only implement a vendor when a milestone above requires it to be dependable:

| Connector | Needed for |
|---|---|
| Domain Connector | Business Launched |
| Payment Connector | Business Launched / First Customer |
| Calendar Connector | Business Launched |
| Email Connector | Business Launched |
| Messaging Connector | Business Running |
| Advertising Connector | Business Growing |

Do not build extra vendors early. When a registrar/provider is chosen later, only the connector implementation changes.

---

## Final product proof

1. Owner: *“I own Acme Home Cleaning.”*  
   Hubly creates Identity, Website, Booking, CRM, Business Health, Timeline, Dashboard.

2. Homeowner: *“I need my house cleaned.”*  
   Hubly finds, books, collects payment, notifies everyone.

Coach, Living Business, AI Marketing, and Weekly Learning come **after** those two experiences are dependable.

---

## One-line definition of done

A checkbox is only checked when a real business owner can depend on that outcome today — not when the feature exists in code.
