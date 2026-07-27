# ✨ Ask Hubly — Architecture (required before Development)

**Module:** 13 — Ask Hubly  
**Stage in scope:** Stage 1 — Operating System  
**Mount:** `ask` → `#v-ask` / `#jos-ask-root`  
**Rules:** #14–22 (especially **#15 · #19 · #21 · #22**)  
**Status:** Required gate — do not start Ask Hubly Development without this doc

---

## Purpose

Ask Hubly is **not just another page**.

It is the **intelligence layer** that sits on top of every Operate module you have built.

It may:

- Read across owners (never become a second CRM / ledger / catalog)  
- Propose and execute **approved actions** into the correct owning modules  
- Remember conversation context for the business  

It must stay **powerful but predictable** — high-impact writes require confirmation (Rule #22).

---

## What Ask Hubly owns (Rules #15 · #19)

| Data | Owner |
|------|--------|
| AI conversations | ✨ Ask Hubly |
| AI memory (session / business notes) | ✨ Ask Hubly |
| AI action proposals & execution log | ✨ Ask Hubly |
| AI confirmation queue | ✨ Ask Hubly |
| User automation allow-rules (OS) | ✨ Ask Hubly |
| AI preferences (module-level) | ✨ Ask Hubly (Settings may own global AI prefs later) |

**Forbidden:** separate customer DB, payment ledger, job store, service catalog, campaign store.

```
S.askHublyOs = {
  conversations: [],   // { id, title, messages:[{role,text,at}], updatedAt }
  memory: [],          // { id, kind, text, refs:{module,id?}, at }  — notes only, no entity copies
  actions: [],         // append-only log of proposed/executed/cancelled actions
  pending: [],         // confirmation queue
  automations: [],     // { id, actionType, allowed:true, note }
  prefs: { confirmHighImpact: true },
  activity: [],
  _seeded: false
}
```

---

## What Ask Hubly can READ

Read **only** through owning modules / shared aggregates — never clone:

| Source | Module |
|--------|--------|
| Customers | ❤️ Customers |
| Leads | 🧲 Leads |
| Jobs · Calendar | 📅 Jobs |
| Revenue (invoices/payments summaries) | 💰 Revenue |
| Reports (definitions / live aggregates) | 📊 Reports |
| Marketing | 📣 Marketing |
| Reviews | ⭐ Reviews |
| Memberships | 🔁 Memberships |
| Services | 🌐 Storefront |
| Business Settings | ⚙️ Settings (when present; OS may read `S` biz profile fields) |
| Pipeline stages | 🧭 Pipeline (orchestration view) |

Context builders return **summaries + ids**, not duplicated rows (Rules #15 · #19 · #21).

---

## What Ask Hubly can WRITE

Only through the **approved action catalog**.  
Writes call into the owning module’s public acts / helpers — Ask Hubly does not mutate foreign ledgers directly.

### Approved actions (Stage 1 OS)

| Action type | Effect (OS) | Confirmation |
|-------------|-------------|--------------|
| `create_job` | Propose / create job stub via Jobs patterns | Confirm |
| `create_quote` | Draft quote / lead quote action | Confirm |
| `draft_campaign` | Create Marketing campaign **draft** | No (draft) |
| `send_campaign` | Mark campaign send (OS) | **Confirm** |
| `update_website` | Propose Storefront copy change | **Confirm** |
| `publish_website` | Publish / go-live signal (OS) | **Confirm** |
| `schedule_followup` | Create follow-up note / task in memory + optional Inbox toast | Confirm if it touches Jobs/Customers |
| `generate_report` | Refresh / run Reports forecast or definition | No (analytics) |
| `summarize_customer` | Memory + chat reply only | No |
| `explain_report` | Chat reply only | No |
| `suggest_followups` | Chat reply / memory suggestions | No |
| `generate_draft` | Draft text into conversation | No |

### Must NOT do (hard guards)

- Modify financial records (payments, refunds, invoices amounts) **without confirmation** — and Stage 1 prefers **propose → confirm** only; never silent refund  
- Delete customers or jobs automatically  
- Change pricing silently  
- Publish website or send campaigns without approval  
- Bypass Revenue / Memberships / Customers owners  

---

## Rule #22 — AI Confirmation Policy

Before any AI action that **changes business data**, Ask Hubly must either:

1. **Ask for confirmation**, or  
2. Follow a **user-configured automation rule** that explicitly allows that `actionType`.

### Requires confirmation (defaults)

- Delete Customer  
- Refund Payment  
- Change Pricing  
- Publish Website  
- Send Marketing Campaign  
- Cancel Membership  
- Create Job / Create Quote (mutating)  
- Update Website (mutating)  

### Does not require confirmation

- Generate a draft  
- Explain a report  
- Summarize a customer  
- Suggest follow-ups  
- Read-only Q&A  

### Confirmation UX (Stage 1)

1. Action enters `pending[]` with payload (ids + intent only).  
2. UI shows Confirm / Cancel.  
3. On confirm → execute via owner path → append to `actions[]` → publish event.  
4. On cancel → append cancelled record — never apply mutation.  

Automation allow-rules in `automations[]` may auto-confirm **only** listed action types (never expand silently).

---

## Event publishing (Rule #17)

| Event | When |
|-------|------|
| `ai.action.proposed` | High-impact or mutating action queued |
| `ai.action.confirmed` | User confirmed |
| `ai.action.cancelled` | User cancelled |
| `ai.action.executed` | Action applied via owner |
| `ai.draft.generated` | Safe draft created |

Payloads: `actionType`, ids, labels — never full entity dumps.

---

## UI (Stage 1)

| Tab | Purpose |
|-----|---------|
| Chat | Conversations + prompt (Hubly wordmark on dark) |
| Actions | Pending confirmations + action log |
| Memory | Business/session notes (refs only) |
| Automations | Allow-rules for auto-confirm |
| Context | What Ask Hubly can read (owner map) |
| Activity | Append-only activity |

Acts prefix: **`ah-*`** (avoid clashing with legacy `ask-submit` / `data-jos-ask`).

Brand: use Hubly wordmark mark per brand rules (`hubly-wordmark-on-dark.png` on dark hero).

---

## Stage 2 — Live Integrations ⏸ DEFERRED

| Item | Status |
|------|--------|
| Live LLM provider | ⏸ |
| Live tool-calling into Stripe / Meta / Twilio | ⏸ |
| Live website publish APIs | ⏸ |

Stage 1 uses deterministic OS responders + action catalog — never claim “live AI connected” until Stage 2.

---

## Definition of Done (Stage 1)

1. This architecture doc present before Development.  
2. `S.askHublyOs` owns conversations / memory / actions / pending / automations only.  
3. Reads via owners; writes via approved actions + Rule #22.  
4. MAT ✅ · CMV PASS (incl. Reports) · Approval → Merge → 🔒 OS.
