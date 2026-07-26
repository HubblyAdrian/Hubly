# Module Acceptance Test (MAT)

Standard acceptance report for every Operate module. Prefer **MAT** over informal “smoke pass” language.

## When

After Stage 1 development and self QA — **before merge**. Re-run after any fix that lands during review.

## Runner

Each module should have `scripts/mat-<module>.mjs` that writes `docs/operate/<MODULE>_MAT.md`.

Example:

```bash
node scripts/mat-jobs.mjs
```

## Required report shape

```text
Module Acceptance Test (MAT)

Module:
📅 Jobs & Calendar

Checklist:
N / N

Buttons:
N / N

Tabs:
N / N

Modals:
N / N

Forms:
N / N

Routes:
N / N

Console Errors:
0

Validator:
PASS

Accessibility:
PASS

Responsive:
Desktop ✅
Tablet ✅
Mobile ✅

Deferred:
…

Result

✅ ACCEPTED
```

## Rules

1. **✅ ACCEPTED** only when every counted metric passes and console errors = 0.
2. Deferred Stage 2 items are listed under **Deferred**, not counted as failures.
3. MAT is recorded on the maturity board (`MAT` column) and linked from the module checklist.
4. After merge + OS lock, do not regress MAT without a bug fix or Stage 2 PR.
