# Changelog

Owner-visible behaviour changes. Not a commit log — if a business owner or their
customer would notice it, it belongs here; if only the code changed, it does not.

Newest first.

---

## 2026-08-17

### Payments now create the work

A paid booking becomes a real job on the calendar automatically. Previously the
Stripe payment was recorded and nothing else happened: no job, no calendar entry,
and the owner only found out by opening the app and noticing a pending request.

Bookings paid by card now appear as scheduled work, with the customer linked, the
service resolved, and Google Calendar synced where it is connected. Existing
bookings are unaffected.

### Card payments work again

Card checkout had been failing for every business since a change on 2026-08-16 —
website bookings and store orders both. Stripe was rejecting the request outright,
so customers could not pay at all. Fixed.

### Bookings that owe money are no longer auto-accepted

Hubly automatically accepts bookings from returning customers so they skip the
Leads board. That now happens only when the booking does not owe money that has
not been paid.

- Pay-in-person bookings: unchanged, still auto-accepted.
- Deposit bookings: accepted once the **deposit** clears, not the balance.
- Pay-in-full bookings: accepted once paid.
- Anything Hubly cannot verify — including a deposit collected by phone or text —
  waits for the owner to press Accept.

**What owners will notice:** a small number of bookings that used to appear
automatically will now wait for one click. That is deliberate. The alternative was
confirmed work on the calendar for money that never arrived.

### Booking notifications now fire on real bookings

Owners have been receiving a "New booking request" email for **every customer who
reached the contact step**, whether or not they went on to book — and for real
bookings it arrived minutes before the payment did.

Notifications now send when a booking actually becomes real: when it is paid, or
when a pay-in-person booking is completed. Two consequences:

- **Far fewer emails.** The ones for people who never booked stop entirely. Owners
  who have been living with that noise will notice it go quiet.
- **They say what was paid.** A paid booking now reads "New booking — paid" with
  the amount, instead of "New booking request" with no mention of money.

The "Open Hubly Dashboard" button also went to the marketing homepage; it now
opens the app.

### The "finish your booking" email no longer fires mid-booking

Customers were being emailed "you started booking but haven't confirmed yet — your
spot isn't locked" the moment they reached the contact step, seconds before they
paid. That email no longer sends there. Genuine abandonment follow-up is being
rebuilt to fire when someone actually leaves.

### Internal tags no longer appear in emails or calendar invites

Booking notes were showing internal markers such as `[SMS_CONSENT:yes]` to owners,
in both the notification email and the calendar invite attached to it — where they
were copied into whatever calendar imported the file. Notes now render as the
customer wrote them.

### SMS consent is optional, and only consented leads can be texted

The "text me updates about my booking" checkbox was required to book. It is now
optional — declining does not stop anyone booking, and the business can still call
and email them.

For owners, the **Text** and **Recover Booking** buttons on a lead are disabled
unless that customer agreed to texts, with the reason shown on hover. Call and
Email are always available.

### Per-package payment terms are reachable

Payment terms for an individual package (pay in full, deposit, pay after service)
could be set in the data but had no control anywhere in the interface. The setting
now appears on the package editor on the site canvas, next to the price.

### Booking form on mobile

The action bar at the bottom of the booking steps was cut off on phones, and two
sticky bars could stack on top of each other. Fixed. The "Your info" step also
had its fields in an order that made tabbing jump around; it now runs Full name →
Email → Phone → SMS consent.

### Settings → Integrations shows real connection status

Stripe, Google Calendar and the other integration cards were reporting "Not
connected" regardless of the truth. They now report the real status, and say
"Status unavailable" when it genuinely cannot be checked rather than guessing.

## 2026-08-18

### Fixed — the AI no longer reports success on changes it did not make
Editing your site used to say "Done" whenever the edit was computed, even when
your page was unchanged. Asking for something Hubly cannot do yet — a
background colour, a font — produced repeated confident confirmations and no
change. Hubly now compares your page before and after, says specifically what
it changed ("removed the section 'Ready to make grooming easier'"), and tells
you plainly when it cannot make a change instead of claiming it did.

### Fixed — duplicate messages
"Building the full page now" could appear twice, identically, making it look
like the request had fired twice.

### Not yet possible, and now said out loud
Background colour, font, logo size, per-section tone and a hero background
image have nowhere to be stored, so Hubly cannot change them. It will now say
so. `docs/architecture/WEBSITE_SET_THEME_SCOPE.md` scopes the fix.
