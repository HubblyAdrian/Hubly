# Every button: what Graef's home view actually does

Clicked 2026-09-08 on `graef-click-clone` — a clone of his row, claimed by the test
account, `draft_token` null, no `business_documents`, PII stripped. His own row was never
written to; fingerprint PASS before and after; clone deleted, corpus back to 179.

Format follows `GRAEF_EDITOR_CLICKTHROUGH.md`. **Three outcomes, and today's standard
applies: a control that reports success without a visible effect is BROKEN**, however
cleanly it runs.

## The table

| control | what it actually does | verdict |
|---|---|---|
| Rail → **Home** | Switches to chat-as-the-screen. Renders the live/booking recap. | works |
| Rail → **Website** | Switches to canvas + assistant panel; renders his real classic site (services, gallery, reviews, why-cards). | works |
| **Settings** (gear) | Opens Account / Notifications / Website / Integrations. Email, magic-link note, Sign out, booking-notification channel, the myhubly.app address, Stripe "Not connected" + Connect. | works (Connect Stripe not clicked — outward-facing account action) |
| URL chip / **Visit site** | Opens `graef-click-clone.myhubly.app` in a new tab. | works |
| **Desktop / Mobile** | Canvas reflows to a phone frame and back. | works |
| **Preview booking** | Opens the real 4-step wizard at `?book=1` with all 8 services and prices. | works |
| **Edit details → Save contact** | **Writes `businesses.phone` and it reaches the public page.** Changed to 555-000-1111; a verified-anonymous visitor saw the new number and the old one was gone. | **works — the only write path on the classic side that lands** |
| **Design** | Reports "There's no page to change yet." Correctly detects the missing document and refuses. | works (honest refusal) — but see below |
| **Chat → any rebuild/restyle/headline request** | Refused by the classic-site gate with an honest handoff naming the live URL. | works (honest refusal) |
| **Canvas click-to-edit (text)** | Opens an editor, accepts the change, **repaints the canvas and shows an Undo — and writes nothing anywhere.** "TESTING 12345" appeared in no column: no document, not `name`, `tagline`, `gen_hero_headline`, `about` or `meta`. An anonymous visitor still saw "GRAEF'S AUTOCARE". | **BROKEN — reports success, no effect** |
| **Attach a photo or file** | Not exercised (needs a real file upload). | untested — do not assume |

## The one that is broken, stated plainly

The canvas editor is the headline feature of this view and it is a **silent no-op for
every classic-path business**. It does not error. It repaints, it offers an Undo for a
change that does not exist, and the owner has no way to tell. This is the same class as
`setChrome` reporting "Saved" for a value nothing reads — a control that works in the
sense that it does not throw, and is broken in the only sense that matters.

**Bounded, not universal.** The identical gesture on a document-based clone
(`hearth-j1-clone`, 13 documents) wrote through: `business_documents` 13 -> 15, latest
version 15, and a verified-anonymous visitor saw "TESTING 12345" on the public page. So
the editor works; it is blind to the classic shape specifically. Affected population:
**11 claimed businesses with no document**, including all four market ones.

## No holes in the gate

Every write control that could reach a classic-path page either refuses honestly
(Design, chat) or writes somewhere the classic renderer actually reads (Edit details).
**No write control reported success without effect except the canvas editor**, and that
one bypasses the capability layer entirely — it is a client-side direct-edit path, not a
gated action, which is exactly why the gate does not catch it.

## Two prompts that invite refused actions

Same defect shape as a control that lies, one level up — the product asking for a request
it will decline:

1. **Design panel**: "changing those properly means rebuilding the page, which you can ask
   me to do in the chat." The gate now refuses exactly that.
2. **Website-mode opening line**: "I couldn't update your page's structure just now —
   everything still works, but moving whole sections won't be available until it does."
   Implies a temporary outage; for a classic business it is permanent.

## The hero bar — NOT removed, and why

`#ws-hero-ai-bar` (`public/hubly.html:12350`, placeholder "What can <business> help you
with?") is **not** the assistant inviting Graef to ask for changes. It is the
visitor-facing Website Concierge entry on his PUBLIC site — `ccHeroSubmit()` opens the
customer chat panel and sends the message, i.e. a booking channel seen by strangers,
never by Graef in the owner shell.

It is unconditional markup in the classic renderer, so removing it strips that channel
from **21 classic-path businesses, 4 of them market** (`aquaspeed`,
`bucket-mobile-detailing`, `devdetailing661`, `graefs-autocare`). That is global, not a
cleanup, so it was left in place for Adrian to decide.
