# Leads — screenshot exact

Operate **Leads** matches the Leads Dashboard mock: sticky header, status tabs, three-column inbox / workspace / analytics rail.

## Layout

1. **Header** — Leads + subtitle · global search (⌘K) · + New Lead · Bulk Actions · bell badge · profile chip  
2. **Status tabs** — All Leads · New · Contacted · Qualified · Won · Lost · Unqualified (count pills)  
3. **Filters** — search · All Sources / Services / Assignments · More Filters · layout toggle  
4. **Inbox** — count + Newest sort · lead cards · Load More  
5. **Workspace** — identity + Call/SMS/Email/More · Overview tabs · Lead Information + Score · Latest Message · AI recommendation  
6. **Rail** — Lead Status · Assigned To · Add Tags · Lead Summary · Conversion Pipeline · Sources donut  

## Files

- `public/journey-os/journey.js` — `renderLeadsPage`, demo seed (~51 leads / display 57), widgets  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-leads-mode` screenshot styles  

Demo counts (New 12 / Contacted 18 / … / 57 total) show when `allowDemoSeed()`; real CRM data is never invented for live accounts.
