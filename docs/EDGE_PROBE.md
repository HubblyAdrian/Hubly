# Production Edge Probe

Generated: 2026-07-22T21:54:46.356Z
Project: `https://rtwxxkxpkqdrhclkozma.supabase.co`

DEPLOYED: **30** · MISSING: **0**

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
| `hire-crm` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `hubly-ai-status` | **DEPLOYED** | 200 | {"ok":true,"layer":"Hubly Runtime + Business DNA","vision":"Conversation → Understanding → Memory (f |
| `hubly-build-business` | **DEPLOYED** | 400 | {"ok":false,"error":"prompt required"} |
| `hubly-daily` | **DEPLOYED** | 200 | {"ok":true,"phase":"8","daily":{"version":1,"greeting":"Good evening.","ownerName":null,"businessNam |
| `hubly-find-pro` | **DEPLOYED** | 400 | {"ok":false,"error":"prompt required"} |
| `import-offers` | **DEPLOYED** | 400 | {"error":"Paste a price list or upload a photo/PDF."} |
| `marketplace` | **DEPLOYED** | 404 | {"error":"Not found","path":[]} |
| `mission-control` | **DEPLOYED** | 401 | {"error":"Unauthorized"} |
| `send-customer-email` | **DEPLOYED** | 400 | {"error":"to_email and body are required"} |
| `stripe-connect-connection` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `stripe-connect-onboard` | **DEPLOYED** | 400 | {"error":"business_id required"} |
| `stripe-webhook` | **DEPLOYED** | 400 | {"error":"Invalid signature"} |

## Classification

- **MISSING (404 NOT_FOUND)** = Infrastructure blocker (not a product bug).
- **DEPLOYED with 400/401/302/503** = Endpoint exists; auth/validation working as designed.

