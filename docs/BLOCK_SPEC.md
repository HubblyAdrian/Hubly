# The canonical BLOCK spec — read from evergreen-yard-care, not derived

**This is the BLOCK spec, not the services spec** (`docs/SETTLED.md` #1). A service and a
product are **the same card with a different action**: image tile, name, price, action button.
A service block's action is **Book** and opens the booking panel; a product block's action is
**Buy** and opens checkout. **Nothing here may branch on "is this a storefront."**

**Freshness checked 2026-09-13:** evergreen-yard-care is still at **document v162, 31,406
bytes, byte-identical** to what was transcribed. The spec below is not stale and was not
re-transcribed.

## What was service-specific, and what it generalises to

| in the transcription | service-specific? | generalised |
|---|---|---|
| `.cards` grid, `.card`, `.card-body`, `.price`, `.section-kicker`, `.lead`, all CSS | **no** | unchanged — this is the block, and it is the same card either way |
| `.card img` — the image tile | **no** | unchanged. A product photo and a service photo occupy the same slot |
| `<h2 data-hubly-service="Full Service">` | **the ANCHOR NAME is** | `data-hubly-block` for the name element, with `data-hubly-block-kind="service｜product"` on the card. The existing `data-hubly-service` stays as the service value of that kind, so nothing already stamped breaks |
| `<span data-hubly-price="Full Service">$95</span>` | **no** | unchanged — a price is a price |
| `<span>per visit</span>` — the unit beside the price | **no** | unchanged. "per visit", "per cleanup", "each", "per seat" — it is a free unit string either way |
| `<a data-hubly-runtime="card-book" href="…?book=1&svc=Full%20Service">Book Full Service</a>` | **YES — this is the only service-specific part** | **the ACTION is the parameter.** `data-hubly-runtime="card-action"` with `data-hubly-action="book｜buy"`; the href and the label come from the action, not from the block |
| `data-hubly-services-block` on the section | **the name is** | `data-hubly-block-section`, keeping `data-hubly-services-block` as an alias so the contrast rescue, the legibility check and the placement code keep working unchanged |

**So one thing is service-specific: the action.** Everything else — the grid, the card, the
image tile, the name, the price with its unit, the description, the button sitting on the
card's floor via `margin-top:auto`, and every CSS rule — is the block, and is shared.

**The action, as a parameter:**

| kind | action | label | href | panel |
|---|---|---|---|---|
| service | `book` | `Book <name>` | `/?book=1&svc=<name>` | booking panel |
| product | `buy` | `Buy <name>` | `/?buy=1&sku=<name>` | checkout panel |

The href shapes match: one query flag plus one identifier, relative so it resolves against the
business's own host (D-009), and **the panel ruling applies to both** — booking is a panel on
the business's own page, and checkout is the same slot (`SETTLED` #8, #1).

---


**Adrian: *"evergreen slug has how the services should look like, how things should be. we went
off on a beaten path and didn't have to."*** So this is not a proposal. It is a transcription
of `evergreen-yard-care` document **v162**, the section headed SERVICE PLANS — the design that
already exists and already looks right.

## The structure, verbatim

```html
<section data-hc-section="hero" class="plans" aria-labelledby="plans-title">
  <p class="section-kicker">Service plans</p>
  <h1 id="plans-title">Lawns at a good price</h1>
  <p class="lead">Compare the three plans, check the scope, and book the one you need…</p>

  <div class="cards">
    <article class="card">
      <img alt="…" width="1200" height="627" src="…">          <!-- the image TILE -->
      <div class="card-body">
        <h2 data-hubly-service="Seasonal Cleanup">Seasonal Cleanup</h2>
        <div class="price">
          <strong><span data-hubly-price="Seasonal Cleanup">$220</span></strong>
          <span>per cleanup</span>                              <!-- the unit, separate -->
        </div>
        <p data-hubly-desc="…">Leaf removal and a full bed cleanup.</p>
        <a data-hubly-runtime="card-book" target="_top"
           href="https://<slug>.myhubly.app/?book=1&svc=Seasonal%20Cleanup">Book Seasonal Cleanup</a>
      </div>
    </article>
    …
  </div>
</section>
```

Every anchor we already stamp is present and in the right place: `data-hubly-service` on the
NAME, `data-hubly-price` on the price VALUE, `data-hubly-desc` on the description, and the
booking link carries `&svc=<name>` so the panel can preselect — **and must still offer all the
other services, per the panel ruling.**

**One inconsistency in the reference itself, reported not copied:** the first card puts the
`<img>` AFTER `.card-body`; cards two and three put it before. `flex-direction: column` means
card one renders its image at the BOTTOM. Visible in the screenshot. The canonical block puts
the image FIRST in every card unless Adrian rules otherwise.

## The CSS, verbatim

```css
.cards      { display:grid; grid-template-columns:repeat(3, minmax(0,1fr));
              gap:calc(18px * var(--hubly-space-scale,1)); align-items:stretch; }
@media      { .cards { grid-template-columns:minmax(0,1fr); } }      /* one column on narrow */
.card       { background:rgba(255,255,255,.62);
              border:1px solid rgba(47,93,69,.20);
              border-radius:calc(var(--radius) * var(--hubly-radius-scale,1));
              overflow:hidden; box-shadow:var(--shadow);
              display:flex; flex-direction:column; }
.card img   { aspect-ratio:var(--hubly-media-ratio, 16/10); object-fit:cover; background:var(--green); }
.card-body  { padding:calc(22px * var(--hubly-space-scale,1)); display:flex; flex-direction:column; flex:1; }
.card h2    { font-size:clamp(1.35rem, 2.3vw, 1.9rem) /* × type-scale */;
              letter-spacing:-.035em; line-height:1.05; margin-bottom:8px; color:var(--green-deep); }
.price      { display:flex; align-items:baseline; gap:7px; margin-bottom:14px;
              color:var(--green); font-weight:900; }
.price strong { font-size:calc(2.35rem * var(--hubly-type-scale,1)); letter-spacing:-.06em; line-height:1; }
.price span   { font-size:.9rem; font-weight:800; color:#486450; }
.card p     { color:#31473a; font-size:1rem; margin-bottom:22px; font-weight:600; }
.card a     { margin-top:auto;                        /* the button sits on the card's floor */
              display:inline-flex; justify-content:center; align-items:center;
              min-height:48px; padding:12px 16px;
              border-radius:calc(14px * var(--hubly-radius-scale,1));
              background:var(--green); color:var(--white);
              text-decoration:none; font-weight:900; }
.section-kicker { color:var(--green); font-weight:900; text-transform:uppercase;
                  letter-spacing:.08em; font-size:.78rem; margin:0 0 10px; }
.lead       { max-width:720px; margin-bottom:28px; color:#2f4537; font-weight:600; }
```

Its palette, for the substitution rule:
`--green:#2f5d45; --green-deep:#10271c; --white:#fff; --radius:22px;
--shadow:0 18px 45px rgba(16,39,28,.16)`

**THE SUBSTITUTION RULE.** Every services block we emit is this markup and this CSS, with the
BUSINESS'S BRAND COLOUR substituted for `--green` (and a derived deep tone for `--green-deep`).
Not a clone of whatever section happens to be on the page. Not a scored guess. Every value
above that is not a colour — the grid, the 22px body padding, the 48px button floor, the
baseline-aligned price with its unit beside it, `margin-top:auto` — is fixed.

The card also already honours the design knobs (`--hubly-type-scale`, `-space-`, `-radius-`,
`-media-ratio`), so the owner's type/spacing controls keep working on the fixed block for free.

---

## REQUIREMENT — an owner can add a block by hand, on the page, without asking the assistant

**Not an option. Recorded 2026-09-13 by Adrian's ruling, after it was raised more than once and
lost each time.**

Step 9 of the spec — *"add services creates blocks"* — is **two paths, not one**:

1. **The assistant adds a block.** Built 2026-09-13: `setServices` → `applyServicesToFreeform`
   → `addServicesBlock`, and on a page with no services area it builds one in the same move.
2. **The owner clicks a `+` and adds one themselves.** **Not built.** This is the requirement.

The owner's path is not a convenience on top of the assistant's. An owner looking at their own
page and wanting one more block should not have to describe it in a sentence to get it — that
is the same failure as naming a control we cannot see, pointed inward.

### What it costs, measured 2026-09-13

| piece | state |
|---|---|
| block markup + CSS | **ships** — `hubly_services_block.ts`, 568 lines |
| choosing where it goes | **ships** — `pickDonorSection`, `pickChainDonor`, `chainClonedServicesBlock` |
| owner-authorised page write | **ships** — `create_business_document` with `p_owner_id` |
| a capability that inserts one | **ships, but services-only** — `addServicesSection`, one kind, model-invoked |
| a **generic** block insert | **does not exist.** `hubly_freeform.ts` exports `moveFreeformSection` and `deleteFreeformNode` and **no insert** — freeform can move and delete a node, not add one |
| the `+` affordance on the canvas | **does not exist** |

So the work is: **`insertFreeformNode` beside move and delete; generalise the donor-clone from
one kind to N; a structured `blockInsert` branch in `hubly-conversation` beside `designEdit`;
and the affordance.** The hard half — the donor-clone machinery, with 132 measured blocks behind
it — is done. **Costed; not scheduled. Nothing further tonight.**
