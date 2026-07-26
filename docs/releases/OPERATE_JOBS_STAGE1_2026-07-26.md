# Release Note — Operate Jobs & Calendar Stage 1 (Operating System)

**Date:** 2026-07-26  
**Module:** 📅 Jobs & Calendar  
**Stage:** 1 — Operating System  
**Branch:** `cursor/operate-jobs-calendar-2662`  
**PR:** [#246](https://github.com/HubblyAdrian/Hubly/pull/246)

## Summary

Jobs & Calendar Stage 1 ships Hubly’s scheduling and job operations OS: calendar views, job list/workspace, route, availability, team, metrics, and AI assists — all on Hubly data. No external calendar sync or live maps are claimed.

## Stage 1 (shipped)

- Jobs & Calendar page with tabs: Calendar, Jobs, Route, Availability, Team
- Calendar: day / week / month / agenda, prev/next/today, create/edit, drag, resize, status colors
- Job list filters: upcoming, in progress, completed, cancelled, recurring
- Job workspace: overview, checklist, photos, notes, products, invoice, timeline
- Job actions: start, pause, resume, complete, cancel, duplicate, reschedule, convert quote
- Route order + mileage/drive estimates; availability + team workload
- Search, filters, bulk actions, dashboard metrics, AI suggestions, notifications
- Loading / empty / error states; responsive layout

## Stage 2 (deferred — separate PR later)

- Google / Apple / Outlook calendar sync
- Google Maps live routing + traffic
- SMS arrival notifications
- Customer live tracking

## Lock (after merge)

**Jobs Operating System → 🔒 OS**  
Do not modify Jobs OS unless bug fix, Stage 2 integrations, or explicit reopen.
