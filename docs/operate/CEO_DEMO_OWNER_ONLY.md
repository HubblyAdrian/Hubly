# CEO Demo — owner only

The seeded Operate walkthrough (Pro Shine Detailing) is **not** a customer feature.

## Customers never see it

- `/demo` and `/experience` no longer open CEO demo — they go to Welcome
- `ceo-demo.js` is **not** loaded on every visit (on-demand only)
- No product UI links into CEO demo

## How you open it (owner)

1. Set server env: `HUBLY_CEO_DEMO_KEY=<long-secret>`
2. Open: `https://your-host/hubly-ceo?k=<long-secret>`

Localhost without env:

`http://localhost:PORT/hubly-ceo?k=hubly-local-ceo`

## Implementation

- `api/router.js` injects `window.__HUBLY_CEO_DEMO__` from `HUBLY_CEO_DEMO_KEY`
- `isCeoDemoAuthorized()` requires path `/hubly-ceo` + matching `?k=`
- Valid key sticks in `sessionStorage` for the tab so `#home` navigation keeps working
