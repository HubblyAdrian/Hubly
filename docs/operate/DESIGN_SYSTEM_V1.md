# Hubly Design System v1

**Status:** Active — required for all new Operate modules  
**Runtime:** `public/journey-os/design-system.js` → `window.HublyDS`  
**Styles:** Existing Operate tokens / classes in `operate-pixel.css` + `journey.css`

---

## Rule #14

**If a UI pattern already exists in Hubly: DO NOT rebuild it.**

1. Reuse the shared `HublyDS` component (or the golden profile / locked module surface).  
2. Only create a new component when an existing one cannot satisfy the use case.  
3. Prefer extending `HublyDS` over copying markup into a module file.  
4. Locked modules (Home · Inbox · Jobs · Leads · Customers · …) are not refactored for DS adoption unless explicitly reopened — new modules consume DS from day one.

---

## Building blocks

| Component | `HublyDS` API | Use for |
|-----------|---------------|---------|
| Lead Card | `leadCard` | Lead lists, pipeline lead rows |
| Customer Card | `customerCard` | Customer lists |
| Job Card | `jobCard` | Job lists / profile job panes |
| Pipeline Card | `pipelineCard` | Kanban cards |
| Timeline | `timeline` | Unified history |
| Activity Feed | `activityFeed` | Recent activity sidebars |
| Search Bar | `searchBar` | Module search |
| Filter Drawer | `filterDrawer` | Filter panels |
| Profile Header | `profileHeader` | Avatar + name rows |
| Status Badge | `statusBadge` | Stage / membership / AI pills |
| Score Ring | `scoreRing` | Health / AI score |
| Metric Card | `metricCard` | KPIs |
| Section Header | `sectionHeader` | In-panel headers |
| Page Header | `pageHeader` | Module page titles |
| AI Insight Card | `aiInsightCard` | In-app AI summaries |
| Notes Panel | `notesPanel` | Notes blocks |
| Attachments Panel | `attachmentsPanel` | Files / docs |
| Action Toolbar | `actionToolbar` | Button rows |
| Quick Action Button | `actionButton` / `quickActionButton` | `data-jos-act` controls |
| Empty State | `emptyState` | Empty copy |

**Golden profile** (not duplicated in DS): `openCustomerProfile` / `#jos-customer-profile` — single customer profile reused from every module.

---

## Load order

```html
<script defer src="/journey-os/design-system.js"></script>
<script defer src="/journey-os/journey.js"></script>
```

MAT / CMV Node runners must `eval` `design-system.js` before `journey.js`.

---

## Versioning

- **v1** ships with Pipeline and later modules.  
- Additive APIs only unless a module reopen requires a breaking change.  
- Document new helpers here when added.
