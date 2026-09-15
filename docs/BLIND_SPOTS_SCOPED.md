# Two blind spots — shape and price. **Nothing built.**

## 1. The failed booking write

**Where an exception can occur after a human has committed intent but before a row exists.**

`submitBooking()` (`public/hubly.html:43101`) → `complete_abandoned_booking` RPC, falling back to
a direct `booking_requests` insert (`:43334`). The window opens the moment the customer presses
the final button and closes when one of those two writes commits.

| what can throw in that window | leaves a trace today? |
|---|---|
| network drops between press and POST | **no** |
| the RPC throws (bad arg, constraint, RLS) | **no** — the client catches and shows a message |
| the fallback insert also fails | **no** |
| Stripe checkout starts and the customer abandons at Stripe | partial — `booking_requests` may exist with `payment_status` unset |
| the tab closes mid-request | **no** |

**So the honest statement is: a booking that fails before its INSERT is invisible to us, and we
cannot tell "nobody tried" from "somebody tried and we dropped it".** That is exactly the
ambiguity that made Graef's report unresolvable from the database.

**The cheapest honest record.** Not a new table and not telemetry infrastructure:

> **Write the intent row FIRST, at press, with `status='attempting'`, and let the success path
> flip it.** The abandonment path already does something very close — `writeAbandonedBookingRequest`
> exists and turns an abandoned booking into a lead. A press that never reaches `pending` then
> leaves an `attempting` row, and the count of those is the number nobody can currently see.

Price: one migration (a status value + an index), one call site moved earlier, one number to
watch. **Risk:** it puts a row in front of a customer's completed action, so the reply that says
"booked" must key off the FINAL status, never the first — which is the same prohibition-2
discipline as everything else here.

**Cheaper still, if the above is too invasive:** a single `booking_attempt_failures` insert in the
client's catch block, best-effort, never blocking. It records less (no fields the customer had
typed) but costs one table and no change to the happy path. **I would take the first.**

## 2. The turn-outcome blind spot

**A working turn and a dead one look identical in `business_conversations`.**

Only `data.reply` is persisted (`hcPersist`). Not persisted: the no-silence floor's sentence, a
thread view's sentence, the capture re-ask, the chain line, the tab offer, `showMe`'s render.
So a turn that rendered a week grid and a turn that threw both store **one user row and nothing
else** — which is why "take me to my schedule did nothing" could not be diagnosed without Adrian
reproducing it live.

**The shape of the fix:** persist a per-turn OUTCOME, not more speech. One row per turn:
`turn_id, business_id, conversation_id, actions[], surfaced (what the client actually rendered),
client_error`. The client already knows all of it — `hcTurn.said` exists, the receipt is
`data.actions`, and `hcShowTrace`/`hcArrivalTrace` already collect the rest in memory.

**Price:** one table, one best-effort insert at the end of the response handler, and the same
rule as every other notification — **delivery is best-effort, the in-product record is the source
of truth**, so a failed outcome write must never affect the turn.

**What it buys:** "did nothing" becomes answerable from a query instead of from a person
reproducing it. Given this session has now spent three separate rounds on exactly that question,
that is the whole argument.

**What it costs that matters:** it is a row per turn, forever, and it will hold fragments of what
was shown. It needs the same retention treatment `purge_first_turn_text` and
`purge_old_visitor_messages` already have — **and adding it without a purge would be the third
table we grow without one.**

## 3. Proving ONE Google Calendar connection — the swamp, before any work

Asked for before item 3 of the ranking. **7 edge functions, all live code. Zero connections ever.**

| what has to be true | state today | what could stop us |
|---|---|---|
| a Google Cloud project with the Calendar API on | **unknown to me** — I cannot see the console | the project may not exist, or the API may be off |
| OAuth **consent screen** published | **unknown** | if it is in *Testing*, only listed test users can connect, and refresh tokens expire in **7 days** — this alone would explain a working integration with zero connections |
| **verification** for sensitive scopes | **unknown** | `calendar` is a *sensitive* scope. Unverified apps are capped at 100 users and show an unreviewed-app warning; verification is a review with a turnaround measured in weeks |
| redirect URI registered exactly | `google-calendar-oauth-callback` has `verify_jwt = false` in `config.toml`, which is correct for a Google redirect | one character of mismatch is `redirect_uri_mismatch` and nothing else |
| the client secret present in the edge env | **unknown** — and I will not print it | absent = every attempt fails at the exchange |
| token refresh works | `google-calendar-oauth-refresh` exists (33 lines) | a Testing-mode refresh token dying at 7 days looks exactly like "sync stopped working" |

**The cheapest proof, in order, and it is mostly not code:**

1. **Look at the console** — is the project real, the API enabled, the consent screen published or
   in Testing, and the scopes sensitive? That is minutes, and it is Adrian's to do; I cannot see it.
2. **One connection on a test business**, start to finish, watching the callback's own logs.
3. **Read the row back** — `google_calendar_connections` gains one, `google_calendar_events` gains
   some.
4. **Wait a week** and check it still syncs. That is the step that catches Testing mode, and
   nothing shorter does.

**My honest expectation:** the most likely single cause of zero connections is the consent screen
never being published out of Testing — it is the default, it is invisible from the code, and it
produces exactly this symptom. **I would spend fifteen minutes on step 1 before writing anything.**

**And the thing I will not do:** build a calendar of our own to cover for it. MY_DAY.md §6 and §14
are explicit, and a second calendar system would be the two-store defect on the largest possible
object.
