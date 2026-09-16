# FINDING — sign-in depends on a file from someone else's CDN

**Measured 2026-09-15. Nothing changed. This is the price, not the fix.**

> "If jsdelivr is slow, every owner waits. If it is down, Hubly is down, and the cause is not ours
> to fix or even to see." — Adrian

## The dependency

```html
<script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**Three shells, all of them:** `public/platform-home.html` (the owner shell), `public/hubly.html`
(the public site + booking), `public/marketplace-lite.html`. There is no fallback and no second
source in any of them.

Measured on the live page: the file arrives at **430 ms**, and **before it lands nobody can sign
in** — there is no auth client to ask. 218,610 bytes raw (~56 KB gzipped), a UMD build that defines
a global.

## Two risks, and the second is sharper than the one we started with

**1. Availability.** A third party on the critical path of authentication. If jsdelivr is slow every
owner waits; if it is down, nobody can sign in, and we would learn it from owners rather than from
our own monitoring. We have no measurement of jsdelivr's real-world availability — one sample, one
location, one moment.

**2. Unreviewed version drift — and this one is live right now.** `@supabase/supabase-js@2` is a
**floating major pin**. It resolves to whatever 2.x is newest:

| | version |
|---|---|
| what `node_modules` has (what anything here is developed and tested against) | **2.110.5** |
| what production served at the time of measurement (`x-jsd-version`) | **2.116.0** |

**Nobody chose that difference and nothing in the repo records it.** Any 2.x release reaches every
owner with no deploy, no review, and no test run — on the code path that handles sessions and
tokens. That is a third-party code change shipping to production continuously, and it is the same
class of defect as a status turning green on an assumption: we are reporting a tested system while
serving an untested one.

**And we cannot even pin the bytes.** jsdelivr's own response says, in the file we serve:

> `Do NOT use SRI with dynamically generated files!`

So Subresource Integrity — the one mechanism that would let us detect the file changing underneath
us — is explicitly unavailable on this URL. There is no integrity attribute we can add that would
survive.

## What self-hosting would take

**The pattern already exists.** `public/journey-os/` already serves **19** vendored JS files, and
Vercel serves everything under `public/` as a static asset from our own origin. So the shape is a
file plus three `src` edits.

| step | cost |
|---|---|
| copy the UMD build to `public/vendor/supabase-js-<version>.js` | ~219 KB in the repo |
| change `src` in three shells to the local path | 3 one-line edits |
| deploy | the `public/` path — **a git push to Vercel**, not `functions deploy` |

**What it buys:** the auth path moves to our origin, same-origin and same deploy as the page that
uses it; the version becomes a file in git that changes only when someone changes it; and upgrading
becomes a reviewable commit with a diff.

**What it costs and what could break — honestly:**

- **The version stops updating itself.** Security fixes in `supabase-js` no longer arrive on their
  own. That is the trade: today we get them unreviewed and instantly; self-hosted we get them when
  we look. This is a real loss and it needs an owner, not just a file.
- **Caching changes shape.** jsdelivr is a CDN with its own edge; our asset is served by Vercel's.
  Probably a wash or better (one fewer DNS + TLS handshake to a new origin), but **unmeasured**.
- **Three shells must not drift apart.** If one shell keeps the CDN URL and two move, we have two
  auth libraries of different versions in one product — the "two of almost everything" trap. A
  check should assert that no shell references the CDN URL, or the fix creates the next defect.
- **The version in the filename must match what is tested.** Vendoring 2.110.5 from `node_modules`
  makes dev and prod agree for the first time; vendoring "latest" by hand reintroduces the drift
  with extra steps.

## The version-pinning story, if we do nothing else

Even without self-hosting, `@supabase/supabase-js@2` → `@supabase/supabase-js@2.110.5` is a
one-character-class change to three lines that **ends the unreviewed drift immediately** while
keeping the CDN. It does not fix availability, and it does not give us SRI, but it means the bytes
only change when we change them. Worth noting as the cheap half, since the two risks are separable
and only one of them is live today.

## What is NOT measured

- **jsdelivr's actual availability or latency distribution.** One sample from one machine. The 430 ms
  figure is a warm, good-bandwidth reading and should not be quoted as typical.
- **Whether any owner has ever been affected.** We have no record that would show it — a failed
  script load leaves no row anywhere in Hubly. That absence is itself part of the finding: **if this
  has already cost someone a sign-in, we would not know.**
- **Whether the two versions differ in any way that matters.** 2.110.5 → 2.116.0 has not been diffed.
- **Mobile and cold connections**, where a third-party origin costs most. Not measurable here.

**Not fixed. Measured and reported, per the instruction.**
