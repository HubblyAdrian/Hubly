# The red-proof ledger — GENERATED, DO NOT EDIT

Written by `scripts/redproof-run.mjs` from `docs/red-proof-ledger.json`. Edit the declarations in
the checks, not this file.

**This exists because the evidence used to evaporate.** A break happens in a terminal and survives, if
at all, as prose in a commit message — so *"has this leg ever been shown red alone"* was a question
with a memory instead of an answer. On 2026-09-17 the repo held **252 negative assertions and zero
recorded red-proofs**, which is not 252 unbroken legs; it is a repo with nowhere to put the evidence.

**Ratchet date: 2026-09-18.** A purely-negative leg whose line was last changed on or after
that date MUST declare a break, and `check-negative-legs-declare-a-break.mjs` fails if it does not.
Legs older than that date are grandfathered — there were 78 of them and failing all at once would
have made the rule the first thing anyone switched off.

**Last run: 2026-09-19T03:43:08.169Z** · 80 run(s) recorded.

| status | n | what it means |
| --- | --- | --- |
| **RED ALONE** | 52 | the break fired exactly this leg and nothing else. **This is a red-proof.** |
| COMPOUND | 0 | the break turned this leg red along with others. **Proves nothing about this leg** (L98) — it needs a narrower break |
| NOT RED | 0 | the break was applied and this leg stayed green. **The leg is vacuous, or the break misses it** |
| SKIPPED | 0 | the break could not be applied (text not found, or a db break without `--allow-db`). **Not evidence of anything** |

## Every declared break

| check | leg | status | break | also went red |
| --- | --- | --- | --- | --- |
| `check-a-different-conversation-in-every-tab.mjs` | R5 [SHAPE] the identity load is reachable from outside hcRenderHome | **RED ALONE** | put the identity load back inside hcRenderHome, where R1's guard makes it unreachable on any entry path that is not Home — the rail loses its location and its logo | — |
| `check-address-change-is-said.mjs` | 5 the sentence exists, names the new address | **RED ALONE** | make the sentence point at a control — Hubly does not render the page and cannot know what is on screen, so naming a button is claiming a capability it has not verified | — |
| `check-arrival-in-dom.mjs` | 2c the arrival IS in the thread | **RED ALONE** | speak a second time while the name question is on the floor — a page-view count beside the arrival, which is two composers talking over each other | — |
| `check-baseline-before-schema.mjs` | schema_mode is read from the call | **RED ALONE** | put the literal "json_object" back in place of the value reported by the AI layer — which is what would make every row say json_object after the flag is flipped, and the whole before/after comparison silently wrong | — |
| `check-chain-acknowledgement.mjs` | 7 a real job write was read | **RED ALONE** | add `business.addJob` to the writers that can close the priced-services gap — one wrong entry in HC_GAP_WRITERS, which is how a job write comes to be announced as a price change | — |
| `check-conversation-is-the-surface.mjs` | 12 the name reader answered | **RED ALONE** | make hcOwnerLabelIsEmail return false for an email. The label is still the email and no name is invented, so legs 11 and 12a are untouched — but every surface that asks whether it is holding a credential is now told it is holding a name, which is how 'adriansmithee+ever…' came to be shown to Adrian as his name for a whole session. | — |
| `check-conversation-is-the-surface.mjs` | 6 the day's rows were COUNTED | **RED ALONE** | RESTORE LESSON 86's OWN DEFECT — gate hcGoToPlace on business_places ROWS instead of on content, so a day holding a driveway job and a doctor's appointment is told it 'isn't set up on this account yet'. That sentence was said to a real owner on 2026-09-15 | — |
| `check-conversation-is-the-surface.mjs` | 7 the door returned a receipt | **RED ALONE** | announce the action before the outcome is known — the premature 'Adding X' class, which claims a placement before it has landed | — |
| `check-conversation-is-the-surface.mjs` | 9 the promises rendered | **RED ALONE** | offer a door to an empty room — drop the needs(ctx) gate so every card renders whether its room holds anything or not, which is prohibition 5 inverted | — |
| `check-day-controls-work.mjs` | 2 there IS add-copy | **RED ALONE** | put the dead gesture back in the add-row copy — instruct a double-click, which does not exist on touch, on the surface Adrian was actually looking at | — |
| `check-doors-open-when-needed.mjs` | 1 the scan found creation actions | **RED ALONE** | make the delegation test blind, so every empty-state entry point counts as idle-only — the condition leg 1 exists to detect, without touching the door leg 2 asserts | — |
| `check-editable-set-is-derived.mjs` | 1 [RULE] the markers were found | **RED ALONE** | remove one marker's editor branch — `footer-tag` — so a marker the page renders has nowhere to be edited: the affordance painted over a capability that is not there | — |
| `check-every-check-is-runnable.mjs` | 6 both sides of the comparison were read | **RED ALONE** | make the glob miss a check that a convenience entry names, so a check is reachable ONLY by its hand-written name — the route-list disease, whose failure mode is silent | — |
| `check-every-field-a-renderer-reads-is-returned.mjs` | 1 every field a renderer reads is declared by the reader | **RED ALONE** | drop ig_handle from the allowlist — one of the seven that actually shipped this way. No error, no log, no visible difference: the Instagram link on every public page just stops rendering, because `data.ig_handle || ''` is ''. | — |
| `check-every-field-a-renderer-reads-is-returned.mjs` | 2 the derivation is alive and still sees across script blocks | **RED ALONE** | give each <script> block its own root scope again — the bug this analyzer shipped with. `var currentBusiness` is in one block and `currentBusiness = data` is ~4500 lines later in another, so the assignment resolved to nothing, the row stopped escaping the loading function, and the analyzer reported a smaller field set WITHOUT SAYING IT HAD FAILED. Leg 1 would then pass by looking for less. | — |
| `check-every-field-a-renderer-reads-is-returned.mjs` | 3 every key the migration declares is present in the LIVE function | **RED ALONE** | declare a key in the migration that production does not have. The repository is a CLAIM about production, not production (Lesson 100) — leg 1 reads the migration, so if the migration and the live function disagree, leg 1's pass is about a file. | — |
| `check-every-field-a-renderer-reads-is-returned.mjs` | 4 no field is reached by a computed key, so the derivation is complete on this input | **RED ALONE** | count the `row[0]` unwrap as a computed field read again. It makes the derivation report a blind spot it does not have — and the point of the leg is that a blind spot must be LOUD, so it has to be observable when it is there. | — |
| `check-every-field-a-renderer-reads-is-returned.mjs` | 5 every meta subtree a renderer reads is declared by the reader | **RED ALONE** | drop `hours` from the meta subtree allowlist. Opening hours on every public page, absent, rendering as nothing — no error, no log, a page that loads without them. The seven-field regression one nesting level down, where there are 56 subtrees instead of 31 top-level fields. (The first version of this break named `heroHeadline`, which is in NEITHER list; the runner reported `find matched 0x` and SKIPPED it rather than counting an untested leg as proven — the declaration was wrong, and the ledger said so instead of flattering me.) | — |
| `check-every-field-a-renderer-reads-is-returned.mjs` | 6 the meta derivation is alive — it crosses parseBizMeta and finds no computed key | **RED ALONE** | remove the return-value taint, so a named function that RETURNS the meta object stops carrying it. The chain is data.meta -> parseBizMeta(data.meta) -> applyBizMeta(m) -> m.faqs, and applyBizMeta is where all 55 subtree reads live — so the derivation drops from 56 subtrees to a handful and leg 5 passes by LOOKING FOR ALMOST NOTHING. That is the direction that matters: an empty derivation must never read as 'nothing is missing'. | — |
| `check-live-functions-match-their-migrations.mjs` | every public function's live body matches the last migration that defines it | **RED ALONE** | add a behaviour-neutral expression to get_public_business's live body so it no longer matches its migration — a stand-in for a dashboard edit, which is the thing this check exists to catch | — |
| `check-navigation-destinations.mjs` | 1 the surface registry was read | **RED ALONE** | delete the `quotes` renderer from HC_ROOMS, so a place that can appear in the rail has nothing to render it — a rail row that opens an empty canvas | — |
| `check-navigation-destinations.mjs` | 2 the room registry was read | **RED ALONE** | add a room nothing can reach — a renderer for `store`, which is not a surface, so it is built and doorless: the diagnosis that has been right four times this month | — |
| `check-navigation-destinations.mjs` | 3 [SHAPE] the destinations were resolved | **RED ALONE** | route an existing destination to Home instead of to its own surface, so something lands on a screen that cannot answer for it | — |
| `check-navigation-destinations.mjs` | 4 the count keys were read | **RED ALONE** | make the planner door count by a key no thread view answers — `planner->planner` instead of `planner->day`. THIS IS THE EXACT SHAPE of 'your schedule isn’t set up' said about a room with two jobs on it: the door counts by a different key than it navigates by | — |
| `check-navigation-destinations.mjs` | 5 the default rail was read | **RED ALONE** | offer a place by default that no surface renders — `store: true` in HC_RAIL_DEFAULT, so every new business is given a rail row that opens nothing | — |
| `check-no-mailto-reaches-a-customer.mjs` | no latest stored page carries a mailto | **DECLARED, PROVEN BY HAND** | plant a mailto anchor in a stored page and confirm this leg alone goes red | — |
| `check-no-public-reader-leaks-contacts.mjs` | every anon reader hands back an explicit field list | **RED ALONE** | revert get_public_business to `to_jsonb(b) - 'draft_token'` — the whole-row shape — which is exactly the regression this leg exists to catch | — |
| `check-no-well-known-path-returns-html.mjs` | 1 a path that does not exist returns 404, never a 200 of HTML | **DECLARED, PROVEN BY HAND** | remove the not-real guard from the router, restoring the measured state: every file-shaped path falls through to the SPA and answers 200 with 3MB of hubly.html. Nothing 404s, nothing errors, every page still works, and every consumer that trusts a status code is lied to. | — |
| `check-no-well-known-path-returns-html.mjs` | 2 no client-requested well-known path answers 200 with an HTML document | **DECLARED, PROVEN BY HAND** | — | — |
| `check-no-well-known-path-returns-html.mjs` | 3 every root file in public/ serves ITSELF, byte for byte | **DECLARED, PROVEN BY HAND** | — | — |
| `check-no-well-known-path-returns-html.mjs` | 4 every literal route in vercel.json reaches its own destination | **DECLARED, PROVEN BY HAND** | — | — |
| `check-one-price-one-formatter.mjs` | 1 an unparseable price is REFUSED, never coerced to a number | **RED ALONE** | fall back to parseFloat, which is the obvious implementation and the dangerous one: parseFloat('50 dollars') is 50 and parseFloat('call me') is NaN — so a value the owner did not type gets stored for the first, silently, on a page a customer reads. | — |
| `check-one-price-one-formatter.mjs` | 2 the service price renderer goes through the one formatter | **RED ALONE** | put svcDisplayPrice back to building its own '$' + s.price. It renders identically TODAY, so nothing looks wrong — and the next change to how a price reads happens in one place and not the other, which is how this section came to show three formats at once. | — |
| `check-one-price-one-formatter.mjs` | 3 a price anchor edit goes to the RECORD, not a document text patch | **RED ALONE** | send the price down the plain text-patch path like any other element. The page changes and the `services` row does not — which is exactly the divergence measured on evergreen-yard-care (record 95/220/40, page 111.222.333/$111,222,333/50) and invisible from the page alone. | — |
| `check-one-price-one-formatter.mjs` | 4 [SHAPE] every price on the live page equals its own record value, formatted once | **DECLARED, PROVEN BY HAND** | — | — |
| `check-one-price-one-formatter.mjs` | 5 no shell parses a typed price with a bare Number() or parseFloat | **RED ALONE** | put `Number(priceRaw)` back on the Edit-details ADD row. It is the one control in the owner shell that can create a service, and Number('$95') is NaN — so a price an owner typed perfectly readably gets stored as NaN, silently, at the moment the service is created. | — |
| `check-page-facts-match-the-record.mjs` | the classic renderer still injects the recorded phone | **RED ALONE** | stop the classic hero pill building a tel: link from S.phone, so eleven live pages silently lose the only phone number they show and nothing errors | — |
| `check-postmessage-pairs-are-derived.mjs` | 1 every type the canvas sends is compared by the parent | **RED ALONE** | DELETE the parent's hcFreeformAddService branch. The canvas keeps sending it, nothing matches, and the ONLY working add control in the product silently stops adding — the exact shape hcFreeformLinkEdit shipped in for 16 days. Deleted rather than RENAMED: a rename is the obvious break and it is too wide, because it removes one comparison and introduces another, so it fires leg 2 as well and proves nothing about either (L98). This one changes the sent-but-unhandled set and leaves the handled-but-unsent set untouched. | — |
| `check-postmessage-pairs-are-derived.mjs` | 2 every type the parent compares is sent by the canvas, or declares itself pending | **RED ALONE** | remove the CANVAS-SENDER-PENDING marker from the hcFreeformNodeMove handler. It is a real handler with a real writer and no sender; without the marker that fact is invisible, and with a marker nobody can tell it from a handler whose sender was deleted by accident. | — |
| `check-postmessage-pairs-are-derived.mjs` | 3 the reverse channel pairs too — parent to canvas | **RED ALONE** | rename the parent's hcAuthState send. The canvas never learns the owner is signed in, so click-to-edit never ungates — which is the missing-handshake defect that closed on 2026-08-31, reintroduced from the other end. | — |
| `check-postmessage-pairs-are-derived.mjs` | 4 an unhandled message is LOUD at run time, not a silent else | **RED ALONE** | put the listener's chain back to ending at a bare `}`. Every static pairing leg above still passes — the types still match — while a KNOWN type whose payload guard rejects it goes back to vanishing with no trace. That run-time case is the half a static check cannot see. | — |
| `check-preview-is-a-true-device.mjs` | 1 the device is 1440 CSS px WIDE and its logical height matches the pane | **RED ALONE** | pin the logical height back to the device's fixed 900. The preview still looks plausible, a 100vh hero goes back to measuring a height the pane does not have, and 191px of pane goes back to being beige at an ordinary window size — which is what the ruling ended. | — |
| `check-preview-is-a-true-device.mjs` | 2 the scale never exceeds 1 | **RED ALONE** | remove the 1:1 ceiling, so a pane wider than 1440 upscales the device and shows the owner text BIGGER than a visitor gets — lying in the opposite direction from the clipped fold | — |
| `check-preview-is-a-true-device.mjs` | 3 the scale tracks the pane's WIDTH | **RED ALONE** | put the height fit back into the scale — `min(paneW/dev.w, paneH/dev.h)` — which is the state Adrian reported as 'the website got small': a wider window adds only beige | — |
| `check-preview-is-a-true-device.mjs` | 4 the pane never needs its own scrollbar | **RED ALONE** | restore `align-items:center; overflow:auto` on the wrap — the obvious implementation of a width fit, which puts the WORKSPACE's scrollbar beside the PAGE's and, worse, centres an overflowing frame so its top sits above the scroll origin and cannot be reached at all | — |
| `check-preview-is-a-true-device.mjs` | 5 mobile still renders native-width | **RED ALONE** | make hcIsMobile() always false, so a phone gets the desktop device simulation — a 1440px viewport scaled into a 390px screen, which is the one thing a phone must never do because the phone IS the device | — |
| `check-public-reader-allowlist-is-derived.mjs` | the meta allowlist covers every subtree a renderer reads | **RED ALONE** | drop `website` from the live function's meta allowlist — the single most-read subtree (16 reads) — so the classic page loses its hero and NOTHING errors: the renderer reads undefined. That is the route-list failure mode arriving in a column list, which is why this check exists | — |
| `check-status-words-are-one-vocabulary.mjs` | neither shell holds its own copy of the words | **RED ALONE** | paste the five words back into hubly.html as a literal — the duplication this file exists to prevent, and it is one paste away at all times | — |
| `check-the-landing-never-paints-for-an-owner.mjs` | the account chip is visible once the business is open | **RED ALONE** | make the pre-paint hide unconditional again — `hc-boot-owner` is never removed on a successful owner load, so the sign-out door stays invisible for the life of the page | — |
| `check-the-rail-says-who-you-are.mjs` | 1 a known first name is on its own line ABOVE the business name | **RED ALONE** | put the business name FIRST instead — the owner line is still there, still says exactly what the reader says, still on its own line. Only the order Adrian ruled on is gone, which is the narrowest break that can reach this leg: legs 2 and 3 cannot see it at all. | — |
| `check-the-rail-says-who-you-are.mjs` | 2 no name established renders NOTHING — no node, no placeholder, no email | **RED ALONE** | fall back to the email's local part when the reader returns null, which is exactly the 2026-09-15 bug: a login credential shown to the owner as his name, in the one place he looks to confirm Hubly knows who he is | — |
| `check-the-rail-says-who-you-are.mjs` | 3 the line is EXACTLY what the one reader returns — no second opinion | **RED ALONE** | restyle the name locally after reading it — one line of 'presentation', which is how every second opinion about a person's name starts. It keeps the node, the order, the geometry and the null decision identical, so ONLY the claim that the surface shows what the reader said can detect it. (The real bug it stands for is larger — an email prefix or the auth provider's guess — but a wider break would take legs 1 and 2 down with it and prove nothing.) | — |
| `check-the-sitemap-is-the-record.mjs` | 1 every claimed market business is in the sitemap | **RED ALONE** | lose one business on the way from the record to the XML. Nothing errors and the sitemap still looks exactly like a sitemap; it is quietly shorter by one, and the customer it drops is never submitted to Google. THE BREAK IS AIMED AT api/sitemap.js AND NOT AT THE MIGRATION ON PURPOSE: the first version of this declaration edited the SQL file and came back NOT RED, because this check reads the LIVE function and a file on disk is not the database. A break must land on code the check actually RUNS (Lesson 100, pointed at a red-proof). | — |
| `check-the-sitemap-is-the-record.mjs` | 2 nothing else is in the sitemap — no unclaimed draft, no test, no internal | **RED ALONE** | put a URL in the sitemap that the record does not contain — the shape of submitting an unclaimed draft. Every unclaimed page stamps its own <meta robots> noindex, so this is us telling Google two contradictory things about one URL, and publishing the existence of a draft nobody claimed. Aimed at api/sitemap.js for the same reason as leg 1. | — |
| `check-the-sitemap-is-the-record.mjs` | 3 /sitemap.xml has a route, and it precedes the catch-all | **RED ALONE** | move the route AFTER the catch-all. It is still present, still correct, and completely unreachable — /sitemap.xml goes back to answering with 3MB of hubly.html and a 200, which is the state this whole change exists to end. Presence is not reachability. | — |
| `check-the-sitemap-is-the-record.mjs` | 4 robots.txt names the sitemap | **RED ALONE** | remove the Sitemap: line. The sitemap still serves perfectly and nothing references it, so Google only finds it if someone submits it by hand — and this file is served on every business subdomain, so the line is also the cross-submission that lets one sitemap carry URLs across all those hosts. | — |
| `check-the-sitemap-is-the-record.mjs` | 5 a FAILED read serves no sitemap, never an empty one | **RED ALONE** | answer a failed read with a valid empty <urlset> and a 200 — the shape every empty-reader defect takes. It would be a confident 'there are no business pages' composed out of our own outage, aimed at Google instead of at an owner, and it would deindex every customer. | — |
| `check-the-sitemap-is-the-record.mjs` | 6 [SHAPE] the SERVED bytes are this XML, not the catch-all's HTML | **DECLARED, PROVEN BY HAND** | NO REPO EDIT CAN MOVE THIS LEG — it reads what production serves, and production does not change until a git push. PROVEN BY HAND on 2026-09-18 instead, and the proof is that it was observed RED and then GREEN across one deploy: before the push /sitemap.xml returned http=200 size=3091125 type=text/html (the catch-all), and the first fetch AFTER the push still returned exactly that, then the next returned http=200 size=1498 type=application/xml with 13 <loc> and x-hubly-sitemap-count: 13. That transition is the assertion failing and passing for the reason it claims to catch. | — |
| `check-the-sitemap-is-the-record.mjs` | 7 no internal business is indexable | **DECLARED, PROVEN BY HAND** | — | — |
| `check-the-sitemap-is-the-record.mjs` | 8 the live predicate is the one the shipping migration declares | **RED ALONE** | loosen the migration's predicate to exclude only 'test' — the state before Adrian's ruling. Production still excludes internal, so the repo now DESCRIBES a rule production does not apply. That divergence is invisible from either side alone, and it is the automated half of leg 7: leg 7 reads production, this reads whether the repo still means it. | — |

## Runs

- **2026-09-18T01:23:54.901Z** — 3 break(s) applied · 0 red alone · 0 compound · 3 not red · 1 skipped
- **2026-09-18T01:26:16.711Z** — 3 break(s) applied · 0 red alone · 0 compound · 3 not red · 1 skipped
- **2026-09-18T01:27:40.871Z** — 2 break(s) applied · 1 red alone · 1 compound · 0 not red · 2 skipped
- **2026-09-18T01:28:51.267Z** — 4 break(s) applied · 2 red alone · 1 compound · 1 not red · 0 skipped
- **2026-09-18T01:30:06.548Z** — 4 break(s) applied · 3 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:31:32.325Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 2 skipped
- **2026-09-18T01:32:51.035Z** — 2 break(s) applied · 2 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T01:33:36.757Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:34:54.798Z** — 3 break(s) applied · 2 red alone · 1 compound · 0 not red · 1 skipped
- **2026-09-18T01:36:17.473Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 1 skipped
- **2026-09-18T01:36:47.012Z** — 2 break(s) applied · 1 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:37:04.568Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:38:24.295Z** — 6 break(s) applied · 3 red alone · 3 compound · 0 not red · 0 skipped
- **2026-09-18T01:39:23.110Z** — 5 break(s) applied · 4 red alone · 0 compound · 1 not red · 1 skipped
- **2026-09-18T01:40:34.278Z** — 2 break(s) applied · 2 red alone · 0 compound · 0 not red · 3 skipped
- **2026-09-18T01:40:56.949Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T01:41:16.647Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:41:36.573Z** — 16 break(s) applied · 15 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:45:10.265Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T01:45:39.544Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:46:22.260Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T01:47:05.194Z** — 17 break(s) applied · 16 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T03:06:59.009Z** — 17 break(s) applied · 16 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T04:18:14.627Z** — 17 break(s) applied · 16 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T04:20:45.358Z** — 1 break(s) applied · 0 red alone · 0 compound · 1 not red · 0 skipped
- **2026-09-18T04:25:05.386Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:26:46.284Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T04:27:15.371Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T04:27:44.471Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:30:44.725Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T04:31:06.885Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:35:44.877Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:38:51.975Z** — 3 break(s) applied · 3 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:42:58.028Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T04:43:26.793Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:52:45.459Z** — 1 break(s) applied · 0 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T04:53:46.656Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T04:59:28.771Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T04:59:55.782Z** — 1 break(s) applied · 0 red alone · 0 compound · 1 not red · 0 skipped
- **2026-09-18T05:01:25.876Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T05:02:31.168Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T05:03:15.073Z** — 24 break(s) applied · 23 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-18T05:08:22.668Z** — 22 break(s) applied · 21 red alone · 1 compound · 0 not red · 2 skipped
- **2026-09-18T05:13:27.874Z** — 1 break(s) applied · 1 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T05:13:39.711Z** — 6 break(s) applied · 6 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T05:36:53.387Z** — 5 break(s) applied · 4 red alone · 0 compound · 1 not red · 0 skipped
- **2026-09-18T05:37:39.491Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T05:44:56.036Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T05:45:34.475Z** — 3 break(s) applied · 1 red alone · 2 compound · 0 not red · 0 skipped
- **2026-09-18T05:46:32.295Z** — 3 break(s) applied · 1 red alone · 2 compound · 0 not red · 0 skipped
- **2026-09-18T05:47:06.081Z** — 3 break(s) applied · 3 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T06:24:45.188Z** — 2 break(s) applied · 2 red alone · 0 compound · 0 not red · 2 skipped
- **2026-09-18T06:25:15.554Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T06:25:53.607Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T14:46:18.680Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T16:15:16.531Z** — 5 break(s) applied · 3 red alone · 0 compound · 2 not red · 1 skipped
- **2026-09-18T16:17:17.981Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T18:52:36.083Z** — 6 break(s) applied · 6 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:02:16.493Z** — 2 break(s) applied · 0 red alone · 0 compound · 2 not red · 1 skipped
- **2026-09-18T19:03:04.398Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:04:57.308Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:05:18.974Z** — 2 break(s) applied · 2 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:05:32.677Z** — 3 break(s) applied · 3 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:06:01.441Z** — 3 break(s) applied · 3 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:06:19.026Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:14:21.110Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 1 skipped
- **2026-09-18T19:15:28.581Z** — 6 break(s) applied · 6 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-18T19:33:54.533Z** — 12 break(s) applied · 10 red alone · 2 compound · 0 not red · 0 skipped
- **2026-09-19T03:01:06.428Z** — 12 break(s) applied · 12 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:17:32.700Z** — 0 break(s) applied · 0 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:17:45.858Z** — 4 break(s) applied · 3 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-19T03:18:14.889Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:27:36.684Z** — 3 break(s) applied · 3 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:30:47.702Z** — 5 break(s) applied · 4 red alone · 0 compound · 1 not red · 0 skipped
- **2026-09-19T03:32:09.052Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:33:49.559Z** — 5 break(s) applied · 4 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:34:36.666Z** — 5 break(s) applied · 5 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:36:21.920Z** — 4 break(s) applied · 3 red alone · 1 compound · 0 not red · 0 skipped
- **2026-09-19T03:37:40.501Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 0 skipped
- **2026-09-19T03:43:08.169Z** — 4 break(s) applied · 4 red alone · 0 compound · 0 not red · 0 skipped
