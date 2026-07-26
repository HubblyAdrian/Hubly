# Release Note — Operate Leads Stage 1 (Operating System)

**Date:** 2026-07-26  
**Module:** 🧲 Leads  
**Stage:** 1 — Operating System  
**Branch:** `cursor/operate-leads-2662`

## Summary

Leads Stage 1 ships Hubly’s inbound interest OS: capture, qualify, quote, communicate, and convert — on Hubly data. No live Meta / Messenger / Google Forms / Twilio sync is claimed.

## Stage 1 (shipped)

- Header: real-time search, filter drawer, add-lead modal
- Tabs: New · Quotes · Waiting · Lost · AI Qualified
- Lead list cards + context menu + double-click profile
- Workspace: Overview · Conversation · Quote · Estimate · Tasks · Notes · Files
- Sidebar: Notes · Activity · Lead Score · Attachments · Permissions matrix
- Lead actions: convert customer/job, quote, follow-up, photos, payment, review, archive, delete, duplicate
- AI assists (in-app): score, intent, summaries, suggested quote/membership, duplicate/spam checks
- Empty / error / responsive; Stage 2 CTAs without “connected” claims

## MAT

See [LEADS_MAT.md](../operate/LEADS_MAT.md). Runner: `node scripts/mat-leads.mjs`.  
Result: **✅ ACCEPTED**

## Stage 2 (deferred)

- Meta Lead Ads live sync
- Messenger / Instagram lead capture sync
- Google Forms live sync
- Twilio lead SMS automation

## Lock (after merge)

**Leads Operating System → 🔒 OS**
