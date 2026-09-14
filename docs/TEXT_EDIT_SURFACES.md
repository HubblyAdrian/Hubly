# Can an owner change the words on his own page? — established 2026-09-13

**Read-only audit. Nothing built.** Prompted by Adrian, signed in as the owner:
*"nothing text-wise is changeable"* — while the assistant kept answering
*"that's edited in Edit details."*

## The table

| surface | reachable from | what it edits | which store |
|---|---|---|---|
| **Edit details** — `hcOpenManage`, `platform-home.html:6088` | canvas toolbar, both stores | **Contact** (phone, email, address) · **Hours** (7 days + note) · **Services** (name, price, one-line description) | `businesses` columns, `settings_business_hours` + `meta.hours`, services. **No page text of any kind** |
| **Design** — `hcOpenDesign`, `:6535` | canvas toolbar | five size/spacing knobs | the stored document's `:root` — **freeform only** (`no_document` on classic; the button is now hidden there) |
| **Canvas click-to-edit, headline + subhead** — `hubly.html:53820` | clicking the text on the live canvas | `heroHeadline`, `heroSubhead` only | **`meta.website`** — the CLASSIC store, via `updateDraft` → `patch_business_in_progress(p_website_meta)` |
| **Canvas click-to-edit, freeform** — `directFreeformEdit` → `applyDirectFreeformEdit` | clicking any labelled element | any labelled text on the page | `business_documents.rendered_html` |
| **The assistant (chat)** | typing | facts: services, prices, hours, contact. Freeform page text via the edit capabilities | both stores per capability — but `refuseIfClassicSite` blocks every page-text/layout capability on a classic business |
| **`/dashboard` → the Site editor** — `#v-editor`, `saveStorefront()`, `hubly.html:17098` | **typing the URL.** There is no link to `/dashboard` anywhere in `platform-home.html` — grepped | headline, section titles, service names/prices/descriptions, about, FAQ, reviews, area | `meta.website` + `meta.*` — the CLASSIC store |

## The three findings

### 1. "That's edited in Edit details" is false

`hcClassicScopeLine()` tells the owner *"I can't change the page text from here — that's
edited in Edit details."* **Edit details edits contact, hours and services. It has no page-text
field at all** — no headline, no section title, no about, no tagline. `OwnerRecordEdit`'s kinds
are exactly `contact | hours | service | design`.

So Hubly names a surface that exists and misdescribes what it does. Same family as naming a
control it cannot see: the sentence sends the owner somewhere that cannot do the thing.

### 2. The classic canvas editor is gated off by a premise that is false

`hcBust()`, `platform-home.html:2168`:

```js
editable = !!(hc.draftClaimed && hcIsAuthed() && hc.hasDocument !== false);
```

with the comment: *"hc.hasDocument === false means the CLASSIC archetype path: the inline editor
has nowhere to write, so the affordance is not offered at all rather than painting a save that
never lands."*

**The premise is wrong.** The inline editor posts `hcInlineEdit` → `directEdit` → `updateDraft`,
which writes `websiteMeta.heroHeadline` / `heroSub` with `customHeroHeadline: true` through
`patch_business_in_progress(p_website_meta)` — **into `meta.website`, which is exactly what the
classic renderer reads** (`ensureWebsiteCopy` keeps `w.heroHeadline` when `customHeroHeadline`
is set). The save lands. It was gated off anyway.

This is the missing-door class again, and it is the direct cause of *"nothing text-wise is
changeable."* Two fields, already working, switched off by an assumption.

### 3. For a classic owner, the only real text editor has no door

Everything a classic owner would need — section titles, service descriptions, about, FAQ —
lives in the **`/dashboard` Site editor**, which writes `meta.website` properly and completely.
`HUBLY_PATH_TO_PAGE` maps `/dashboard` → `p-app`. **Nothing in `platform-home.html` links to it.**
An owner who has never been told the URL cannot reach the only surface that edits his own words.

## The answer, per store

- **Freeform — YES.** Click any labelled element on the canvas and type. Whole page reachable.
- **Classic — effectively NO.** Headline and subhead are reachable in principle and switched off
  by finding 2; everything else needs `/dashboard`, which has no link (finding 3); and the chat
  refuses page edits on classic by design. **The only paying customer cannot change the words on
  his own website from anywhere he has been shown.**

Straight to the top of OPEN_FINDINGS.
