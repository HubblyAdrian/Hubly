# Git state report — Release Candidate

**Generated:** 2026-07-22 (UTC)  
**Verified against:** `origin` via `git fetch --all --prune` + `gh pr view`

## Current branch

`cursor/release-candidate-audit-2662` (cut from `cursor/final-ai-migration-2662`)

Stack tip previously checked out:

| Field | Value |
|---|---|
| Branch | `cursor/final-ai-migration-2662` |
| Commit | `d689dd2c2f448063dc3984d0a65944c66e8b87f6` |
| Message | Merge OpenAI-only onto Responses stack tip. |
| Tracking | `origin/cursor/final-ai-migration-2662` (in sync) |

```bash
git fetch origin
git checkout cursor/final-ai-migration-2662
# or RC work:
git checkout cursor/release-candidate-audit-2662
```

## PR #184 / #185 / #186

These PRs **exist on GitHub** (not workspace-only).

| PR | Title | State | Head branch | Base branch | Merge commit | On origin? | Merged to `main`? |
|---|---|---|---|---|---|---|---|
| [#184](https://github.com/HubblyAdrian/Hubly/pull/184) | OpenAI Responses transport in HublyAI | **MERGED** | `cursor/openai-responses-transport-2662` | `cursor/final-ai-migration-2662` | `1019d554d828401cc1044196df1b72524f7e0d48` | YES | **NO** |
| [#185](https://github.com/HubblyAdrian/Hubly/pull/185) | Hubly Mission Control — internal platform OS | **MERGED** | `cursor/mission-control-2662` | `cursor/final-ai-migration-2662` | `4fe5b7d12ea412d4ffc8a51f190ded76cb62e6b6` | YES | **NO** |
| [#186](https://github.com/HubblyAdrian/Hubly/pull/186) | OpenAI-only production AI path | **MERGED** | `cursor/openai-only-production-2662` | `cursor/mission-control-2662` | `bc02cf831424a7b659562821496cfcdf936ef588` | YES | **NO** |

### Which branch contains each PR

| PR | Contained in |
|---|---|
| #184 | `origin/cursor/final-ai-migration-2662` (ancestor `1019d55`) · head tip `250bda5` on `origin/cursor/openai-responses-transport-2662` |
| #185 | `origin/cursor/final-ai-migration-2662` (ancestor `4fe5b7d`) · also on `origin/cursor/mission-control-2662` |
| #186 | `origin/cursor/mission-control-2662` @ `bc02cf8` · forward-merged into `origin/cursor/final-ai-migration-2662` @ `d689dd2` |

### Exact checkout commands

```bash
# Stack tip (Responses + HQ + OpenAI-only)
git fetch origin
git checkout cursor/final-ai-migration-2662
git rev-parse HEAD   # expect d689dd2c2f448063dc3984d0a65944c66e8b87f6

# PR #184 head (Responses only, pre-HQ)
git checkout cursor/openai-responses-transport-2662
git rev-parse HEAD   # expect 250bda5c17c2f4abad7fe5d9c10798ffda2b70ef

# PR #185/#186 line (HQ tip includes #186 merge)
git checkout cursor/mission-control-2662
git rev-parse HEAD   # expect bc02cf831424a7b659562821496cfcdf936ef588

# PR #186 head
git checkout cursor/openai-only-production-2662
git rev-parse HEAD   # expect c0964f0da1963e2f9bf00bb01d67ec9047ec2693
```

### Pushed / merged summary

| Branch | Exists on origin | Pushed | Merged into stack tip | Merged into `main` |
|---|---|---|---|---|
| `cursor/openai-responses-transport-2662` | YES | YES | YES (via #184) | NO |
| `cursor/mission-control-2662` | YES | YES | YES (via #185 + forward merge) | NO |
| `cursor/openai-only-production-2662` | YES | YES | YES (via #186 + forward merge) | NO |
| `cursor/final-ai-migration-2662` | YES | YES | (is tip) | NO |

### Related open stack PRs (not merged to main)

| PR | State | Head → Base |
|---|---|---|
| [#182](https://github.com/HubblyAdrian/Hubly/pull/182) | OPEN | `cursor/ai-brain-migration-audit-2662` → `cursor/v1-freeze-calendar-2662` |
| [#183](https://github.com/HubblyAdrian/Hubly/pull/183) | OPEN | `cursor/final-ai-migration-2662` → `cursor/ai-brain-migration-audit-2662` |

## Local-only branches (unrelated leftovers)

These have **no upstream** and are **not** #184/#185/#186:

- `cursor/connector-contracts-2662`
- `cursor/marketplace-phase3-job-labels-2662`

Local tracking behind origin (not unpushed work):

- `cursor/mission-control-2662` (behind 2 — origin has #186 merge)
- `cursor/marketplace-phase5-lite-2662` (behind 5)

**Verdict for Task 1:** #184/#185/#186 and the stack tip are on `origin`. Nothing from those PRs exists only in the workspace. Safe to continue RC audit work.
