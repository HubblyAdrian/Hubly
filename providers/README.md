# Hubly Provider SDK (planned)

**Status:** Spec only — architecture freeze. Do not invent parallel frameworks.

Every integration is a **Connected App provider plugin**.

## Contract

```ts
export interface ConnectedAppProvider {
  id: string;
  name: string;
  /** Optional SDK version for ecosystem packages */
  version?: string;

  isConfigured(): boolean;
  missingEnv(): string[];

  connect(opts): Promise<HublyProviderResult<…>>;
  disconnect(opts): Promise<HublyProviderResult<…>>;
  sync(opts): Promise<HublyProviderResult<…>>;
  status(opts): Promise<HublyProviderResult<…>>;
  health(opts?): Promise<HublyProviderResult<…>>;

  permissions(): ConnectedAppPermission[];
  capabilities(): ConnectedAppCapability[];
  actions?(): ConnectedAppAction[];

  webhook?(req): Promise<HublyProviderResult<…>>;
  createDesign?(opts): Promise<HublyProviderResult<…>>; // creative
  /** Future generic capability invoke */
  execute?(capability: string, opts): Promise<HublyProviderResult<…>>;
}
```

## Future package layout

```
providers/
  google/
  meta/
  adobe/          ← OAuthService → HttpClient → LightroomClient → Provider (in _shared today)
  canva/
  quickbooks/
  dropbox/
```

**Adobe (live):** see `docs/architecture/ADOBE_LIGHTROOM_API_COMPATIBILITY.md`

```
AdobeOAuthService → AdobeHttpClient → AdobeLightroomClient → AdobeLightroomProvider → Hubly
```

Edge entry: `adobe-lightroom` (actions) + `adobe-oauth-*` (IMS).

Eventually:

```
npm install hubly-provider-meta
npm install hubly-provider-canva
```

## Lock rule

If adding a provider requires changing Intent Engine, Event Bus, Marketplace, or Creative Engine — **stop**. The architecture has been violated.

Allowed changes for a new provider:

1. Provider implementation
2. OAuth Edge Function
3. Capability declaration (catalog SSOT: `hubly-core/connected-apps-catalog.json`)
4. `registerConnectedApp` / bootstrap registration
5. Optional provider-specific UI

See `docs/architecture/CONNECTED_APPS_ARCHITECTURE.md`.
