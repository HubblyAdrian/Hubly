# OpenAI transport benchmark — Chat Completions vs Responses

**Release Candidate gate for PR #184 — DO NOT MERGE until this file has live numbers.**

Generated stub: `2026-07-22T16:02:48.334Z` (no `OPENAI_API_KEY` in this environment).

## How to run

```bash
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

_Awaiting live staging run._

## Rollback

`OPENAI_TRANSPORT=chat`
