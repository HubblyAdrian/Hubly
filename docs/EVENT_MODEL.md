# The event model — proposed, not built (Stage A, item 1)

Reported before writing code, as asked. Three questions: what is an event, where does the
stream come from, and how does it know what has been seen.

## What already exists (measured, not assumed)

| thing | state |
|---|---|
| `business_timeline_events` | table exists, correct-ish shape, **0 rows**, 0 businesses |
| its only reader (`mission_control.ts`) | selects a column `body` **that does not exist** — the table has `detail` |
| Realtime publication | **already enabled on `booking_requests`, `customers`, `jobs`** |
| per-owner read state | **nothing anywhere** — no `last_seen`, `seen_at` or `read_at` column in any table |

So: the live-arrival half needs no new infrastructure, the read-state half needs to be
built from nothing, and there is a fifth missing door — a timeline table that was built,
never written to, and whose one reader would fail on a column name.

## 1. What is an event

**An event is a source row crossing a threshold the owner would want to know about.** It
is not a new kind of record and nothing "emits" one. Stage A needs exactly one kind:

- `booking.created` — a row appears in `booking_requests`, or in `jobs` with `from_booking = true`
  (the chat-booking path writes `jobs`, which is why the K4 test found `booking_requests`
  empty and nearly produced a false alarm).

Stage B adds `chat.asked`, `booking.abandoned`, `order.placed` — all already readable
after K6.

## 2. Where the stream comes from — A VIEW, NOT A TABLE

**Recommendation: derive the stream from the source rows. Do not write a second copy.**

The obvious alternative is to start writing `business_timeline_events` at event time. I
think that is the wrong choice here, for the reason this week keeps producing:

> A written stream is a second copy that has to be maintained in parallel with the truth.
> When the writer misses one, the stream silently lacks it and **nothing reports the gap**.

That is the same defect as every other one we removed today — a record that can disagree
with reality, where the disagreement is invisible. A view cannot drift, because there is
nothing to drift from.

It also satisfies "one reader, nothing computes its own number" *structurally* rather
than by discipline: the sentence, the card and the panel are literally the same rows.

**Shape:** a view `business_events`, `UNION ALL` across sources, each contributing a
common envelope — `business_id, event_id, kind, occurred_at, subject_type, subject_id`.
The card's fields are joined from the source row **at read time**, not copied into the
event.

That last point is a feature, not an accident: a booking that is later cancelled renders
as cancelled, instead of a stale "new booking" card claiming something that is no longer
true. The panel cannot be more confident than the card because both read the same row on
the same request.

**Two honest costs of deriving:**

1. **A deleted source row deletes its history.** If a booking row is hard-deleted the
   event vanishes. Acceptable — we do not hard-delete bookings, and the alternative
   (an orphan event pointing at nothing) is worse.
2. **Ordering across heterogeneous sources** needs one comparable timestamp. Each source
   nominates its own `occurred_at` (`booking_requests.created_at`, `jobs.created_at`,
   `chatbot_conversations.started_at`), which is fine as long as none of them is a
   mutable "updated" column. Stated so it stays true when a fourth source is added.

**Access:** a security-definer RPC `get_business_events(p_business_id, p_owner_id)` that
re-reads `businesses.owner_id` and compares — the same pattern as
`get_public_business_places`, and the same reason: the caller's claim about who they are
proves nothing.

## 3. How it knows what has been seen — THE PART THAT DECIDES WHETHER THIS WORKS

You are right that this is the hinge. Without it the stream either repeats forever or
swallows things, and swallowing is the one that loses a booking.

**Proposal: a high-water mark per owner, per business.**

```
business_event_reads (
  business_id  uuid  not null,
  owner_uid    uuid  not null,     -- per OWNER, not per business
  last_seen_at timestamptz not null,
  updated_at   timestamptz not null default now(),
  primary key (business_id, owner_uid)
)
```

An event is **new** when `occurred_at > last_seen_at`. One row per owner, not one row per
(owner, event).

**Why per-owner and not per-business:** two people can own one business. A shared marker
means whoever opens the app first clears the stream for the other, and the second person
never learns a booking arrived. That is the swallow, one level up.

**Why a high-water mark and not per-event read receipts:** receipts need a row per
(owner, event) forever plus a retention policy, and give one capability in exchange —
marking a single item unread while later ones stay read. I do not think that is worth the
second table, but it is a real limitation and it is the one thing this shape cannot do.
Say so now rather than discover it later.

**Three rules that make it safe, all of them learned this week:**

1. **The marker advances only when the owner has actually SEEN the stream** — after
   render, not on page load. Advancing on load means a slow render or a closed tab
   silently marks a booking read.
2. **The marker never moves backwards.** `last_seen_at = greatest(existing, incoming)`,
   enforced in SQL, not in the client. A stale client must not be able to un-see.
3. **A failed read means "nothing seen", never "everything seen".** If the marker cannot
   be read, show every event. The two errors cost different amounts — a repeated card is
   an annoyance, a swallowed booking is a lost customer — so the tie does not go to the
   expensive one. Same asymmetry as never discarding a draft.

## 4. Arriving both ways

- **On open:** query the RPC. One reader.
- **Live:** subscribe to `booking_requests` and `jobs` filtered by `business_id` —
  Realtime is already publishing both. On an insert, re-query the RPC rather than
  rendering from the socket payload, so the live path and the on-open path produce
  identical cards from identical rows. The socket is a *signal that something changed*,
  never a source of truth.

I expect live to work, since the publication already exists. If it does not, on-open
ships alone and I will say so plainly rather than leave a half-working subscription.

## What I need ruled before building

1. **Derive vs. write** — I recommend deriving, for the reasons above. If you want the
   written table instead, that is a legitimate call (it survives source deletion and makes
   history immutable), but it needs a reconciliation check that counts events against
   source rows, or it will drift silently.
2. **`business_timeline_events`** — adopt it as the written stream, or delete it? It is
   empty, unwritten, and its only reader is broken. Leaving it is how a second event
   system gets built next to the first.
3. **`mission_control.ts` selecting `body`** — a real bug, unrelated to this work. File
   it, or fix it in passing?
