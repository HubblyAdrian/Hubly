# The canonical services block — read from evergreen-yard-care, not derived

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
