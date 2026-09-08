# Test suite triage — 2026-09-08

The suite was permanently red (20 files). A permanently red suite is the same as no suite:
nobody can tell a new failure from the standing noise, so the six checkers built today
protected nothing. Same defect as a checker that never goes red, arriving from the other side.

## Deleted — asserting a surface the product removed

| file | why |
|---|---|
| `dashboard-quick-actions.test.mjs` | Its extraction anchored on `data-i18n="quickActions">Quick actions`, a markup block no longer in hubly.html (only the i18n dictionary entries remain). `openSmartQuote` still exists, so the ACTION survives — the block this test measured does not. |
| `leads-jobs-chrome-match.test.mjs` | Asserted `class="jos-ld-header hub-page-header"`. `jos-ld-header` appears 0 times: the Leads chrome was rewritten. The test defended a chrome convention that no longer exists. |
