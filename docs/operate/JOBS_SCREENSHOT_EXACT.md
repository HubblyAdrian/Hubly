# Jobs & Calendar — screenshot exact

Operate **Jobs** matches the Jobs & Calendar mock: main Jobs surface + right Calendar / Upcoming / Summary rail.

## Layout

1. **Header** — title + subtitle, Export, + New Job, bell badge, business profile chip  
2. **Filters** — date range, status/services/team/locations, search; source/tags + Clear Filters + Filters  
3. **KPI row** — Total / Completed / In Progress / Scheduled / Revenue with vs-last-30-days deltas  
4. **Tabs** — All Jobs · Scheduled · In Progress · Completed · Canceled  
5. **Table** — Job # + created, customer avatar + email, service + vehicle, date & time icons, status pill, amount, ⋮  
6. **Footer** — Showing X–Y of Z + pagination (5 per page)  
7. **Right rail** — mini calendar (orange today, green job dots), Upcoming Jobs, Jobs Summary  

## Files

- `public/journey-os/journey.js` — `renderJobsPage`, expanded demo seed (~24 jobs), calendar/upcoming/summary widgets  
- `public/journey-os/operate-pixel.css` — `#p-app.jos-pixel.jos-jobs-mode` screenshot styles  

## Not in this surface

Separate full-calendar module chrome and older Jobs layouts are not rendered here — Calendar is the right-rail widget plus “View Full Calendar”.
