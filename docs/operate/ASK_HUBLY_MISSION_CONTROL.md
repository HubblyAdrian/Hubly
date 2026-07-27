# Ask Hubly Mission Control (✨ Stage 1 OS redesign)

Premium AI assistant dashboard for Hubly Operate. Matches the Mission Control mockup while preserving Rule #22 confirmation ownership.

## Layout

- `#p-app.jos-ask-mode` Mission Control shell
- Content max-width **1360px**, padding **32px**, background **#F7F8FB**
- Dark navy hero, white cards, orange primary (`#F97316` / Hubly brand)

## Chat / Overview composition

1. Header — Ask Hubly + subtitle
2. Tabs — Chat · Actions · Memory · Automations · Context · Activity
3. Hero — greeting, prompt input, quick chips, floating robot
4. KPI strip — Customers · Active Jobs · Revenue · Campaigns (deep-link to owners)
5. Mid grid — Conversation + Recent Activity
6. Bottom — Hubly Insight · Popular Actions · Pro Tip (Calendar Stage 2)

## Ownership (unchanged)

- **Reads:** Customers · Leads · Jobs · Revenue · Reports · Marketing · Reviews · Memberships · Storefront
- **Owns:** `S.askHublyOs` conversations, memory, actions, pending, automations, insights, feed
- **Writes:** only via approved action catalog + Rule #22 confirmation

## Backend

### Stage 1 (live in Operate)

- `S.askHublyOs` remains the OS source of truth
- `ahAsk` / `ahProposeAction` / `ahConfirmPending` unchanged
- Insights + activity feed seeded for Mission Control presentation

### Stage 2 schema (migration)

`supabase/migrations/20260727120000_ask_hubly_mission_control.sql`

- `ask_hubly_conversations`
- `ask_hubly_messages`
- `ask_hubly_ai_actions`
- `ask_hubly_insights`
- `ask_hubly_activity_feed`

RLS enabled with owner policies via `businesses.owner_id = auth.uid()`.
Live apply requires authenticated Supabase access.
