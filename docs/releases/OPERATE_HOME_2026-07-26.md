# Release Note — Operate Home

**Date:** 2026-07-26  
**Module:** 🏠 Home  
**PR:** [#242](https://github.com/HubblyAdrian/Hubly/pull/242)  
**Merge:** `a7d0aff`

## Summary

Hubly Operate Home is live as the command center for the day. Owners see live KPIs, today’s schedule, AI morning brief, activity, weather/route context, global search, and notifications — with every primary control wired to a real destination or modal.

## What shipped

- Screenshot-matched Operate chrome (dark sidebar, Home app bar, brand orange `#D9632D`)
- KPI cards: Revenue Today, Jobs Today, Messages Waiting, Growth Score
- Hover breakdowns + click-through to Revenue, Jobs & Calendar, Inbox, Reports
- Today’s Schedule with Call, Directions, Start Job, Reschedule
- Weather (temp / wind / rain warning) + AI suggestion; route preview
- AI Morning Brief with clickable suggested actions
- Activity feed + Quick Actions (job, lead, customer, quote, invoice, campaign, membership, Ask Hubly)
- Global search (⌘K) across customers, leads, jobs, messages, services, reviews
- Notification bell + Home notification panel
- Dashboard customize + saved widget visibility (`hubly_home_layout_v1`)
- Loading, empty, error states; basic revenue permissions
- Mobile / tablet responsive layout + light motion
- Fast Customer Journey OS validator (no hang on `hubly.html`)

## QA

- Buttons tested: 23 / 23
- Console errors: 0
- Validator: PASS

## Deferred (not blockers)

- Live weather provider API
- Full RBAC matrix beyond revenue visibility
- Freeform drag-reorder of widgets
- Post-deploy pixel screenshot QA

## Module lock

Home is **Locked**. Do not modify Home code unless a bug fix, explicit reopen, or documented cross-module dependency.
