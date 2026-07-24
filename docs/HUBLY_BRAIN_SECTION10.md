# Section 10 — Conversation Intelligence (Release Gate)

**Status: Proven only when `node scripts/check-section10-conversation-intelligence.mjs` exits 0.**

Section 10 accepted. Do not begin Milestone 2.

## Objective

Hubly’s **short-term working memory** — what is happening *right now*.

Not chat history. Not conversation logs.

## Memory separation

| System | Answers |
|--------|---------|
| Business Memory | What do I know about the business? |
| Workspace Memory | How does this owner work? |
| **Conversation Intelligence** | What are we currently working on? |

These must never become one database.

## What it stores

Active Goal · Current Project · Active Topic · Pending Decisions · Open Questions · Commitments · Deferred Ideas · Follow-up Queue · Emotional Context · AI Context

## Conversation Threads

Work is organized by thread trees, for example:

```
Website Redesign
├── Homepage
├── Booking Flow
└── Portfolio

Business Growth
├── Memberships
├── Pricing
└── Reviews

Operations
├── Stripe
├── Google Calendar
└── Scheduling
```

“Let’s continue where we left off” resumes the active thread — not a random chat.

## Retrieval (no chat scanning)

- What were we doing yesterday?
- What’s left to do?
- What project are we working on?
- What have you promised me?

## Demonstration

1. `I'm redesigning my website.` → Website Redesign project + pending approvals  
2. `I want memberships later.` → Deferred idea  
3. `What's left to do?` → Approve homepage · Connect Stripe · Publish website  
4. Later → revisit memberships from deferred store  
5. `Remind me tomorrow.` → Commitment + follow-up  

## Verify

```bash
node scripts/check-section10-conversation-intelligence.mjs
# or
npm run check:section10
```

Evidence: `docs/HUBLY_BRAIN_SECTION10_PROOF.json`
