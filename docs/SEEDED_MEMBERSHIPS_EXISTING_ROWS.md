# The live rows — what each business would lose, and how its owner finds out

**Adrian's ruling, 2026-09-16:** *"EXISTING LIVE ROWS: do not silently strip what is already
published. Bring me what each affected business would lose and how its owner finds out.
GRAEFS-AUTOCARE READ-ONLY — propose, do not execute; I take that one to him."*

**Nothing in this file has been executed.** The writer is fixed (no new plan carries seeded content);
this is only about the four plans already live.

Re-exported and re-measured **2026-09-16**, after the writer fix, so these are current.

---

## The four live plans, per field

| business | plan | price | name | description | includes |
|---|---|---|---|---|---|
| **graefs-autocare** *(market)* | Monthly Membership | $60 **his** | **SEED** | **SEED** | his |
| **graefs-autocare** *(market)* | Bi-Weekly Membership | $50 **his** | his | **SEED** *(variant)* | **SEED — all three** |
| adrians-lawn-service *(test)* | Lawn Care Plan | **SEED $119** | **SEED** | **SEED** | **SEED** |
| adrians-lawn-service *(test)* | Lawn Club | $100 **his** | his | his | his |

---

## graefs-autocare — **market. READ-ONLY. PROPOSED, NOT EXECUTED.**

### What he would lose, exactly

**Monthly Membership**

| field | today | after |
|---|---|---|
| name | `Monthly Membership` | *(cleared — the card falls back to the word "Membership")* |
| description | `Keep your vehicle showroom ready, every month.` | *(cleared — the card omits the paragraph)* |
| price | **$60** | **$60 — his, untouched** |
| includes | **Full Interior, Full Exterior — his** | **untouched** |

**Bi-Weekly Membership**

| field | today | after |
|---|---|---|
| name | `Bi-Weekly Membership` — **his**, untouched | **untouched** |
| description | `Keep your vehicle showroom ready, bi-weekly.` | *(cleared)* |
| price | **$50** | **$50 — his, untouched** |
| includes | **Monthly wash · Interior refresh · Priority scheduling** | **(cleared — the list disappears)** |

**The Bi-Weekly includes are the whole reason this ruling exists.** Three deliverables a customer can
hold him to, on a market page, under a Join button, that he never said.

### The argument against doing it at all, stated fairly

He has had those three lines on his page for weeks. He may have read them and been happy to deliver
them — in which case they are true, he simply never typed them, and removing them takes a real
selling point off his page with no warning. **That is a genuine harm and it is why this is proposed
rather than done.**

### How the owner finds out — three options, my recommendation last

1. **Strip and tell him afterwards.** Fast, and it is the one thing the ruling forbids: *do not
   silently strip what is already published.* A notice after the fact is still a page that changed
   under him.
2. **Leave it and fix only the writer.** Zero risk to him, and the three unstated promises stay live
   on a market page indefinitely. The defect we just measured stays shipped for the one business it
   actually affects.
3. **ASK HIM — RECOMMENDED. He is a customer Adrian talks to.** One message, and it is not an
   apology, it is a question with a good answer either way:

   > *"Your Bi-Weekly plan lists Monthly wash, Interior refresh and Priority scheduling. Those came
   > from our starter text, not from you — do you actually include them? If yes I'll leave them
   > exactly as they are and mark them as yours. If not, I'll clear them and you can put the real
   > ones in."*

   **Either answer ends with a page that says only what he says.** If he confirms, nothing changes on
   the page and the record stops being a seed. If he does not, we clear three lines he was never
   going to deliver, before a customer books on them.

   **Adrian takes this one to him.** The two SQL statements are written out below and are not run.

```sql
-- NOT RUN. graefs-autocare is read-only to this session.
-- (a) HE CONFIRMS: the text stays on the page, and stops being ours.
--     No page change. There is nothing to execute — the words are already correct; what changes is
--     only that we stop calling them seeded. Recorded here rather than written to the row, because
--     `membershipOffers` has no "he confirmed this" field and inventing one to hold a conversation
--     is the wrong shape. If a provenance field is wanted, that is its own build.
-- (b) HE DOES NOT: clear the three includes and the two descriptions, leave every price and name.
--     One statement, jsonb path writes, no rebuild, no other field touched.
update public.businesses
   set meta = jsonb_set(
         jsonb_set(meta::jsonb,
           '{website,membershipOffers,0,description}', '""'::jsonb, false),
           '{website,membershipOffers,1,description}', '""'::jsonb, false)
             #- '{website,membershipOffers,0,name}'
 where slug = 'graefs-autocare';
-- and the includes, separately, so the two decisions are separable:
update public.businesses
   set meta = jsonb_set(meta::jsonb, '{website,membershipOffers,1,includes}', '[]'::jsonb, false)
 where slug = 'graefs-autocare';
```

**⚠ Read before running either:** these are `jsonb_set` on a **TEXT** column holding JSON
(`businesses.meta` is text, not jsonb — confirmed 2026-09-16), so the result must be cast back to
text or the column type will reject it. **They are written here as the shape of the change, not as
tested statements.** Anything touching Graef gets tested against a copy first.

---

## adrians-lawn-service — **test, and Adrian's own**

`Lawn Care Plan` is **100% seeded in every field** — the name, $119, the description and all three
includes. It is the proof that a fully-seeded plan does ship when nobody edits it, and it is what a
market owner would have had.

`Lawn Club` is entirely his and is not touched by anything here.

**No owner to notify.** It is a test business. **Still not executed** — the writer fix means no new
plan looks like this, and whether to clear the existing one is a decision about a fixture, not about
a person. Say the word and it is one statement.

---

## What is already true, without touching a row

- **No new plan carries any of it.** Verified by driving the product: a new plan on all seven trades
  has no name, no price, no description and no includes, and the website card renders only the
  generic word and the Join button.
- **The repair pass can no longer re-seed.** An empty field is no longer treated as a leak — the
  change that would otherwise have silently undone the other three.
- **The seed is still one press away in the editor**, and pressing it makes the value **his**.
- `npm run check:seeded-content` — **11 legs, `[RULE]`, nine breaks each asserted-applied and run.**
