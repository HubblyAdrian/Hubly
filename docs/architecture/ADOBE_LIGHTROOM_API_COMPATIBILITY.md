# Lightroom Capability Matrix (SSOT)

**Purpose:** Source of truth for what Hubly exposes for Adobe Lightroom — Hubly Actions first, Adobe API second.  
UI must use Hubly vocabulary. Never expose raw Adobe endpoint names to owners.

**Sources:** [Calling a Lightroom API](https://developer.adobe.com/lightroom/lightroom-api-docs/guides/calling-api/), [Manage Content](https://developer.adobe.com/lightroom/lightroom-api-docs/getting-started/manage-content/), [API change logs](https://developer.adobe.com/lightroom/lightroom-api-docs/release-notes/).

JSON responses are prefixed with `while(1){}` and must be stripped before parse.  
Auth: IMS OAuth (`ADOBE_CLIENT_ID` / `ADOBE_CLIENT_SECRET`) → tokens in `adobe_lightroom_connections` (service-role only).

## Hubly Feature ↔ Adobe API ↔ Status

| Hubly Feature | Hubly Action | Adobe API | Status |
|---|---|---|---|
| Connect Account | `connectAccount` | IMS OAuth start | ✅ |
| Disconnect Account | `disconnectAccount` | Token revoke + vault clear | ✅ |
| Reconnect Account | `reconnectAccount` | Same as connect (re-auth) | ✅ |
| Refresh Authentication | `refreshAuthentication` | IMS refresh_token | ✅ |
| View Connection Status | `viewConnectionStatus` | Token vault + `GET /v2/catalog` | ✅ |
| View Last Sync | (status / sync panel) | `last_sync_at` + workspace | ✅ |
| View Connected Adobe User | (status) | Profile on connect | ✅ |
| Read Catalog | `readCatalog` | `GET /v2/catalog` | ✅ |
| Verify Catalog Health | `verifyCatalogHealth` | `GET /v2/health` + catalog | ✅ |
| View Catalog Metadata | `readCatalog` | Catalog payload | ✅ |
| Sync Catalog Metadata | `syncCatalogMetadata` | Re-fetch catalog + cache id | ✅ |
| Create Lightroom Project/Album | `createLightroomProject` | `PUT .../albums/{id}` subtype=project | ✅ |
| Rename Album | `renameAlbum` | `POST .../albums/{id}` | ✅ |
| List Albums | `listAlbums` | `GET .../albums` | ✅ |
| View Album | `viewAlbum` | `GET .../albums/{id}` | ✅ |
| Sync Album | `syncAlbum` | List album assets → workspace metadata | ✅ |
| Link Hubly Project ↔ Album | `linkAlbum` | Workspace upsert | ✅ |
| Unlink Album | `unlinkAlbum` | Workspace `unlinked` (Adobe album kept) | ✅ |
| Open Lightroom Project | `openLightroomProject` | — | ❌ Unsupported deep link (honest hint) |
| Browse Photos | `browsePhotos` | `GET .../albums/{id}/assets` | ✅ |
| View Photo | `viewPhoto` | `GET .../assets/{id}` | ✅ |
| Read Metadata | `viewPhoto` / sync map | Asset payload + XMP | ✅ Partial (see mapping) |
| View Favorite Status | sync / browse | `payload.flag` pick/flagged | ✅ |
| View Edited Status | sync / browse | develop / XMP develop | ✅ |
| View Ratings | sync / browse | `payload.rating` | ✅ |
| View Flags | sync / browse | `payload.flag` | ✅ |
| View Keywords | sync / browse | XMP keywords when present | ✅ Best-effort |
| View EXIF / camera / lens / dimensions | sync / browse | XMP / importSource | ✅ Best-effort |
| View Capture Date | sync / browse | `payload.captureDate` | ✅ |
| Export Final Photos | `exportFinalPhotos` | Renditions API | ✅ |
| Download JPEG / Preview | `exportFinalPhotos` (`2048`) | Renditions | ✅ |
| Download Full-Resolution | `exportFinalPhotos` (`full`) | Renditions | ✅ Best-effort (Adobe type) |
| Download Thumbnail | `exportFinalPhotos` (`thumbnail`) | Renditions | ✅ Best-effort |
| Detect Edited vs Original | sync map | develop presence | ✅ |
| Upload RAW / JPEG / folders | `uploadToLightroom` | Create Asset + Master | ⏳ Planned (`NOT_IMPLEMENTED`) |
| Attach uploads to Album | `uploadToLightroom` | Album asset link | ⏳ Planned |
| Update Keywords / Rating / Flags | — | Adobe write support? | 🔬 Research |
| Search Photos | `browsePhotos` + filters | Album assets (+ client filter) | ✅ Client-side filters |
| Filter rating / keyword / edited / favorites | `browsePhotos` | Assets list | ✅ |
| Export edited photos | `exportFinalPhotos` | Renditions | ✅ |
| Generate / send gallery | Hubly gallery | Hubly-local (not LR API) | ✅ Hubly |
| Deliver to client | Hubly deliver | Hubly-local | ✅ Hubly |
| AI: best / blurry / duplicates / missing / social / hero | Hubly AI on synced assets | — | ⏳ Planned |
| Marketing from LR photos (Canva) | Creative Engine | Canva + synced selects | ⏳ Partial (needs photo URLs) |
| Sync Now panel | `syncAlbum` | Composed sync | ✅ |

**Legend:** ✅ shipped · ⏳ planned (honest fail) · ❌ unsupported by Adobe · 🔬 research

## Hubly Actions (product vocabulary)

| Instead of (Adobe) | Hubly Action |
|---|---|
| Download Rendition | Export Final Photos |
| List Assets | Browse Photos |
| GET Album | Open / View Lightroom Project |
| Create Album | Create Lightroom Project |
| OAuth Connect | Connect Adobe Account |

## Asset metadata mapping

| Hubly field | Adobe source |
|---|---|
| favorite | `payload.flag` ∈ `{pick, flagged}` |
| edited | `payload.develop` or develop XMP link |
| rating | `payload.rating` |
| flag | `payload.flag` |
| captureDate | `payload.captureDate` |
| keywords | `payload.xmp` keyword arrays / dc:subject (best-effort) |
| camera / lens | XMP / EXIF fields when present |
| width / height | XMP / import dimensions when present |
| gps | `payload.location` lat/long |

Sync writes counts + asset summaries into `photography_project_workspaces.metadata.lightroom_sync` — **never** overwrites Hubly project name/status/invoices/gallery.

## Provider method ↔ Adobe endpoint (implementation)

| Provider Method | Adobe Endpoint | Adobe Status | Hubly Status |
|---|---|---|---|
| `health()` | `GET /v2/health` (+ `X-API-Key` when available) | ✅ Documented | ✅ |
| `status()` | Token vault + `GET /v2/catalog` (verify) | ✅ | ✅ |
| `getCatalog()` / `readCatalog` | `GET /v2/catalog` | ✅ | ✅ |
| `listAlbums()` | `GET /v2/catalogs/{catalog_id}/albums` (`?subtype=project`) | ✅ | ✅ |
| `createAlbum()` | `PUT /v2/catalogs/{catalog_id}/albums/{album_id}` subtype=`project` | ✅ | ✅ |
| `renameAlbum()` | `POST /v2/catalogs/{catalog_id}/albums/{album_id}` | ✅ | ✅ |
| `getAlbum()` | `GET /v2/catalogs/{catalog_id}/albums/{album_id}` | ✅ | ✅ |
| `listAssets()` / `browsePhotos` | `GET /v2/catalogs/{catalog_id}/albums/{album_id}/assets` | ✅ | ✅ |
| `getAsset()` / `viewPhoto` | `GET /v2/catalogs/{catalog_id}/assets/{asset_id}` | ✅ | ✅ |
| `downloadEditedAsset()` / `exportFinalPhotos` | `GET .../renditions/{rendition_type}` | ✅ | ✅ Default `2048` |
| `syncProject()` / `syncAlbum` | list album assets + map metadata into workspace | ✅ (composed) | ✅ |
| `linkAlbum` / `unlinkAlbum` | Hubly workspace link (Adobe album unchanged on unlink) | ✅ | ✅ |
| `openAlbum()` / `openLightroomProject` | — | ❌ No documented deep-link URI | ❌ `UNSUPPORTED_OPERATION` |
| `uploadPhotos()` / `uploadToLightroom` | `PUT .../assets/{id}` + `PUT .../assets/{id}/master` | ✅ Adobe supports | ❌ Deferred — `NOT_IMPLEMENTED` |
| `publishGallery()` | — | ❌ Not a Lightroom API | Hubly-local gallery |

## Layering

```
AdobeOAuthService          — IMS tokens, refresh, connection vault
        ↓
AdobeHttpClient            — authenticated HTTP + while(1){} JSON strip
        ↓                    (reusable for Express / Photoshop / Frame.io later)
AdobeLightroomClient       — Lightroom path helpers only
        ↓
AdobeLightroomProvider     — Connected App + Project Workspace surface
        ↓
Hubly (Edge + UI)
```

## Favorites / edited mapping

- **Favorite:** asset `payload.flag` ∈ `{ pick, flagged }` (Adobe review flag)
- **Edited:** asset has `payload.develop` and/or develop XMP link present
- Sync writes counts into `photography_project_workspaces.metadata` — never overwrites Hubly project name/status/invoices/gallery

