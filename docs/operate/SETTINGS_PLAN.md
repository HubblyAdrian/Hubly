# Settings — Stage 1 Plan

**Module:** ⚙️ Settings  
**Rules:** #14–23 (especially **#23 — Settings Never Own Business Data**)  
**Mount:** `#v-settings` / `#jos-settings-root`  
**Architecture:** [SETTINGS_ARCHITECTURE.md](./SETTINGS_ARCHITECTURE.md)

## Owns

| Area | Store |
|------|--------|
| Business profile | `S.settingsOs.business` |
| Team users / invitations | `S.settingsOs.team` (+ mirror `S.team`) |
| Platform billing | `S.settingsOs.billing` |
| Integrations OS | `S.settingsOs.integrations` |
| Notifications | `S.settingsOs.notifications` |
| Branding tokens | `S.settingsOs.branding` |
| AI defaults | `S.settingsOs.ai` |
| Security | `S.settingsOs.security` |
| Permissions | `S.settingsOs.permissions` |

## Does not own

Customers · Jobs · Revenue ledger · Services · Reviews · Marketing campaigns

## Tabs

Overview · Business · Team · Billing · Integrations · Notifications · Branding · AI · Security · Permissions
