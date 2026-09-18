# Findings that rest on the repo alone — never confirmed against a live surface

**2026-09-18. This is what Lesson 100 is worth.** Adrian: *"Tell me which of the findings from the last
three rounds rest on reading the repo alone and have never been confirmed against a live surface. That
list is what this lesson is worth."*

**How each row is classified**, and the classification is the point:

| label | means |
| --- | --- |
| **REPO ONLY** | established by reading code or a migration. Never observed on a surface a person touches. |
| **DB-MEASURED** | established by querying the live database. Stronger than repo-only — it is deployed state — but still not what a person receives. |
| **RIG-MEASURED** | established by driving the real shell in a browser against a DECLARED FAKE backend. Real code paths, no RLS, no session. |
| **LIVE-CONFIRMED** | observed on the surface a person touches — served bytes, or a response body, or a rendered page. |

---

## LIVE-CONFIRMED (the short list, and it is short)

- **Bug 1, the first paint — FULLY LIVE-CONFIRMED 2026-09-18.** The served bytes carry
  `hc-boot-owner` AND Adrian confirmed it is on `<html>` on a **real authenticated load, with no
  landing paint**. Bytes and behaviour both.
- **Bug 2, the conversation fix — FULLY LIVE-CONFIRMED 2026-09-18.** The served bytes carry the mode
  guard AND Adrian saw the Website tab showing its own conversation — *"This is a separate conversation,
  just about Website. Your main chat is on Home."* — with Home's chat absent. Real session, real RLS,
  `hubly-classic-fixture`.
  **These two are the only behaviours in this effort confirmed on a real authenticated session.** Every
  other rig-measured row below still rests on a fake with no RLS.
- **The mailto removal in `hubly.html`** — hero pill and footer row confirmed in served bytes.
- **`get_public_business` returns no `pipeline`** — **confirmed by Adrian in an incognito devtools
  session, 2026-09-18.** The only finding in three rounds established from a real anonymous response
  body. His 24 top-level fields and 40 meta keys matched the live allowlist field for field.

## DB-MEASURED (deployed state, not a person's experience)

- **`meta.pipeline.manual` holds 3 records for `graefs-autocare`**, 5 across 2 claimed businesses.
  Counts and field names only.
- **125 public functions live, 122 match their last defining migration, 0 diverge, 3 have none.**
- **164 of 188 businesses have a live page whose latest version is a `patch`**; 403 patch versions of 648.
- **4 of 208 businesses' pages contradict a recorded contact field** (all test).
- **3 of 66 freeform pages omit their own recorded phone** (all test).
- **8 mailto occurrences across 4 pages, zero on the classic store** — and the correction that the
  classic RENDERER emitted them at render time, which no store sweep could see.
- **`meta.pipeline` is the only private-shaped subtree** across 41 claimed businesses.
- **`document_generation_events` holds zero rows** — no baseline for the json_schema change.
- **`account_kind`: 10 market, 3 internal, 198 test; 4 of 10 market `owner_identified`.**

## RIG-MEASURED (real code, declared fake backend — no RLS, no session)

- Every leg of `check-the-landing-never-paints-for-an-owner` (10), `check-a-different-conversation-in-every-tab` (34), `audit-yes-add-it` (9), and every browser leg in the ten L98 fixes.
- **The limit that matters:** the fake has no RLS and no real JWT. A defect where the product reads a
  row it should not be allowed to see is invisible. `docs/OWNER_VERIFICATIONS.md` §5.1 is the gap.

## REPO ONLY — never confirmed on any live surface

**These are the ones the lesson is about.** Each is a hypothesis with good provenance.

1. **The seven fields restored on 2026-09-18** — `ig_handle`, `fb_url`, `tiktok_handle`, `google_url`,
   `section_order`, `account_kind`. That they are READ by the public renderer is repo-only (a code
   read). **That the social links and section ordering are actually back on a rendered page is
   unconfirmed** — and this is the highest-value row in the list, because it was MY regression and a
   response body cannot show a missing field a renderer wanted. **One incognito load of
   `graefs-autocare.myhubly.app` with the social icons visible would close it.**
2. **`hubly:contact` is dead inside the full-document iframe renderer.** Reasoned from
   `wireHublyDocumentReserved` binding inside `#hc-doc-root`. Never clicked on a real page. It is why
   three patched pages have no email CTA — a decision resting entirely on a code read.
3. **The classic renderer injects the recorded phone** (hero pill + footer from `S.phone`). Asserted
   against source. **Never seen on a rendered classic page** — and 11 businesses with a recorded phone
   and no stored document depend on it entirely.
4. **The mailto ban's effect on future contact blocks.** `hubly_contact.ts` now emits a `<span>`. The
   edge functions are deployed; no page has been generated through the new writer and looked at.
5. **`page-view` is live because `page_loads` has 223 rows.** The rows are DB-measured; that the beacon
   still fires from the current bytes is a code read.
6. **The composer is inert until a business is open.** RIG-measured on a fake; never typed into on a
   real signed-in page.
7. **The tab offer is now per-place.** Same: rig-measured, and the phone's 4-place cap is unverified on
   a real phone (`OWNER_VERIFICATIONS.md` §5.3).
8. **`stripe-webhook` may never have run.** Explicitly UNANSWERABLE from here; Stripe's own delivery log
   is the only source (§5.4).
9. **Every `[SHAPE]` leg asserting a source pattern** — `check-page-facts-match-the-record`'s injection
   leg, `check-public-reader-allowlist-is-derived`'s column leg, the boot-script-above-`<body>` leg.
   All read files. A file can be right and the deployed artefact wrong; only served bytes close that,
   and served bytes are confirmed for `platform-home.html` and `hubly.html` but not for the edge
   functions.

---

## The one-line summary

**Four findings are live-confirmed. Everything else is a code read, a query, or a fake.** The cheapest
thing that would move the most rows down this page is one incognito load of a market business's page
with the social links and phone visible — it would close rows 1 and 3, which are the two where being
wrong costs a real owner a visibly broken page.
