# A conversation needs an identity — design, for approval

**No migration has been written. This is the design Adrian asked to see first.**

## Why both requests are one change

Adrian: *"we are supposed to have a different convo in every tab but the home tab"* and *"we
should have chats saved like you do and chatgpt does."*

`business_conversations` is `(id, business_id, seq, role, content, created_at)`. **There is no
conversation in it** — it is one endless stream per business, ordered by `seq`. That is why
"See earlier conversation" had to be invented as a fold: there was no boundary to open at.

Per-tab threads and saved chats are not two features. They are the same missing column.

## The corpus, measured 2026-09-15 (this is what any migration has to carry)

```
482 rows across 67 businesses
7 of 10 MARKET businesses have history — graefs-autocare has 4 rows
gaps > 6h between consecutive turns:  11, across 5 businesses
gaps > 24h:                            4
```

Three businesses span more than one day (dawn-patrol-coffee 51 rows/4 days,
evergreen-yard-care 38/4, hubly-classic-fixture 28/2). **Everything else is a single sitting.**
That number decides the backfill below, and it is why a clever time-gap split is not worth its
risk: it would manufacture boundaries for 11 gaps and get them wrong for some of them.

## 1. The shape

```sql
business_conversations_meta          -- the conversation itself
  id            uuid pk
  business_id   uuid not null  -> businesses(id) on delete cascade
  owner_id      uuid null      -- null while the business is an unclaimed draft
  scope         text not null  -- 'home' | 'website' | 'planner' | 'jobs' | 'customers'
  title         text null      -- null until earned; see §4
  created_at    timestamptz not null default now()
  last_active_at timestamptz not null default now()
  unique (business_id, scope) where scope = 'home'   -- Home is one thread, forever
```

and one column on the rows:

```sql
business_conversations.conversation_id  uuid not null -> business_conversations_meta(id)
```

`seq` **stays**, and stays per-business. It is what orders a thread and what
`append_business_conversation` allocates under an advisory lock; changing it to per-conversation
would be a second ordering scheme for no gain, and ordering has already been a defect here once.

**owner_id is on the conversation, not inferred.** A draft's conversation has none; the claim
sets it. The read RPCs keep the gates they have — draft token before a claim, `auth.uid()`
after — and simply add `conversation_id` to the `where`.

## 2. Which surfaces get their own thread

`HC_PLACE_SURFACES` today is **website, planner, jobs, customers**; `leads` and `store` are
declared pending and have no surface. `HC_ROOMS` renders planner, jobs, customers; website is the
editor.

| surface | own conversation? | why |
|---|---|---|
| **home** | **NO — one continuous thread, forever** | Adrian named it: the daily relationship. It greets him, it chains, it is where the arrival lives. A Home that forgot last week would be a different product. |
| **website** | yes | the conversation about his site — edits, copy, photos |
| **planner** | yes | about his day |
| **jobs** | yes | about a job or the job list |
| **customers** | yes | about a customer |
| leads, store | not yet | no surface exists; a scope is added when the room is |
| the public site chat | **no — different table** | `chatbot_conversations`, a visitor talking to the business. Out of scope entirely, and it must stay that way: it has no owner. |

**Confirm this list before I build it** — particularly whether `website` should be one long
thread like Home (it is arguably also a continuous relationship with one artefact) or many.

## 3. What happens to every existing row

**One conversation per business, scope `home`, containing everything that business has.** All
482 rows, all 67 businesses, Graef's 4 included. Nothing is orphaned and nothing is split.

Reasons, in order:
1. **Every existing row was typed in Home.** The other surfaces have never had a conversation of
   their own, so assigning history anywhere else would be inventing a provenance we do not have.
2. **Only 11 gaps over six hours exist in the whole corpus.** A time-based split would create a
   handful of boundaries and would be a guess at every one of them.
3. **It is reversible.** `conversation_id` is additive; the rows are untouched. If the split is
   later judged wrong, it is re-derivable — which is not true of a migration that rewrote `seq`.

The backfill is: create one `home` conversation per business that has rows, stamp every row with
its id, then `set not null`. Applied one file at a time with `db query -f`, as always.

**Titles for backfilled conversations are left NULL**, and Home's thread is not shown in the
saved list anyway (§4), so nothing gets a manufactured title.

## 4. Saved chats

A list he can browse: title, surface, last-active, opening puts him back **inside that thread** —
the composer posts into it, not into the global stream.

**Titles are earned, never manufactured.** Same discipline as the arrival and the chain:

- A conversation with **no owner turn** is never titled and never listed. An empty thread is not
  a chat.
- A conversation whose only owner turns are greetings or acknowledgements — the `HC_NOT_A_NAME`
  set already in the client, plus "hey", "hi", "ok", "thanks" — is **not titled**. Adrian's own
  `"hey"` on 2026-09-14 is precisely the case that must not become a chat called "Hey".
- Otherwise the title comes from the conversation's **own content**, derived once from the first
  substantive owner turn, and **stored** — not recomputed on every render, because a title that
  changes under someone is a different chat as far as they are concerned.
- **Home is never listed.** It has no title because it is not a chat; it is the thread.

An untitled-but-substantive conversation shows its first line rather than an invented name. We do
not ask a model to name it until there is a reason to.

## 5. What "See earlier conversation" becomes

**It becomes the entry point to the saved list, and it stops being a fold.**

Today it dumps the entire business stream below today's furniture because there was no boundary
to offer. With conversations, Home's own history is one thread and the other surfaces have their
own — so the honest control is *"Earlier conversations"*, opening the list from §4, with Home's
own earlier turns reachable by scrolling the thread it is already in.

The ordering fix from `f30064f` (history inserted above today's furniture, rendered once) stays
either way — it is about where a block lands, not about what produced it.

## What I need from you before writing anything

1. **The surface list in §2** — especially whether `website` is one continuous thread or many.
2. **§3**, the backfill: everything into one `home` conversation per business. This is the part
   that touches Graef, so it is the part to say no to if any of it is wrong.
3. Whether **"See earlier conversation"** becomes the saved list (§5) or is simply removed.
