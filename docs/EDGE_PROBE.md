# Production Edge Probe

Generated: 2026-07-22T17:55:57.244Z
Project: `https://rtwxxkxpkqdrhclkozma.supabase.co`

DEPLOYED: **24** · MISSING: **6**

| Function | Deploy | HTTP | Body |
|---|---|---|---|
| `ai-advisor` | **DEPLOYED** | 400 | {"error":"business_id and question are required"} |
| `analyze-photos` | **DEPLOYED** | 400 | {"error":"photos array is required"} |
| `booking-confirmed` | **DEPLOYED** | 400 | {"error":"business_id is required"} |
| `chatbot-message` | **DEPLOYED** | 400 | {"error":"business_id is required"} |
| `claim-draft-account` | **DEPLOYED** | 400 | {"error":"Enter a valid email"} |
| `create-booking-checkout` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `create-instant-site-account` | **DEPLOYED** | 400 | {"error":"Enter a valid email"} |
| `creative-director` | **DEPLOYED** | 400 | {"error":"owner_message or inspiration_image is required"} |
| `draft-customer-message` | **DEPLOYED** | 400 | {"error":"purpose must be one of: review_request, win_back, weather_reschedule, chat_followup"} |
| `generate-site` | **DEPLOYED** | 400 | {"error":"business_id and business_name are required"} |
| `google-calendar-connection` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `google-calendar-inbound-sync` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `google-calendar-maintain` | **DEPLOYED** | 401 | {"error":"Unauthorized"} |
| `google-calendar-oauth-callback` | **DEPLOYED** | 302 |  |
| `google-calendar-oauth-start` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `google-calendar-push-job` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `google-calendar-sync` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `google-calendar-webhook` | **DEPLOYED** | 200 |  |
| `hire-crm` | **MISSING** | 404 | {"code":"NOT_FOUND","message":"Requested function was not found"} |
| `hubly-ai-status` | **MISSING** | 404 | {"code":"NOT_FOUND","message":"Requested function was not found"} |
| `hubly-build-business` | **MISSING** | 404 | {"code":"NOT_FOUND","message":"Requested function was not found"} |
| `hubly-daily` | **MISSING** | 404 | {"code":"NOT_FOUND","message":"Requested function was not found"} |
| `hubly-find-pro` | **MISSING** | 404 | {"code":"NOT_FOUND","message":"Requested function was not found"} |
| `import-offers` | **DEPLOYED** | 400 | {"error":"Paste a price list or upload a photo/PDF."} |
| `marketplace` | **DEPLOYED** | 404 | {"error":"Not found","path":[]} |
| `mission-control` | **MISSING** | 404 | {"code":"NOT_FOUND","message":"Requested function was not found"} |
| `send-customer-email` | **DEPLOYED** | 400 | {"error":"to_email and body are required"} |
| `stripe-connect-connection` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `stripe-connect-onboard` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `stripe-webhook` | **DEPLOYED** | 400 | {"error":"Invalid signature"} |

## Classification

- **MISSING (404 NOT_FOUND)** = Infrastructure blocker (not a product bug).
- **DEPLOYED with 400/401/302/503** = Endpoint exists; auth/validation working as designed.
