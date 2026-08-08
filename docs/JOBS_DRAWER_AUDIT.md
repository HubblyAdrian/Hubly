# Jobs Drawer Audit — P2

Full trace of every button, tab, and field in the Jobs drawer to its actual handler/behavior, per the P0→P1→P2 plan. This is a report only — nothing below has been implemented. Classifications: buttons get **Keep / Merge / Move / Delete**; fields get **Editable / Read-only / Computed / Internal-only**.

## Headline finding: a second, dead implementation of this exact drawer exists

`renderJobWorkspace` (journey.js:18617-18705) + `renderJobsListPanel` (18605) + `jobCardHtml` (18577) — roughly 160 lines — are a **complete second copy** of the Jobs detail view (own Checklist tab, own Photos tab, own Notes UI), sitting right next to the real one (`renderJobDrawer`, 16660). Confirmed by grep: nothing in the file calls `renderJobWorkspace(` or `renderJobsListPanel(` — they're unreachable. Six `handleJobsAct` handlers exist *only* to serve this dead UI and are therefore dead code too: `jobs-note-internal`, `jobs-note-customer`, `jobs-note-voice`, `jobs-product-add`, `jobs-product-del`, `jobs-check-notes-save`.

**Recommendation: Delete** `renderJobWorkspace`, `renderJobsListPanel`, `jobCardHtml`, and the six orphaned act handlers above. This is the single highest-value, lowest-risk simplification in this whole audit — pure deletion, zero behavior change, since nothing live points at any of it.

## Tabs (9 total: Overview, Customer, Services, Photos, Checklist, Messages, Invoice, Timeline, Activity)

| Tab | What it actually shows | Verdict |
|---|---|---|
| **Overview** | The full form (now sectioned: Customer/Job/Assignment/Financial/Notes) | **Keep** — this is the real workhorse now |
| **Customer** | Name/Phone/Email/Address/Vehicle form + Save/Open Customer/Messages buttons | **Merge into Overview.** Every field here now duplicates a field already in Overview's Customer section, edited through the exact same `applyJobEditFormToJob`/`.jos-je-form` mechanism. Two tabs editing the same data through two separate forms is exactly the "two things doing the same job" case worth collapsing. |
| **Services** | Service/Amount/Duration form + Save/"Add Service / Invoice" buttons | **Merge into Overview**, same reasoning — all three fields already live in Overview's Job/Financial sections. |
| **Photos** | Before/After photo grids | **Keep the tab, rebuild the feature.** Upload is fake — `jobs-photo-before`/`-after` don't touch a file picker or any storage; they just push `{id, name:'before-photo.jpg'}` into memory after a fake 150ms delay. "Organize" just reverses the array order. Nothing here has ever persisted a real photo. |
| **Checklist** | Checklist items, add-item input, progress % | **Keep the tab, fix persistence.** The checkbox toggle (`data-jos-check`) and item-add (`jobs-check-add`) both only mutate in-memory `job.checklist` — no `persistJobPatch` call anywhere in that path, and `checklist` isn't a column `loadJobs()` reads from Supabase either. Checklist state is silently lost on refresh, same bug *class* as the P0 issue, just never reported because nobody's checked a box and refreshed mid-session. |
| **Messages** | A paragraph + Open Inbox / Send Reminder / AI Draft Reply buttons — **no message thread is actually shown** | **Move + rebuild.** "Send Reminder" and the footer's "Message" button are the *same handler* (`jobs-message`) — it doesn't compose anything, it just toasts "Opening messages…" and navigates to the global Inbox with no job/customer context carried over. If this tab is going to exist, it should show the real thread (Hubly already has a real Inbox/chats system elsewhere), not a placeholder with three buttons that all do roughly the same weak thing. |
| **Invoice** | Invoice summary or "No invoice yet" + Create/View/Collect Payment/Refund buttons | **Keep the tab, it's mostly a stub.** `jobs-invoice-create` fabricates a local `INV-xxxxxx` id with no real invoices table behind it (not persisted — no `persistJobPatch`, no dedicated write anywhere). `jobs-invoice-view` doesn't open a real invoice view, it just **toasts** the invoice's id/amount/status as text. `jobs-invoice-paid` marks paid locally only. None of this survives a refresh. |
| **Timeline** | `j.timeline` entries | **Merge with Activity** — see below, byte-for-byte identical body. |
| **Activity** | `j.timeline` entries | Same render branch as Timeline (`workspaceTab === 'timeline' \|\| workspaceTab === 'activity'`, journey.js ~16750). Two tab labels, one implementation, no distinction a user could ever notice. **Merge into one tab** (call it Timeline or Activity, not both). |

## Footer buttons (Overview tab, inline mode)

| Button | Real behavior | Verdict |
|---|---|---|
| **Save changes** | Now correctly persists via `persistJobPatch` (P0 fix) | **Keep** |
| **Start** | Sets status → in_progress, persists correctly | **Keep**, but redundant with the Status dropdown now sitting right above it in the Job section — clicking Start and picking "in progress" from Status do the identical thing through two different controls. Worth deciding which is canonical. |
| **Reschedule** | **Not a picker.** Silently pushes the date forward exactly +1 day, no dialog, no confirmation (`job.date = addDaysStr(job.date, 1)`) | **Delete or rebuild.** As it stands this is actively surprising — a user clicking "Reschedule" reasonably expects to pick a new date, not have it silently bumped by one day. The Date field is already directly editable in the Job section now; this button adds a confusing second, worse way to do the same thing. |
| **Complete** | Sets status → completed, marks checklist done, persists, tries to promote the job to a Customer record | **Keep** — this one does real, non-trivial work (customer promotion) that isn't reachable any other way. |
| **Message** | Same weak `jobs-message` handler described under the Messages tab above | **Move into the Messages tab**, per your instinct — it doesn't belong in the footer as a peer to Save/Start/Complete since it doesn't act on *this job* at all, it just navigates away. |

Not in the footer today, but real and working (only reachable from the table's row "⋯" menu): **Pause, Resume, Cancel, Duplicate, Delete** — all correctly call `persistJobPatch`/`persistJobDelete` where relevant. This directly supports your "Save Changes + More Actions ▾" idea: Pause/Complete/Cancel/Duplicate/Delete wouldn't be new work, just wiring already-correct handlers into the drawer. I haven't implemented that consolidation — flagging it as the audit's top footer recommendation for your review, not doing it yet.

## Fields (Overview tab, post-reorganization)

| Field | Classification | Note |
|---|---|---|
| First name, Last name, Phone, Email, Address, Vehicle/Property, Service, Date, Duration, Assigned to, Amount, Status | **Editable** | All confirmed persisting correctly as of P0/P1. |
| **Job #** | Looks Editable, isn't | The table's own schema marks this `editable:false` (it's `jobNumber(job)`, a computed value) — but the drawer form still renders a typeable text input for it. Typing into it mutates a local `job.jobNumber` that's immediately overridden by the computed getter everywhere else and is never persisted. **Should be Read-only in the drawer, matching the table.** |
| **Time** | Looks Editable, isn't | Deliberately excluded from persistence in the P0 fix (free-text "10:00 AM" isn't guaranteed to parse into Postgres's `time` column — same reasoning already documented on the table's Time column). Typing here changes what's displayed this session only. **Should be Read-only until a real time picker exists**, not silently-non-saving. |
| **Notes** | Editable, not yet persisted | Deliberate P1 decision (see Tech Debt below) — saving is blocked on the data-model question, not an oversight. |
| **Quote info line** (Source / Status / Amount) | **Computed / Internal-only** | Parsed live from bracketed tags embedded in the notes string (`parseJobNotesMeta`). Read-only by design. This is exactly the shape of thing that should be real structured fields — see Tech Debt below. |
| Checklist item `done` | Editable, not persisted | Same "looks saved, isn't" pattern as Time/Job#, on the Checklist tab rather than Overview. |

## Tech debt — quote metadata does not belong inside `job.notes`

Confirmed per your instruction not to let the display fix stand in for the real one: `parseJobNotesMeta` (added this pass) strips `[source:...]`/`[QUOTE_STATUS:...]`/`[QUOTE:...]`/`id:...` tags so a human never sees them, and surfaces the quote info as a small read-only line — but the underlying `job.notes` string in Supabase still carries those tags. That's an intermediate fix, not the permanent one.

**Permanent fix, not yet scoped or built:** stop writing quote metadata as embedded notes tags at all. Add real columns — `job.source`, `job.quoteStatus`, `job.quoteAmount` (or equivalent) — and update whichever flow currently tags `job.notes` with `[source:smart_quote]` etc. at creation time (this pass traced the tags to the same convention Leads' quote-tracking already uses in `lead.notes`, but did not pin down the exact job-creation call site that copies a lead/quote's tagged notes into a new job's `notes` — that's the next thing to find). Needs: a small migration (2-3 new `jobs` columns), a fix at whichever creation path currently does the copy, and a follow-up pass to make the drawer's Quote line read real columns instead of parsing text. Not done in this pass — deliberately deferred as a named follow-up, not silently dropped.

## Summary of recommendations (not yet implemented)

1. **Delete** `renderJobWorkspace`/`renderJobsListPanel`/`jobCardHtml` and their 6 orphaned act handlers — dead code, zero risk.
2. **Merge** the Customer and Services tabs into Overview (now that Overview has the same fields, sectioned) — eliminates a duplicate-implementation-of-the-same-edit.
3. **Merge** Timeline and Activity tabs — identical implementation today.
4. **Delete or rebuild** the Reschedule button — currently does something a user wouldn't expect and duplicates the Date field.
5. **Move** the footer Message button into the Messages tab; both currently share one weak handler that doesn't compose anything.
6. **Build "More Actions ▾"** consolidating Pause/Cancel/Duplicate/Delete (already correctly implemented, just not surfaced in the drawer) — validates your original instinct, now backed by confirmation none of it needs new backend work.
7. **Fix Job#/Time/Checklist-done** to either be genuinely Read-only or genuinely persist — right now they're fake-editable, which is a worse trust problem than being visibly read-only.
8. **Rebuild or clearly label unbuilt**: Photos upload, Invoice creation/view/payment, checklist notes — all are local-only mocks today with no real backend, which is a bigger scope of work than this drawer-parity pass and should be a deliberate product decision, not something inferred from an audit.
9. **Tech debt, tracked**: move quote metadata out of `job.notes` into real structured columns (see above).
