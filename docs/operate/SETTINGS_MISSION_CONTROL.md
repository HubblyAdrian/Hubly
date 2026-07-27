# Settings Mission Control (⚙️ Stage 1 OS redesign)

Premium control-center dashboard for Hubly Operate Settings. Matches the Mission Control mockup while preserving Rule #23 (config only — never own business data).

## Layout

- `#p-app.jos-settings-mode` Mission Control shell
- Content max-width **1440px**, padding **32px**, background **#F8F9FC**
- White cards, orange accents (`#F97316` / Hubly brand), soft shadows

## Overview composition

1. Header — Settings + Refresh / Ask Hubly
2. Tabs — Overview · Business · Team · Billing · Integrations · Notifications · Branding · AI · Security · Permissions
3. Hero — Control center copy + floating shield / gear art
4. Status KPIs — Business · Team · Plan · Integrations · AI · Security (deep-link to tabs)
5. Mid grid — Platform Checklist (progress) + Recommended Next Steps (+ Forbidden copies note)
6. Bottom — Ask Hubly help banner

## Ownership (unchanged)

- **Owns:** `S.settingsOs` — business, team, billing (platform), integrations OS stubs, notifications, branding, AI defaults, security, permissions
- **Does not own:** Customers · Jobs · Revenue · Services · Reviews · Campaigns
- **Purges:** forbidden entity arrays on every `ensureSettingsOsState()` (Rule #23)

## Backend

### Stage 1 (live in Operate)

- `S.settingsOs` remains the OS source of truth
- Checklist + next steps derived from live config completeness
- All existing `set-*` save / invite / toggle actions preserved

### Stage 2 schema (migration)

`supabase/migrations/20260727130000_settings_mission_control.sql`

Tables: `settings_business`, `settings_team_members`, `settings_roles`, `settings_permissions`, `settings_billing`, `settings_subscriptions`, `settings_notifications`, `settings_branding`, `settings_integrations`, `settings_oauth_tokens`, `settings_security`, `settings_api_keys`, `settings_audit_logs`, `settings_ai`, `settings_organization`, `settings_business_hours`

RLS enabled with owner policies via `businesses.owner_id = auth.uid()`.
Live apply requires authenticated Supabase access.
