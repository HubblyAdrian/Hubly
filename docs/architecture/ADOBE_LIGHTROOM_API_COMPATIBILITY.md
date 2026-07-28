# Adobe Lightroom API ↔ Hubly Provider Compatibility

**Sources (official):**
- [Calling a Lightroom API](https://developer.adobe.com/lightroom/lightroom-api-docs/guides/calling-api/) — base `https://lr.adobe.io/v2`, headers `Authorization: Bearer` + `X-API-Key`
- [Manage Content](https://developer.adobe.com/lightroom/lightroom-api-docs/getting-started/manage-content/) — project albums
- [API Change Logs](https://developer.adobe.com/lightroom/lightroom-api-docs/release-notes/) — Update Album (POST), Create Asset, Create Master
- JSON responses are prefixed with `while(1){}` and must be stripped before parse

**Auth:** IMS OAuth (`ADOBE_CLIENT_ID` / `ADOBE_CLIENT_SECRET`) → access token stored in `adobe_lightroom_connections` (service-role only).

## Compatibility table

| Provider Method | Adobe Endpoint | Adobe Status | Hubly Status |
|---|---|---|---|
| `health()` | `GET /v2/health` (+ `X-API-Key` when available) | ✅ Documented | ✅ |
| `status()` | Token vault + `GET /v2/catalog` (verify) | ✅ | ✅ Returns connected, Adobe account, token expiration, last refresh |
| `listAlbums()` | `GET /v2/catalogs/{catalog_id}/albums` (`?subtype=project` for partner albums) | ✅ | ✅ |
| `createAlbum()` | `PUT /v2/catalogs/{catalog_id}/albums/{album_id}` subtype=`project`, `serviceId`=API key | ✅ | ✅ Client-generated UUID without hyphens |
| `renameAlbum()` | `POST /v2/catalogs/{catalog_id}/albums/{album_id}` (same client, subtype project/project_set) | ✅ | ✅ |
| `getAlbum()` | `GET /v2/catalogs/{catalog_id}/albums/{album_id}` | ✅ | ✅ (internal / open helper) |
| `listAssets()` | `GET /v2/catalogs/{catalog_id}/albums/{album_id}/assets` | ✅ | ✅ |
| `getAsset()` | `GET /v2/catalogs/{catalog_id}/assets/{asset_id}` | ✅ | ✅ |
| `downloadEditedAsset()` | `GET /v2/catalogs/{catalog_id}/assets/{asset_id}/renditions/{rendition_type}` | ✅ | ✅ Default rendition `2048` |
| `syncProject()` | list album assets + map metadata into workspace | ✅ (composed) | ✅ Hubly remains system of record |
| `openAlbum()` deep link | — | ❌ No documented deep-link URI | ❌ `UNSUPPORTED_OPERATION` — returns open hint only |
| `uploadPhotos()` | `PUT .../assets/{id}` + `PUT .../assets/{id}/master` | ✅ Adobe supports | ❌ Deferred — `NOT_IMPLEMENTED` (do not fake) |
| `publishGallery()` | — | ❌ Not a Lightroom API | Hubly-local gallery publish (no Adobe required) |

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
