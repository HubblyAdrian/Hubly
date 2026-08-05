// supabase/functions/_shared/hubly_capability_registry.ts
//
// The Hubly Capability Registry — owned by the Hubly platform, not by any
// one interface. This is Hubly Core infrastructure.
//
// Not the legacy hubly_brain_capabilities.ts. That file belongs to the frozen
// Legacy Brain architecture and must not be extended or reused here — this is
// a deliberately separate, new registry.
//
// Shape: a Capability is a named area of what Hubly can do (Website, Booking,
// CRM, Marketing, ...). A Capability exposes one or more named Actions — the
// concrete, callable operations within it (e.g. Website: analyze, generate,
// update, publish). Consumers (the Hubly Conversation service today; the
// dashboard, Studio, Marketplace, or a future Hubly agent tomorrow) ask
// "which capability solves this?" and then invoke one of its actions. The
// registry doesn't know or care who's asking.
//
// Rules this file exists to satisfy:
// - Every capability and action is defined in exactly one place: this file.
//   Nothing about what a capability does is duplicated anywhere else — any
//   consumer's prompt/UI text describing available capabilities is generated
//   FROM this registry, never hand-written to describe it.
// - This registry dispatches; it never implements. An action's handler either
//   calls an existing backend service (that service remains the source of
//   truth) or, if no real backend exists yet, returns an honest "not real
//   yet" result. `real` must be revisited the moment the underlying
//   capability actually gets built — a stale `real:false` is the same
//   failure mode as fabricated analysis, just delayed.
// - Adding a Hubly Core capability (or a new action on an existing one) means
//   adding one entry here. No consumer's orchestration logic should ever
//   need to change to support it.
//
// Current scope note: capability/action names below cover only what's real
// today (website analysis, and honest stopgaps for social/listing analysis).
// The mapping of these names onto the full 14-group Hubly Core list is not
// finalized — that's a product-design decision, not something to lock in
// here. New capabilities (booking, crm, marketing, ...) get added as they're
// actually built, per "build on demand," not stubbed in speculatively.

const APP_ORIGIN = (Deno.env.get("HUBLY_APP_ORIGIN") || "").trim() || "https://myhubly.app";

export type CapabilityActionArgSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type CapabilityActionResult = {
  ok: boolean;
  /** Did genuine backend work actually happen, or is this a best-effort/limited stopgap? */
  real: boolean;
  /** Honest, human-readable account of what happened — consumers should rely on this and nothing more. */
  summary: string;
  raw?: unknown;
  error?: string;
};

export type CapabilityAction = {
  name: string;
  description: string;
  argsSchema: CapabilityActionArgSchema;
  handler: (args: Record<string, unknown>) => Promise<CapabilityActionResult>;
};

export type Capability = {
  name: string;
  description: string;
  actions: CapabilityAction[];
};

async function callImportAnalyze(type: string, url: string): Promise<any> {
  const res = await fetch(`${APP_ORIGIN}/api/import-analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, url }),
  });
  return await res.json().catch(() => null);
}

// Same reuse pattern as callImportAnalyze above, one function over: the
// booking capability wraps the marketplace Edge Function's real,
// already-production booking_slots/booking_create actions over HTTP,
// exactly like a real customer-facing caller would — no booking logic
// lives here, no calendar/provider logic is touched or duplicated.
async function callMarketplace(action: string, payload: Record<string, unknown>): Promise<any> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/functions/v1/marketplace`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ action, ...payload }),
  });
  return await res.json().catch(() => null);
}

// Same reuse pattern one function over again: the business capability wraps
// the real start_business_in_progress / patch_business_in_progress Postgres
// functions (20260803120000_business_in_progress.sql) directly over
// PostgREST's /rpc/ endpoint — no business-record logic lives here.
async function callBusinessRpc(fn: string, payload: Record<string, unknown>): Promise<any> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) return null;
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

const HUBLY_DOMAIN = (Deno.env.get("HUBLY_PUBLIC_DOMAIN") || "").trim() || "myhubly.app";

const LOGO_EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

type StorageUploadOutcome =
  | { ok: true; url: string }
  | { ok: false; result: CapabilityActionResult };

/**
 * Shared by uploadDraftLogo and uploadDraftHeroImage — the only two places
 * that ever handle raw image bytes, both direct-dispatched outside the
 * model's decision loop for the same reason (see uploadDraftLogo's comment
 * below). Everything about the upload itself lives here once, not
 * duplicated per field.
 */
async function uploadImageToStorage(
  draftId: string,
  imageBase64: string,
  mediaType: string,
  fileLabel: string,
): Promise<StorageUploadOutcome> {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, result: { ok: false, real: false, summary: "Storage isn't configured right now.", error: "storage_unconfigured" } };
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(imageBase64.replace(/^data:[^,]+,/, ""));
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes.length < 16) throw new Error("too small to be a real image");
  } catch {
    return { ok: false, result: { ok: false, real: false, summary: "That image couldn't be read.", error: "invalid_image_data" } };
  }

  const type = (mediaType || "image/png").trim().toLowerCase();
  const ext = LOGO_EXT_BY_MEDIA_TYPE[type] || "png";
  const path = `drafts/${draftId}/${fileLabel}-${Date.now()}.${ext}`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/brand-assets/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": type,
      "x-upsert": "true",
    },
    // Deno's runtime fetch accepts a Uint8Array body fine — this cast is
    // purely for the DOM lib typings used here, not a runtime concern.
    body: bytes as unknown as BodyInit,
  });
  if (!uploadRes.ok) {
    return { ok: false, result: { ok: false, real: false, summary: "The image could not be uploaded right now.", error: "storage_upload_failed" } };
  }
  return { ok: true, url: `${supabaseUrl}/storage/v1/object/public/brand-assets/${path}` };
}

/**
 * Uploads a draft's logo directly to real Storage (the same brand-assets
 * bucket the authenticated editor uses — see hostBrandImage/uploadBrandAsset
 * in public/hubly.html) and patches the real businesses.logo_url.
 *
 * Deliberately NOT a CapabilityAction the model invokes via the JSON tool
 * schema, unlike everything else in this file. A model cannot reliably
 * reproduce a multi-KB base64 image as generated output — asking it to
 * would risk silently corrupting the upload, which is worse than not
 * offering the tool at all. The image bytes are supplied directly by the
 * client and passed straight through server-side (hubly-conversation/
 * index.ts calls this directly, outside the model's decision loop) — the
 * model only ever sees and narrates the real result afterward, the same
 * CAPABILITY RESULT convention as every other action here.
 */
export async function uploadDraftLogo(
  draftId: string,
  draftToken: string,
  imageBase64: string,
  mediaType: string,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to attach a logo to.", error: "missing_draft" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "logo");
  if (!uploaded.ok) return uploaded.result;

  const r = await callBusinessRpc("patch_business_in_progress", {
    p_id: draftId,
    p_draft_token: draftToken,
    p_patch: { logo_url: uploaded.url },
    p_website_meta: null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The logo uploaded but couldn't be attached to the business — the draft may have already been claimed.", error: "rpc_failed" };
  }
  const siteUrl = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real logo uploaded and live — ${siteUrl} now shows it in the header.`,
    raw: { id: r.id, slug: r.slug, url: siteUrl, logoUrl: uploaded.url },
  };
}

/**
 * Same shape as uploadDraftLogo, for the hero image specifically — the
 * canvas's inline "click the hero photo" edit. banner_url alone isn't
 * enough to make the renderer actually show it: wsPageEl('ws-hero-media')
 * only paints a photo when S.headerMode is also 'banner' (confirmed by
 * reading hubly.html directly, not assumed) — meta.headerMode is set here
 * in the same patch, the same way meta.businessType already is.
 */
export async function uploadDraftHeroImage(
  draftId: string,
  draftToken: string,
  imageBase64: string,
  mediaType: string,
): Promise<CapabilityActionResult> {
  if (!draftId || !draftToken) {
    return { ok: false, real: false, summary: "No draft business exists yet to attach a hero image to.", error: "missing_draft" };
  }
  const uploaded = await uploadImageToStorage(draftId, imageBase64, mediaType, "hero");
  if (!uploaded.ok) return uploaded.result;

  const r = await callBusinessRpc("patch_business_in_progress", {
    p_id: draftId,
    p_draft_token: draftToken,
    p_patch: { banner_url: uploaded.url, header_mode: "banner" },
    p_website_meta: null,
  });
  if (!r || r.ok !== true) {
    return { ok: false, real: false, summary: "The image uploaded but couldn't be attached to the business — the draft may have already been claimed.", error: "rpc_failed" };
  }
  const siteUrl = `https://${r.slug}.${HUBLY_DOMAIN}`;
  return {
    ok: true,
    real: true,
    summary: `Real hero image uploaded and live — ${siteUrl} now shows it.`,
    raw: { id: r.id, slug: r.slug, url: siteUrl, bannerUrl: uploaded.url },
  };
}

function isValidUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const urlArgSchema = (description: string): CapabilityActionArgSchema => ({
  type: "object",
  properties: { url: { type: "string", description } },
  required: ["url"],
});

const bookingArgSchema = (
  extra: Record<string, { type: string; description: string }>,
  required: string[],
): CapabilityActionArgSchema => ({
  type: "object",
  properties: {
    businessId: {
      type: "string",
      description:
        "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here (e.g. \"current_business\"); do not decline to invoke just because you don't have a real business id.",
    },
    ...extra,
  },
  required: ["businessId", ...required],
});

/** Shared by the three social/listing actions — none have a real integration yet. */
function socialStopgapHandler(platform: "facebook" | "instagram" | "google_business") {
  return async (args: Record<string, unknown>): Promise<CapabilityActionResult> => {
    const url = String(args?.url || "").trim();
    if (!isValidUrl(url)) {
      return { ok: false, real: false, summary: "No valid URL was provided.", error: "invalid_url" };
    }
    const r = await callImportAnalyze(platform, url);
    const handle = r?.analysis?.handle || "";
    // Deliberately ignore r.analysis.note / r.analysis.queued from the legacy
    // analyzer — those claim work ("enrichment continues in Builder") that
    // never actually happens anywhere in this codebase today.
    const label = platform === "google_business" ? "Google Business" : platform === "facebook" ? "Facebook" : "Instagram";
    return {
      ok: true,
      real: false,
      summary: `No live integration exists for ${label} yet, so its content could not be read. Only the link itself was recognized${handle ? ` (handle: "${handle}")` : ""}.`,
      raw: { platform, handle, profileUrl: url },
    };
  };
}

export const HUBLY_CAPABILITY_REGISTRY: Capability[] = [
  {
    name: "website",
    description: "Build and manage a business's website.",
    actions: [
      {
        name: "analyze",
        description:
          "Fetches and reads a real, existing website: title, description, headings, service-like content, contact details, and dominant brand colors. This one is real and works today.",
        argsSchema: urlArgSchema("The business's website URL to read."),
        handler: async (args) => {
          const url = String(args?.url || "").trim();
          if (!isValidUrl(url)) {
            return { ok: false, real: false, summary: "No valid URL was provided.", error: "invalid_url" };
          }
          const r = await callImportAnalyze("website", url);
          if (!r?.ok || r.partial) {
            return {
              ok: true,
              real: false,
              summary: "The website could not be reached, so nothing was actually read from it.",
              raw: r?.analysis || null,
            };
          }
          return {
            ok: true,
            real: true,
            summary:
              "Real content was fetched and read from this website — title, description, headings, service-like list items, contact details, and dominant colors.",
            raw: r.analysis,
          };
        },
      },
      // generate / update / publish actions land here once their backend
      // capabilities exist as callable services — not stubbed speculatively.
    ],
  },
  {
    name: "online_presence",
    description: "Help a business be found — website, business listings, and social presence.",
    actions: [
      {
        name: "analyze_facebook",
        description:
          "Looks at a Facebook page URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Facebook page URL."),
        handler: socialStopgapHandler("facebook"),
      },
      {
        name: "analyze_instagram",
        description:
          "Looks at an Instagram profile URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Instagram profile URL."),
        handler: socialStopgapHandler("instagram"),
      },
      {
        name: "analyze_google_business",
        description:
          "Looks at a Google Business Profile URL. No live integration exists yet — this can only recognize the link itself, not read its content. Always disclose that limitation honestly.",
        argsSchema: urlArgSchema("The business's Google Business Profile URL."),
        handler: socialStopgapHandler("google_business"),
      },
    ],
  },
  {
    name: "booking",
    description:
      "Real availability and real booking creation, reused as-is from the production Marketplace booking engine — no calendar or provider logic lives here, this only wraps what already exists.",
    actions: [
      {
        name: "getAvailability",
        description:
          "Real bookable time slots for this business, computed from their actual schedule, connected calendar, and business hours. Returns real slots or an honest reason none exist yet — never invented times.",
        argsSchema: bookingArgSchema(
          {
            serviceId: { type: "string", description: "Which service to check availability for. Omit to use the business's first bookable service." },
            date: { type: "string", description: "A specific date (YYYY-MM-DD) to check. Omit to get the soonest available times." },
          },
          [],
        ),
        handler: async (args) => {
          const businessId = String(args?.businessId || "").trim();
          if (!businessId) {
            return { ok: false, real: false, summary: "No business was specified.", error: "missing_business_id" };
          }
          const r = await callMarketplace("booking_slots", {
            business_id: businessId,
            service_id: String(args?.serviceId || "").trim() || undefined,
            date: String(args?.date || "").trim() || undefined,
          });
          if (!r) {
            return { ok: false, real: false, summary: "Availability could not be checked right now.", error: "marketplace_unreachable" };
          }
          if (!r.ok) {
            // A real, honest outcome (e.g. this business isn't set up for
            // real-time booking yet) — not a client input error, so ok:true,
            // real:false, same convention as the website-couldn't-be-reached case.
            return {
              ok: true,
              real: false,
              summary: r.error === "Provider not found" || r.error === "Business not found"
                ? "This business isn't set up for real-time booking yet."
                : (r.error || "No availability could be found."),
              raw: r,
            };
          }
          const slotCount = Array.isArray(r.slots) ? r.slots.length : 0;
          return {
            ok: true,
            real: true,
            summary: slotCount
              ? `Found ${slotCount} real available time${slotCount === 1 ? "" : "s"} for ${r.service?.name || "this service"}, starting ${r.nextAvailable || "soon"}.`
              : `No real availability found for ${r.service?.name || "this service"} right now.`,
            raw: r,
          };
        },
      },
      {
        name: "create",
        description:
          "Creates a real booking — writes a real record, triggers real calendar sync and a real confirmation email. Only call this once the customer has chosen a real time from getAvailability and given their contact details.",
        argsSchema: bookingArgSchema(
          {
            serviceId: { type: "string", description: "Which service is being booked." },
            startsAt: { type: "string", description: "The exact start time the customer chose — must be a real slot from getAvailability, never invented." },
            customerName: { type: "string", description: "The customer's name." },
            customerEmail: { type: "string", description: "The customer's email, if given." },
            customerPhone: { type: "string", description: "The customer's phone, if given." },
            address: { type: "string", description: "Service address, if relevant/given." },
            notes: { type: "string", description: "Any special requests or notes the customer mentioned." },
          },
          ["serviceId", "startsAt", "customerName"],
        ),
        handler: async (args) => {
          const businessId = String(args?.businessId || "").trim();
          const serviceId = String(args?.serviceId || "").trim();
          const startsAt = String(args?.startsAt || "").trim();
          const customerName = String(args?.customerName || "").trim();
          if (!businessId || !serviceId || !startsAt || !customerName) {
            return { ok: false, real: false, summary: "Missing required booking details.", error: "missing_required_args" };
          }
          const r = await callMarketplace("booking_create", {
            business_id: businessId,
            service_id: serviceId,
            starts_at: startsAt,
            customer_name: customerName,
            customer_email: String(args?.customerEmail || "").trim() || undefined,
            customer_phone: String(args?.customerPhone || "").trim() || undefined,
            address: String(args?.address || "").trim() || undefined,
            notes: String(args?.notes || "").trim() || undefined,
          });
          if (!r) {
            return { ok: false, real: false, summary: "The booking could not be created right now.", error: "marketplace_unreachable" };
          }
          if (!r.ok) {
            return { ok: true, real: false, summary: r.error || "The booking could not be created.", raw: r };
          }
          const needsCheckout = !!r.checkout?.required;
          return {
            ok: true,
            real: true,
            summary: needsCheckout
              ? `Real booking created (${r.confirmation?.status || "pending"}) — a payment of $${((r.checkout.amount_cents || 0) / 100).toFixed(2)} (${r.checkout.charge_kind}) is required to confirm it.`
              : `Real booking confirmed for ${r.confirmation?.starts_at || startsAt}.`,
            raw: r,
          };
        },
      },
    ],
  },
  {
    name: "business",
    description:
      "Create and grow a real, live business record and website — even before the person has an account. Reuses the real renderer (25 layouts) and the real businesses table, just with owner_id left unset until they actually sign up.",
    actions: [
      {
        name: "startDraft",
        description:
          "Creates a REAL business row and a real live website at <slug>.myhubly.app — visitable immediately, even with almost nothing filled in yet. Call this once, the first time you have a business name and (ideally) a chosen visual direction — not before. Calling it again for the same conversation creates a second, unwanted business — use updateDraft after this point, never call startDraft twice.",
        argsSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "The business's real name, exactly as given." },
            businessType: {
              type: "string",
              description:
                "One short lowercase category if it's genuinely clear (e.g. \"detailing\", \"landscaping\", \"cleaning\", \"photography\", \"windows\", \"pressure_washing\"). Omit if unclear — never guess.",
            },
          },
          required: ["name"],
        },
        handler: async (args) => {
          const name = String(args?.name || "").trim();
          if (!name) {
            return { ok: false, real: false, summary: "No business name was given.", error: "missing_name" };
          }
          const businessType = String(args?.businessType || "").trim() || undefined;
          const r = await callBusinessRpc("start_business_in_progress", {
            p_name: name,
            p_business_type: businessType || null,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The business record could not be created right now.", error: r?.error || "rpc_unreachable" };
          }
          // Structural safety net, not reliance on the model remembering to
          // set seoTitle on the very same turn: businessType defaults to
          // 'detailing' at the schema level, and the legacy blueprint
          // fallback silently mislabels anything else as "Auto Detailing"
          // (see 20260803... history) — without this, the very first paint,
          // before anything is really known yet, can show a wrong category
          // in the browser tab. A neutral, honest title (just the name)
          // beats that every time; updateDraft can always make it richer
          // once the business is actually understood.
          await callBusinessRpc("patch_business_in_progress", {
            p_id: r.id,
            p_draft_token: r.draft_token,
            p_patch: {},
            p_website_meta: { seoTitle: name },
          });
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          return {
            ok: true,
            real: true,
            summary: `Real business created and live at ${url} — this is a real, visitable site, not a mockup.`,
            raw: { id: r.id, slug: r.slug, draftToken: r.draft_token, url },
          };
        },
      },
      {
        name: "updateDraft",
        description:
          "Updates the real business/website created by startDraft — real headline, subhead, about copy, contact info, or visual direction (layout). Every call here changes what's actually live at the site right now. Only ever call this after startDraft has already run in this conversation.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: {
              type: "string",
              description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
            },
            name: { type: "string", description: "Updated business name, if it changed." },
            tagline: { type: "string", description: "A short real tagline, if you drafted one." },
            about: { type: "string", description: "A real about/description paragraph, if you drafted one." },
            businessType: { type: "string", description: "Updated category, only if it's now clearer than before." },
            phone: { type: "string", description: "Phone number, if given." },
            email: { type: "string", description: "Email, if given." },
            city: { type: "string", description: "City / service area, if given." },
            brandColor: { type: "string", description: "A hex color, only if the person actually specified or approved one." },
            heroHeadline: { type: "string", description: "The real homepage headline you're drafting or refining right now." },
            heroSubhead: { type: "string", description: "The real homepage subheadline." },
            seoTitle: {
              type: "string",
              description:
                "Always include this alongside heroHeadline: a short, accurate title like \"<Business Name> | <what they actually do>\" (e.g. \"Bark and Bubbles | Dog Grooming\"). businessType only recognizes a handful of fixed categories and silently mislabels anything outside them, so this is what makes the browser tab and page title actually correct.",
            },
            layout: {
              type: "string",
              description: "The chosen real visual direction's id (from the real layout list you were given) — only when the person picked or changed direction.",
            },
          },
          required: [],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet to update — call startDraft first.", error: "missing_draft" };
          }
          const patch: Record<string, unknown> = {};
          const map: Record<string, string> = {
            name: "name", tagline: "tagline", about: "about", businessType: "business_type",
            phone: "phone", email: "email", city: "city", brandColor: "brand_color",
            heroHeadline: "gen_hero_headline", heroSubhead: "gen_hero_subhead", seoTitle: "gen_seo_title",
          };
          for (const [argKey, col] of Object.entries(map)) {
            const v = args?.[argKey];
            if (typeof v === "string" && v.trim()) patch[col] = v.trim();
          }
          // The renderer (public/hubly.html: applyBizMeta -> "if(meta.website)
          // S.website=meta.website") reads hero headline/subhead/SEO title
          // from meta.website, NOT from the gen_* columns above — those are
          // a separate AI-draft staging area that only reaches the live site
          // through a different, owner-authenticated flow. Writing here is
          // what actually makes the live preview change.
          const layout = String(args?.layout || "").trim();
          const heroHeadline = typeof args?.heroHeadline === "string" ? args.heroHeadline.trim() : "";
          const heroSub = typeof args?.heroSubhead === "string" ? args.heroSubhead.trim() : "";
          const seoTitle = typeof args?.seoTitle === "string" ? args.seoTitle.trim() : "";
          const websiteMeta: Record<string, unknown> = {};
          if (layout) websiteMeta.layout = layout;
          if (heroHeadline) { websiteMeta.heroHeadline = heroHeadline; websiteMeta.customHeroHeadline = true; }
          if (heroSub) { websiteMeta.heroSub = heroSub; websiteMeta.customHeroSub = true; }
          if (seoTitle) websiteMeta.seoTitle = seoTitle;
          const r = await callBusinessRpc("patch_business_in_progress", {
            p_id: draftId,
            p_draft_token: draftToken,
            p_patch: patch,
            p_website_meta: Object.keys(websiteMeta).length ? websiteMeta : null,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The business record could not be updated — the draft may have already been claimed.", error: "rpc_failed" };
          }
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          const changed = Object.keys(patch).concat(layout ? ["layout"] : []);
          return {
            ok: true,
            real: true,
            summary: changed.length
              ? `Real update applied — ${url} now reflects: ${changed.join(", ")}.`
              : `No fields changed — nothing new was given to update.`,
            raw: { id: r.id, slug: r.slug, url },
          };
        },
      },
      {
        name: "setServices",
        description:
          "Writes the real services list — the live site's Services section renders these for real, immediately. Pass the COMPLETE current list every time (replaces what's there, same convention as everything else here) — never just the newly-mentioned one.",
        argsSchema: {
          type: "object",
          properties: {
            draftId: {
              type: "string",
              description: "Automatically supplied by the system before this runs — you do not know the real value and never need to. Put any placeholder here; do not decline to invoke just because you don't have a real id.",
            },
            services: {
              type: "array",
              description: "Every service currently known, in order. Each: { name (required), price (number, omit if truly unknown), description (one line, optional) }.",
              items: {},
            } as any,
          },
          required: ["services"],
        },
        handler: async (args) => {
          const draftId = String(args?.draftId || "").trim();
          const draftToken = String((args as any)?.draftToken || "").trim();
          if (!draftId || !draftToken) {
            return { ok: false, real: false, summary: "No draft business exists yet — call startDraft first.", error: "missing_draft" };
          }
          const list = Array.isArray(args?.services) ? args.services : [];
          const services = list
            .filter((s: any) => s && typeof s.name === "string" && s.name.trim())
            .map((s: any) => ({
              name: String(s.name).trim(),
              price: typeof s.price === "number" && Number.isFinite(s.price) ? s.price : undefined,
              description: typeof s.description === "string" && s.description.trim() ? s.description.trim() : undefined,
            }));
          const r = await callBusinessRpc("set_business_draft_services", {
            p_id: draftId,
            p_draft_token: draftToken,
            p_services: services,
          });
          if (!r || r.ok !== true) {
            return { ok: false, real: false, summary: "The services list could not be saved — the draft may have already been claimed.", error: "rpc_failed" };
          }
          const url = `https://${r.slug}.${HUBLY_DOMAIN}`;
          return {
            ok: true,
            real: true,
            summary: `Real update — ${url} now shows ${r.count} real service${r.count === 1 ? "" : "s"}.`,
            raw: { id: r.id, slug: r.slug, url, count: r.count },
          };
        },
      },
    ],
  },
];

export function findCapability(name: string): Capability | undefined {
  return HUBLY_CAPABILITY_REGISTRY.find((c) => c.name === name);
}

export function findAction(capabilityName: string, actionName: string): CapabilityAction | undefined {
  return findCapability(capabilityName)?.actions.find((a) => a.name === actionName);
}

/** Generates the capability/action description block for a consumer's prompt — the ONLY place this text is produced. */
export function buildCapabilitiesPromptBlock(registry: Capability[] = HUBLY_CAPABILITY_REGISTRY): string {
  return registry
    .map((cap) => {
      const actions = cap.actions
        .map((a) => {
          const args = Object.entries(a.argsSchema.properties)
            .map(([key, spec]) => {
              const req = a.argsSchema.required.includes(key) ? ", required" : ", optional";
              return `${key} (${spec.type}${req}): ${spec.description}`;
            })
            .join("; ");
          return `  - ${a.name}(${args})\n    ${a.description}`;
        })
        .join("\n");
      return `${cap.name}: ${cap.description}\n${actions}`;
    })
    .join("\n\n");
}
