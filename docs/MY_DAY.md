# Hubly — Rename Planner to "My Day" + Combine Jobs and Planning

> **Adrian's specification, recorded verbatim 2026-09-13.** This is the requirement, not input
> to be improved. Do not rewrite, summarise, improve or reinterpret it. The audit that responds
> to it is `docs/MY_DAY_AUDIT.md`; corrections and rulings belong there or in
> `docs/DECISIONS.md`, never by editing this file.

I want to make a significant UX/product change to the current Planner concept.

## 1. The new name is My Day

Do not call this Planner anymore in the user-facing product.

The goal is for My Day to become the owner's daily execution center — combining:

Jobs
Appointments
Calendar
Work tasks
Personal tasks
A/B/C prioritization
AI day planning
Rescheduling
What needs attention today

This is not simply a rename and it is not two screens mashed together.

The product concept is:

Home tells you what matters.
My Day tells you what you need to do.
Chat lets you ask anything.
Workspace lets you do the work.

## 2. First: AUDIT BEFORE CODING

Do not start implementing immediately. First inspect the existing Hubly codebase and determine:

What currently exists for Planner
What currently exists for Jobs
What currently exists for Calendar
What task/data models already exist
What customer/job relationships already exist
What Google Calendar integration already exists
What AI planning functionality already exists
What existing shell/navigation mechanisms can be reused
What is actually working vs backend-only vs placeholder
What existing UI/components should be reused rather than rebuilt

Especially inspect the current platform-home.html shell and existing hc.mode, data-mode, hcOpenWorkspace.

Do not assume Jobs, Calendar, Customers, etc. are already real shell surfaces simply because backend functionality exists.

Give me a short audit first. Do not make code changes until the audit is complete.

## 3. Product philosophy

The biggest problem we are solving is overwhelm.

A business owner may have: 4 jobs, 3 appointments, 6 business tasks, 4 personal tasks, invoices, follow-ups, supplies to order, website work.

If Hubly shows all 20 things with equal visual weight, it has failed.

My Day should answer: "What actually matters today?"

The AI should help prioritize the owner's day instead of making the owner organize everything manually.

## 4. A/B/C remains the core prioritization model

Keep the existing A/B/C concept.

A — Must Do. If this doesn't happen today, there is a real consequence. Examples: customer appointment, complete today's job, send an overdue invoice, important customer follow-up.

B — Important. Should get done, but can move if necessary. Examples: call a lead, order supplies, update website.

C — Nice to Do. Good to accomplish, but completely okay if it doesn't happen. Examples: Instagram post, organize photos, gym, clean workspace.

The UI should communicate that not everything needs to get done today. Do not create a guilt-inducing completion system.

Do NOT emphasize: "7/10 tasks completed".

Instead, if the A's are complete, the system should be able to say: "Nice work today. You got your A's done." But keep this subtle and contextual — do not turn the interface into a motivational/promo dashboard.

## 5. Jobs are first-class items inside My Day

This is the biggest change.

A Job should not feel like it lives in a completely separate universe from the owner's day. If I have 10:00 AM — Full Detail — John, that is an item in My Day.

The item can display: time, customer, service, location, relevant job information, status, duration where available.

Clicking it should open the existing appropriate job/workspace experience, preferably using the existing workspace architecture rather than rebuilding Jobs inside My Day.

Important: My Day is the daily execution layer. The detailed Job workspace remains the place where the owner actually performs/manages the job.

So: My Day → click Job → Job workspace. Do not duplicate the entire Jobs application inside My Day.

## 6. Calendar is also part of My Day

Calendar events should appear alongside tasks and jobs according to time. For example:

8:00 AM ☐ Drop off supplies
9:00 AM 🚗 Full Detail — John
12:00 PM 📅 Lunch / personal calendar event
2:00 PM 📞 Call lead
4:00 PM 🚗 Ceramic Coating — Mike

The user should be able to understand the shape of their entire day without switching between Planner, Jobs and Calendar.

If Google Calendar is already connected, use the existing integration. Do not create a second calendar system.

## 7. Work + Personal belong together

My Day is the owner's day, not merely their work schedule.

A user should be able to add — Work: call customer, send invoice, order supplies, update website. Personal: gym, pick up kids, grocery store, doctor appointment, call Mom.

Do not call this an "ADHD planner." We want the product to be ADHD-friendly through its design, not through a label.

## 8. AI planning

The existing Hubly AI should be able to help plan the day.

Primary action: Plan my day

When clicked, AI should evaluate the real available data: jobs, appointments, calendar, tasks, deadlines, relevant business information, personal tasks if enabled. Then propose a reasonable A/B/C prioritization.

Example:

I looked at your day. I'd make these your A's:
A — 10:00 AM Full Detail — John
A — Send Sarah's overdue invoice
I'd keep these as B's: call two leads, order cleaning supplies
And these can wait: update website, Instagram post

The user can then accept, change, or verbally modify the priorities. Examples: "Make ordering supplies an A." / "Move the website task to tomorrow." / "I need to leave at 3, reorganize my day." / "What should I do next?"

## 9. CRITICAL AI RULE

The AI must never invent information to justify a recommendation.

It can prioritize based on actual data. It cannot say something like "You should do this because customers usually expect it today" unless that fact actually exists in the data/context available to Hubly.

No fake urgency. No fabricated business statistics. No invented appointments. No invented deadlines. No fake tasks.

If the system doesn't know, it should say it doesn't know.

## 10. Visual structure

Use the existing Hubly visual direction we have been developing. Think: premium + simple + calm + highly usable.

Not: generic SaaS dashboard, 20 KPI cards, rainbow task management, dense project management software, corporate scheduling software.

The user should be able to open My Day and immediately understand: What matters → What's happening → What comes next.

## 11. Layout

LEFT. Keep the existing navigation tabs. My Day should become the primary workspace item. Do not put a bunch of planner controls in the left rail.

CENTER. This is the main My Day experience.

Top: Good morning, [Name] then dynamic context such as "You have 2 things that really matter today. Start with your A's. Everything else can wait."

Then quick actions: Plan my day · Add a task · Move something · Show my week.

Then: A — Must Do (jobs and tasks can appear together), B — Important, C — Nice to Do.

Keep the A/B/C visual treatment subtle. The letter can have visual emphasis. The entire task should NOT become a giant colored card. Avoid visual overstimulation.

RIGHT. Use the existing right-side workspace/detail pattern where appropriate. Show today's calendar and relevant daily context. Potentially: upcoming appointments, schedule, time remaining, AI suggestions, selected item details.

But don't turn this into another dashboard. The right side should provide context, not compete with the main day.

## 12. Important interaction

If I click 10:00 AM — Full Detail — John, don't force me to navigate away to some unrelated page. Use the existing workspace/detail architecture to open the job.

The user should feel like "I'm working on my day", not "I left My Day and entered a completely different application."

## 13. Jobs should not disappear

This does NOT mean deleting the Jobs capability. Jobs can still exist as a workspace/capability where appropriate for: searching jobs, viewing all jobs, managing job history, filtering, job-specific operations.

But My Day is where today's jobs become part of the owner's daily workflow.

Think: Jobs = the complete job system. My Day = today's execution view of that system.

## 14. Calendar should not disappear either

Same concept: Calendar = complete calendar capability. My Day = today's relevant calendar context.

Do not duplicate calendar logic. Reuse the existing data/integration.

## 15. Mobile/responsive behavior

This needs to work extremely well on desktop, tablet and phone.

On smaller screens, prioritize: 1) A items, 2) upcoming jobs/appointments, 3) B items, 4) C items.

Don't simply shrink the desktop dashboard. The mobile experience should feel intentional.

## 16. Progressive complexity

A brand-new business shouldn't see an empty giant planning system.

If the user has no jobs, no calendar, no tasks — My Day should still work as a simple daily planner.

If they later have jobs, calendar, customers, website, store — My Day naturally becomes richer.

Do not show empty modules just because they exist.

## 17. No fake data

This is extremely important. Use actual Hubly data.

If there are no jobs: "No jobs today". If there are no calendar events: "Nothing scheduled". If there are no tasks: "Add something to your day".

Do not populate the screen with fake sample customers/jobs/tasks just to make it look full.

## 18. Do NOT build yet until we agree on the architecture

After your audit, give me:

A. What exists today — Planner, Jobs, Calendar, Tasks, AI.

B. What can be reused — list existing components/functions/data models.

C. What needs to change — only the minimum required changes.

D. Proposed My Day architecture — show how Jobs + Calendar + Tasks + Personal + AI come together without duplicating existing systems.

E. Proposed UI structure — describe the exact screen before coding it.

F. Risks — especially duplicated data, duplicated calendar logic, duplicated job logic, existing shell conflicts, mobile issues, AI hallucination/data integrity risks.

Then STOP. Do not code until I approve the plan.

## The core product principle

My Day is not a planner. My Day is the owner's daily operating view of their business and life. It combines the things they need to do, the things that are already scheduled, and the things Hubly believes matter most — while letting them drill into the actual Hubly workspace when they need to do the work.

Do not overbuild this. The magic is simplicity.


---

# WHAT A RECOMMENDATION LOOKS LIKE — the first real one, 2026-09-14

Adrian: *"our AI has to become this smart it has to think about the user everyday. give a recap
or recommendations and be ready for questions."* Here is the first instance that came from the
product actually knowing something, rather than from anyone designing a recommendation.

## The observation

Fixing the services reader to consult both stores (2026-09-14) surfaced something nobody had
told Austin Graef: **he has a service on his record that is not on his website**, and it may be
a duplicate of one that is.

| on record only | on his page |
|---|---|
| `clay and seal` — price 0, no description | `Clay & Seal Package` — $75, 1.5h, described |

## What Hubly says

> **"You've got 'clay and seal' on your record but it isn't on your site. Is that the same thing
> as your Clay & Seal Package, or should I add it?"**

## Why that is the shape, clause by clause

- **It is a fact he did not know.** Not a restatement of something on his screen. A recap that
  tells an owner what he can already see is a status report, and he will stop reading them.
- **It is phrased as a question, because we do not know the answer.** They are probably the same
  service. *Probably* is not a fact, and the honest form of a probable thing is a question. This
  is also why the reader refuses to fuzzy-merge them — see the migration comment: name
  similarity is not identity.
- **There is an action attached, and it is one action.** "Should I add it?" — one thing, doable
  in one reply. Not a menu.
- **It is not a warning.** Nothing is broken. No red, no "issue found", no count of problems.
- **It is not a checklist item.** It does not arrive in a list of four things with buttons; it is
  one sentence in Hubly's own voice, which is the whole of `docs/NEXT_ASK_ORDER.md`.
- **NOTHING IS CLEANED UP.** His records are not touched. The observation is offered; the
  decision is his. A recommendation that silently fixes the thing it noticed is not a
  recommendation, it is an edit he did not ask for.

**The test for any future recommendation: could the owner have known this without us? If yes,
it is a status line. If no, and there is one action, it is a recommendation.**

## Noticing this class in general — costed, not built

The observation above is one instance of a general shape: **a fact that exists in one store and
not the other, across any two-store fact.** Today there are two such facts (`services`, `hours`)
and both readers already return `source` per row, so the raw signal exists.

| piece | cost |
|---|---|
| the signal | **already there** — every row from `get_business_services` / `get_business_hours` carries `source` (`both` · one store · the other) and `conflicts` |
| a reader that returns only the divergences | **~25 lines** — one RPC, `get_business_store_divergences(business, owner)`, selecting rows where `source <> 'both'` or `conflicts` across the declared two-store facts |
| phrasing one | **~20 lines per fact kind** — the sentence is specific ("on your record but not on your site" is not "the two copies of Tuesday disagree"), so each fact needs its own, and generating them would produce exactly the thin prose we rejected for capability descriptions |
| deciding WHEN to say it | **the real cost, and it is not lines** — this is a recommendation, so it obeys the one-ask rule, the voluntary-addition budget, and must not repeat once he has answered. That needs a "told them, they said X" record — a new table, or a column on `hubly_owner_profile` |
| migrations | **one**, for the divergence reader; a second if the acknowledgement record lands |

**~70 lines plus a decision about memory.** The cheap half is finding them; the expensive half is
not asking twice. **Recommended only once My Day exists to put it in** — a recommendation with
nowhere to live becomes a fifth composer in the chat, which is the thing we spent the night
removing.
