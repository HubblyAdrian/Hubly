# Developer Onboarding

**Version:** 1.0.0  
**Purpose:** A new engineer can extend Hubly without tribal knowledge.

## Day-one path

### 1. Clone & install

```bash
git clone <repo>
cd Hubly
npm install
```

### 2. Understand the architecture (30–45 min)

Read in order:

1. [README](./README.md)  
2. [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)  
3. [AI_LIFECYCLE.md](./AI_LIFECYCLE.md)  
4. [ADR index](../adr/README.md) — especially sole AI entry + memory separation  

### 3. Run the validation suite

```bash
npm run milestone1          # all release gates
npm run check:section16     # intelligence validation + Quality Score
npm test -- tests/hubly-brain.test.mjs
```

Milestone 2 is blocked until 18/18 Pass + Founder Approval (`docs/MILESTONE1_DASHBOARD.md`).

### 4. Build a new expert

Follow [EXPERT_DEVELOPMENT.md](./EXPERT_DEVELOPMENT.md):

- Implement definition + handler  
- `registerExpert` / `HublyPlatform.registerExpert`  
- Prove discover → execute → unregister  
- **Do not** edit `hubly_brain_think.ts` to hardcode the expert  

### 5. Register a capability

Follow [CAPABILITY_GUIDE.md](./CAPABILITY_GUIDE.md):

```bash
npm run check:section11
npm run check:section15
```

### 6. Add a Business DNA package

Follow [BUSINESS_DNA_GUIDE.md](./BUSINESS_DNA_GUIDE.md):

- Build a pack with evidence metadata  
- `HublyPlatform.registerIndustry("pest control", pack)`  
- Confirm `loadBusinessDnaKnowledge({ industry: "pest control" })`  
- Re-run multi-industry checks in Section 16  

### 7. Pass release gates before you merge

| You changed… | Re-run |
|--------------|--------|
| Experts | section 3, 4, 15, 16 |
| Memory | section 5–6, 10, 16 |
| DNA | section 7, 16 |
| Identity / ED | section 2, 13, 16 |
| Registries / Platform | section 11, 15 |
| Mission Control | section 12 |
| Docs | section 17 |

```bash
npm run milestone1
```

## Where things live

| Need | Location |
|------|----------|
| Sole AI gate | `supabase/functions/_shared/hubly_ai.ts` |
| Think pipeline | `hubly_brain_think.ts` |
| Section proofs | `scripts/check-section*.mjs` |
| Architecture docs | `docs/architecture/` |
| ADRs | `docs/adr/` |
| Mission Control docs index | snapshot → `documentation` |

## Definition of done (personal)

You can:

- [ ] Explain why Brain is the only AI entry  
- [ ] Add an expert without touching `think`  
- [ ] Add an industry DNA pack without app UI changes  
- [ ] Register a capability and find it with `whoOwnsCapability`  
- [ ] Run `milestone1` green for sections you touched  
