# Hubly Operate — Platform Readiness

Track platform-level readiness **alongside** module completion ([MODULE_STATUS.md](./MODULE_STATUS.md)).

| Area | Status | Notes |
|------|--------|-------|
| Navigation | ✅ | Operate nav + view switching |
| Design System | ✅ | HublyDS · Rule #14 |
| Event Bus | ✅ | `HublyEvents` · Rules #17–18 |
| Data Ownership | ✅ | Rules #15 · #19 · #21 · #23 |
| QA Process | ✅ | Spec → Checklist → Dev → QA → MAT → CMV → Lock |
| MAT | ✅ | Per-module acceptance runners |
| CMV | ✅ | Locked-module confirmation |
| Financial Integrity | ✅ | Rule #20 · Revenue ledger |
| AI Confirmation Policy | ✅ | Rule #22 · Ask Hubly architecture |
| Settings ownership | ✅ | Rule #23 · Settings architecture |
| Dual Product Architecture | ✅ | Rule #24 · AI Landing router |
| Integrations | ⏸ | Stage 2 — deferred per module |
| Performance | ⏳ | Not yet a formal gate |
| Accessibility | ⏳ | Not yet a formal gate |
| Security Review | ⏳ | Not yet a formal gate |

## How to use

1. Module board = build progress per Operate module.  
2. This board = cross-cutting platform health.  
3. Do not claim Stage 2 Integrations complete until live.  
4. Performance / Accessibility / Security become gates before broader production hardening — not blockers for Stage 1 OS module locks.
