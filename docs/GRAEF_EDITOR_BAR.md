# GRAEF'S BAR: MAKE THE EDITOR FULLY WORK FOR A NO_DOC BUSINESS

> # ✅ THE PREMISE IS DEAD — CRITERION 2 IS ALREADY MET
>
> **Measured 2026-09-07 by clicking a clone, not by reading code.** A claimed NO_DOC business
> already gets **the full rail (19 entries, including Website editor), the website editor — which
> opens and renders his page — and all 13 Builder panels.** The home button is there.
>
> **"His manage panel is empty because he is NO_DOC" did not reproduce.** Whatever Graef was
> describing, it is not caused by having no `business_documents` row, and the plan to move him
> onto a document was aimed at a cause that does not exist. (The conversion is separately, and
> permanently, withdrawn — see `docs/GRAEF_CONVERSION.md`.)
>
> What is left is not a missing UI. It is **three defects inside a UI that is already there**, all
> of them broken for everyone: see `docs/EDITOR_DEFECTS_2026-09-07.md`. **His bar is days.**



**The job is no longer to move him to where the editor works.** Conversion is withdrawn — see the
reversal at the top of `docs/GRAEF_CONVERSION.md`. His bar is the **EDITOR UI**: home button,
website editor, all buttons functional. Not AI parity.

---

## STATUS: the click-through has NOT been run. Everything below marked *predicted* is a code
## trace, and a code trace is not evidence.

Two things block it, and neither is a judgement call I should make silently:

1. **No service-role key in this session**, so the clone cannot be seeded.
   `scripts/seed-graef-clone.mjs` is **written and not run** (dry-run default, one INSERT, never
   touches `graefs-autocare`).
2. **Signing in is not something I do.** The clone is therefore seeded with
   `--owner <an existing uid>` — pass Adrian's own, and the clone opens in a session he is
   already signed into. No account is created and no credential is handled.

**To unblock:** `export SUPABASE_SERVICE_ROLE_KEY` (via `read -rs`), then

```
node scripts/seed-graef-clone.mjs --owner d69837c1-bde6-4f90-89ad-56684520717f
node scripts/seed-graef-clone.mjs --owner d69837c1-bde6-4f90-89ad-56684520717f --apply
node scripts/check-graefs-page.mjs --slug graef-clone-2026-09-07 --update
```

`d69837c1-bde6-4f90-89ad-56684520717f` is Adrian's auth uid (`adriansmithee@gmail.com`, created
2026-07-17), looked up over the linked admin connection and corroborated: it is the `owner_id` on
1 existing business. `graefs-autocare` is owned by someone else, `account_kind: market` — the
clone will not collide with him, and the slug `graef-clone-2026-09-07` is free.

**The baseline write path was checked before that third command was handed over.** It is
**per-slug** — `BASELINE = baselines/<SLUG>.json` (`check-graefs-page.mjs:54`), and `--update`
writes only that path — so the clone's fingerprint lands in `baselines/graef-clone-2026-09-07.json`
and the real `graefs-autocare.json` is untouched. **That was not the whole story, though:** the
DEFAULT slug is `graefs-autocare`, so a bare `--update`, or `--update --slug` with the value
dropped, silently fell back to overwriting his baseline. Both now fail closed (exit 1, verified by
exit code rather than the printed word), and overwriting his baseline requires `--i-mean-graef`.

Then I drive the editor in that tab and produce the real list.

**The clone carries every item in `GRAEF_INVENTORY.md`** — the seeder asserts 8 services, 5
why-cards, 3 trust pills (including the blank one), 2 memberships, 2 reviews, 6 FAQ, 7 albums
including the 3 empty ones, 26 images, 21 wizard keys, 7 days of hours, 4 `custom*` flags, and
`ourStory` still `""`, and **refuses to write if any is missing.** A clone that doesn't carry his
content is not a rehearsal.

## THE CLONE IS A PUBLIC PAGE CARRYING A REAL CUSTOMER'S DETAILS — accepted deliberately, with an end time

### `account_kind`

**`test`.** Set explicitly at `seed-graef-clone.mjs:110`, never inherited. Graef's row says
`market`; inheriting it would put a duplicate business into every user/adoption number measured
today — the denominator rule — and into anything reading `account_kind` downstream.

**But `test` is not itself a marketplace filter, and that is worth knowing rather than assuming:**
`marketplace_providers` currently holds **22 `test`**, 9 `market`, 3 `internal` rows. What keeps
the clone out of the marketplace is not its kind — it is that **the seeder inserts into
`businesses` and nothing else.** No `marketplace_providers` row, no bookings, no customers, no
jobs. (Graef has one `marketplace_providers` row; the clone gets none.)

### Would a crawler pick it up? **Yes, if it found the URL. There is no noindex on it.**

| | |
| --- | --- |
| `hcNoIndex()` (`hubly.html:17497`) | adds `<meta name="robots" content="noindex, nofollow">` |
| its only callers | `:17810` and `:17887`, both `if(!data.owner_id)` |
| the clone | **has `owner_id` set** — it must, or it is not a claimed-state rehearsal |
| result | **treated as a real claimed site. No noindex.** |
| `robots.txt` | `User-agent: * / Allow: /` — drafts deliberately not blocked there, "done per-page instead" |
| `X-Robots-Tag` header | none (checked on a live business subdomain) |

**Discovery is the only thing protecting it, and it is thin but real:** `/sitemap.xml` returns
**0 `<loc>` entries** (it serves the SPA shell — the same catch-all bug `robots.txt` was fixed
for, still open for `sitemap.xml`; minor finding, filed here). No public directory lists business
subdomains. Nothing links to the clone. So it is reachable only by someone who knows the URL, or
a crawler that learns the hostname another way.

**That is not "safe", it is "unlikely" — so it gets an end time, not a hope.**

### The name is NOT changed, and that was a bug in my first draft

The seeder originally appended `" (CLONE)"` to the business name. **That would have broken the
comparison the clone exists for** — the fingerprint diffs the page's visible text runs, and the
name is in several of them. Removed. **Fidelity is the point; a clone that reads differently is
not a rehearsal.** The consequence is accepted: the public page is an exact copy of a real
business at a URL he does not control.

### DELETION IS A COMMAND, NOT A MEMORY

Shipped in the same file as creation, and printed loudly at the end of every successful seed:

```
node scripts/seed-graef-clone.mjs --delete graef-clone-2026-09-07 --apply
```

It refuses any slug whose `account_kind` is not `test`, so a mistyped slug can never delete a
real business, and it **re-reads after deleting** to confirm the row is gone rather than trusting
the status code.

**The commitment: the clone is deleted the moment the click-through is done — the same working
session, not "later".** If the click-through is interrupted, the clone is deleted anyway and
re-seeded when work resumes; a half-finished test is not a reason to leave a copy of a customer's
business live.

### Optional belt-and-braces, if you want it before seeding

One line, at both call sites:

```js
if (!data.owner_id || data.account_kind === 'test') hcNoIndex();
```

**It would have to be pushed to Vercel BEFORE the clone is created** — `public/hubly.html` goes
live only via a git push, so seeding first leaves the page exposed in the gap. My read: given the
clone is unlinked, absent from the sitemap, and short-lived, the deletion deadline is the load-
bearing control and this is optional. Say the word and I'll prepare it as its own push.

**PII:** the three real customers in `meta.pipeline.manual` are **redacted** — every key kept,
values replaced with marked placeholders, and the redaction printed. Their shape is what the test
needs; their phone numbers are not. Reviewer names become "Reviewer N"; review *quotes* stay,
because those are his page content.

---

## PREDICTION — and it CORRECTS the expectation, so it matters that it gets tested

> Expectation on the table: *"the editor already handles why-cards, FAQ, memberships, reviews,
> gallery and trust stats — so the confirmed break is services (#54), and the rest may already be
> fine."*

**Mostly right, and wrong about which lane services break in.** From the code:

`public/hubly.html:18486`, in the editor's own save path:

> *"Services live in Service Engine (`meta.service_catalog` via `buildBizMeta` above). **Do not
> write the legacy relational `services` table.**"*

The editor **reads and writes `meta.service_catalog`** and calls the table *legacy*. The
`services`-table read at `:15231` is labelled **"Last-resort"** and only runs when the catalog is
empty. Graef's catalog has 8; the table has 0.

> **So services are predicted to WORK in the website editor** — it never consults the empty table.
> **#54 is not an editor bug. It is the claimed-shell panel and the AI**, which write the
> `services` table that the editor calls legacy. Two writers, opposite conventions, one of them
> explicitly naming the other as legacy.

| surface | services | why |
| --- | --- | --- |
| Website editor (`hubly.html`) | **predicted OK** | reads/writes `meta.service_catalog` |
| Claimed-shell panel (`platform-home.html:4307` → `applyOwnerRecordEdit`) | **predicted BROKEN** | reads/writes the `services` table — 0 rows for him |
| AI `setServices` | **predicted BROKEN** | same table |

### Predicted results for the rest

| content type | predicted | if broken, broken **because NO_DOC**, or **for everyone**? |
| --- | --- | --- |
| Why-choose cards (add/edit/delete) | **OK** | — |
| FAQ | **OK** | — |
| Memberships | **OK** | — |
| Manual reviews | **OK** | — |
| Gallery albums + images | **OK** | — |
| Trust pills | **PARTIAL** — 3 fixed slots (`:35263`), pads blanks, no add/remove | **everyone** |
| Our Story | **OK** | — |
| Owner bio, hero copy, section headings | **OK** | — |
| Hours, contact, social links, service area | **OK** | — |
| Logo / banner / owner photo upload | **OK** | — |
| **Service add via the shell panel** | **BROKEN** | **everyone** whose services live in the catalog — not a NO_DOC problem |
| **Any click-to-edit on the rendered page** | **suspect** | **NO_DOC-specific** — the freeform helpers all require a document |
| **"Add section"** | **BROKEN** | **everyone on the classic renderer** — `SECTION_DEFS:50388` is five fixed types |

**If this holds, Graef's bar is days, not weeks** — one real editor gap (trust pills), one
cross-lane data mismatch (#54, and the fix is to pick a single home for services), and the rest
already working. **That is exactly why it has to be clicked rather than reasoned about.**

---

## THE CLICK-THROUGH — what gets recorded

Every rail entry, every Builder panel, every add / edit / delete on every content type he has.
For each, one of four verdicts:

| verdict | meaning |
| --- | --- |
| **WORKS** | the change landed, survived a reload, and shows on the page |
| **SILENT** | the control ran and nothing changed — the worst kind, and the one no exception catches |
| **ERROR** | it failed and said so |
| **EMPTY** | an empty state shown for content that exists (the #54 signature) |

Two rules carried from earlier scars: **reload and re-read** after every change, because a "Saved."
that never wrote is a defect this codebase already has a scar for (`applyOwnerRecordEdit:4335`);
and **look at the result**, because overlap, clipping and jumping have no assertion.

Then, for every non-WORKS: **NO_DOC-specific, or broken for everyone?** They need different fixes
and conflating them is how one gets fixed and the other stays live.

**Mobile stays unverified.** Claude Code has no 390px viewport and no soft keyboard.

---

## What comes out of this for the product

`docs/AI_CANNOT_BUILD.md` — **14 content types a human can add and the assistant cannot**, 12 of
which the generator has no concept of. That list, not the store gate, is what *"our AI builds it
for them"* actually requires.
