# OpenAI transport benchmark — Chat Completions vs Responses

**Release Candidate gate for PR #184 — DO NOT MERGE TO `main` until this file has live numbers.**

Generated stub: `2026-07-22T17:14:00.045Z` (no `OPENAI_API_KEY` in this environment).

## Verification (evidence)

| Check | Result |
|---|---|
| Script path | `scripts/benchmark-openai-transport.mjs` |
| File exists | **YES** (verified on disk) |
| Branch on origin | `cursor/openai-responses-transport-2662` @ `250bda5` |
| Contained in stack tip | `cursor/final-ai-migration-2662` @ `d689dd2` (merge commit `1019d55`) |
| `OPENAI_API_KEY` in cloud agent | **NOT SET** |
| Live benchmark | **NOT RUN** |

**Why:** Running the script without a key correctly SKIPs and refuses to invent results. Staging must supply `OPENAI_API_KEY`.

## How to run

```bash
git fetch origin && git checkout cursor/final-ai-migration-2662
OPENAI_API_KEY=sk-… BENCHMARK_RUNS=2 node scripts/benchmark-openai-transport.mjs
```

Compares Chat vs Responses for: Business Build, Website Runtime, Creative Director (+vision), Storefront Chat, Photo Analysis (+vision), Import Offers, Draft Customer Message, Ask AI.

## Merge criteria

Merge **only if** Responses is equal or better on:

1. Success rate (≥ Chat)
2. JSON reliability for JSON tasks (≥ Chat)
3. Vision tasks return usable structured/text output (≥ Chat)
4. Average latency not catastrophically worse (document if >1.5× Chat)
5. Side-by-side outputs look consistent (no empty / truncated / off-contract replies)

## Results

_Awaiting live staging run — blocked on missing `OPENAI_API_KEY`._

## Rollback

`OPENAI_TRANSPORT=chat`
