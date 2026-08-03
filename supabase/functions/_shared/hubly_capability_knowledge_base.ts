// supabase/functions/_shared/hubly_capability_knowledge_base.ts
//
// The canonical, structured form of docs/HUBLY_CAPABILITY_KNOWLEDGE_BASE.md
// Part 2 — every verified-real Hubly capability, as data instead of prose,
// so it can be loaded selectively (see hubly_capability_knowledge_loader.ts)
// instead of dumped whole into a prompt. The markdown document remains the
// narrative record of the audit that produced this; this file is what the
// engine actually reads at runtime. Keep them in sync by hand when either
// changes — there is no generator between them.
//
// This is knowledge, not execution: it tells Hubly Conversation what to
// talk about and when. It has zero connection to the Capability Registry
// (_shared/hubly_capability_registry.ts), which remains the only thing
// that actually dispatches an action. An entry existing here does NOT mean
// it's invocable — most aren't, yet.
//
// Extending Hubly's capability knowledge means adding an entry to this
// array. It should never mean growing a prompt string by hand.

import type { BusinessUnderstandingPatch } from "./hubly_business_understanding.ts";
import { GROWTH_GOAL_PATTERN } from "./hubly_planner.ts";

// A stated payments.current_system naming a manual/limited method is itself
// a Business Understanding signal that Payments/Checkout capabilities are
// relevant — distinct from relevantWhenMissing, which fires when nothing
// about payments is known yet at all.
const MANUAL_PAYMENT_PATTERN = /\b(cash|check|checks|venmo|zelle|cash\s*app|paypal)\b/i;

export type CapabilityKnowledgeStatus = "production_ready" | "partial";

export type CapabilityKnowledgeEntry = {
  id: string;
  /** Matches a HUBLY_CORE_DEFINITION name where one exists. */
  group: string;
  name: string;
  whatItDoes: string;
  customerProblem: string;
  recommendWhen: string;
  poweredBy: string;
  requires: string;
  /** ["all"], or specific lowercase industry names/fragments. */
  industries: string[];
  /** Other entry ids this depends on, or a short free-text note. */
  dependsOn: string[];
  status: CapabilityKnowledgeStatus;
  /** Required when status is "partial" — the caveat that must travel with any recommendation. */
  statusNote?: string;
  /**
   * Secondary retrieval signal only — lowercase phrases checked against the
   * latest user message. Business Understanding (relevantWhenMissing /
   * relevantWhenFieldMatches) is the primary driver; this exists to nudge
   * relevance within one turn, never to replace it. Never used to power a
   * second AI call.
   */
  triggerKeywords: string[];
  /** PRIMARY signal: Business Understanding top-level keys whose absence makes this MORE relevant to bring up. */
  relevantWhenMissing?: (keyof BusinessUnderstandingPatch)[];
  /**
   * PRIMARY signal: this capability is more relevant when a Business
   * Understanding field's current VALUE matches a pattern — e.g. a stated
   * goal that's growth-shaped, or a payments.current_system that names a
   * manual/limited method. Reasoning over structured understanding, not
   * the raw conversational message.
   */
  relevantWhenFieldMatches?: Array<{ field: keyof BusinessUnderstandingPatch; pattern: RegExp }>;
};

export const HUBLY_CAPABILITY_KNOWLEDGE_BASE: CapabilityKnowledgeEntry[] = [
  // --- website ---------------------------------------------------------
  {
    id: "website.generation",
    group: "website",
    name: "Website Generation & Publishing",
    whatItDoes: "Generates a full business website (hero, about, FAQ, SEO copy, why-choose-us) from real business facts and publishes it live at a Hubly subdomain.",
    customerProblem: "A business with no web presence, or an outdated one, gets a real live site without hiring anyone.",
    recommendWhen: "The business has no website, or an existing one is thin/outdated, and hasn't said they're happy with what they have.",
    poweredBy: "generate-site Edge Function; rendered via public/hubly.html + layouts/themes.",
    requires: "Basic business facts (name, industry, services).",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["website", "site", "web page", "landing page", "online presence", "webpage"],
    relevantWhenMissing: ["website"],
  },
  {
    id: "website.customDomain",
    group: "website",
    name: "Custom Domain Registration",
    whatItDoes: "Checks availability and purchases a real domain, sets up DNS and SSL, against live Cloudflare/Porkbun APIs.",
    customerProblem: "A business wants theirname.com instead of a Hubly subdomain.",
    recommendWhen: "The business explicitly asks about their own domain — don't volunteer this one.",
    poweredBy: "hubly_provider_cloudflare.ts, hubly_provider_porkbun.ts, behind hubly_provider_domain.ts.",
    requires: "A domain name to check; provider API keys configured server-side.",
    industries: ["all"],
    dependsOn: ["website.generation"],
    status: "partial",
    statusNote: "Real and never fakes availability/success, but only reachable through the AI Brain pipeline today, not a direct API — don't imply a simple self-serve toggle.",
    triggerKeywords: ["domain", "custom domain", ".com", "own domain"],
  },

  // --- online_presence ---------------------------------------------------
  {
    id: "online_presence.reviews",
    group: "online_presence",
    name: "Review Collection & Curation",
    whatItDoes: "Sends a real review-request link tied to a specific completed job; a customer can only submit if that job genuinely had a request sent; the owner approves before anything shows publicly.",
    customerProblem: "Builds real, trustworthy social proof without the business chasing reviews manually.",
    recommendWhen: "The business has completed jobs but few or no reviews showing on their storefront.",
    poweredBy: "review_submissions table + get_review_request_context() RPC.",
    requires: "A completed job to request a review against.",
    industries: ["all", "home services", "personal care", "photography"],
    dependsOn: ["crm.jobs"],
    status: "production_ready",
    triggerKeywords: ["review", "reviews", "testimonial", "google reviews", "social proof"],
  },
  {
    id: "online_presence.websiteAnalysis",
    group: "online_presence",
    name: "Website Analysis",
    whatItDoes: "Reads a real, existing website — title, description, headings, service-like content, contact details, dominant brand colors.",
    customerProblem: "Lets Hubly Conversation ground advice in what a business's current site actually says, instead of guessing.",
    recommendWhen: "A business pastes or mentions an existing website.",
    poweredBy: "hubly_capability_registry.ts (website.analyze) -> /api/import-analyze. The one capability already wired into the Registry today.",
    requires: "A live URL.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["my website is", "check my site", "look at my website", "http", "www."],
  },
  {
    id: "online_presence.socialLinkRecognition",
    group: "online_presence",
    name: "Social/Listing Link Recognition",
    whatItDoes: "Recognizes a Facebook, Instagram, or Google Business Profile link and extracts the handle — cannot read the page's actual content.",
    customerProblem: "Lets the AI acknowledge a business's social presence honestly, without pretending to have analyzed it.",
    recommendWhen: "A business shares one of these links — surface as link-recognition, never as analysis.",
    poweredBy: "hubly_capability_registry.ts (online_presence.analyze_facebook/instagram/google_business).",
    requires: "A profile URL.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    statusNote: "Limited — link recognition only, never describe as reading page content.",
    triggerKeywords: ["instagram", "facebook", "google business profile", "gbp", "@"],
  },

  // --- storefront ---------------------------------------------------------
  {
    id: "storefront.serviceCatalog",
    group: "storefront",
    name: "Service Catalog (Services, Packages, Add-ons, Pricing)",
    whatItDoes: "One canonical, AI-ready catalog per business — services, packages, add-ons, and pricing, all in one place.",
    customerProblem: "Gives a business a real, structured price list customers (and the AI) can act on, instead of scattered notes.",
    recommendWhen: "A business doesn't have services/pricing set up, or wants to reorganize/expand their offer.",
    poweredBy: "service_engine.ts -> businesses.meta.service_catalog.",
    requires: "Service names, pricing (or quote-required), optional add-ons/packages.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["services", "pricing", "price list", "packages", "add-ons", "what i charge"],
    relevantWhenMissing: ["services"],
  },
  {
    id: "storefront.page",
    group: "storefront",
    name: "Storefront Page & Booking CTA",
    whatItDoes: "A real, live, customer-facing page presenting the service catalog with a working book-now call to action.",
    customerProblem: "Turns a visitor into a booked (or paying) customer without a phone call.",
    recommendWhen: "The business has services configured but no clear way for customers to act on them.",
    poweredBy: "public/hubly.html (#p-storefront, renderWebsite()).",
    requires: "Service Catalog to exist.",
    industries: ["all"],
    dependsOn: ["storefront.serviceCatalog"],
    status: "production_ready",
    triggerKeywords: ["book now", "storefront", "let customers book"],
  },
  {
    id: "storefront.bookingCheckout",
    group: "storefront",
    name: "Booking Checkout & Deposits",
    whatItDoes: "A real Stripe Checkout session for a booking deposit or full payment via Stripe Connect, so money goes to the business directly.",
    customerProblem: "Lets a business collect payment (or a deposit) at the moment of booking, reducing no-shows.",
    recommendWhen: "A business books appointments and doesn't currently collect anything upfront.",
    poweredBy: "create-booking-checkout Edge Function.",
    requires: "Completed Stripe Connect onboarding.",
    industries: ["all", "home services", "personal care", "photography"],
    dependsOn: ["payments.stripeConnect", "booking.creation"],
    status: "production_ready",
    statusNote: "Honestly blocked (not faked) until Stripe Connect is complete.",
    triggerKeywords: ["deposit", "collect payment", "no shows", "no-show", "upfront payment"],
  },
  {
    id: "storefront.commerce",
    group: "storefront",
    name: "Product Store / Commerce",
    whatItDoes: "A full, separate physical-product storefront — products, variants, collections, bundles, carts, discounts, gift cards, real inventory tracking, real Stripe checkout.",
    customerProblem: "A business that sells physical goods (not just services) gets a real e-commerce storefront.",
    recommendWhen: "A business mentions selling physical products, merchandise, or retail items alongside services.",
    poweredBy: "commerce-api, commerce-merchandising, create-store-checkout Edge Functions.",
    requires: "Products with pricing; Stripe Connect for checkout.",
    industries: ["photography", "detailing", "spa", "retail-adjacent service businesses"],
    dependsOn: ["payments.stripeConnect"],
    status: "production_ready",
    triggerKeywords: ["sell products", "merchandise", "online store", "prints", "retail"],
  },

  // --- booking ---------------------------------------------------------
  {
    id: "booking.availability",
    group: "booking",
    name: "Availability Engine",
    whatItDoes: "Computes real bookable time by combining a business's scheduled jobs, their connected Google Calendar, and stated business hours.",
    customerProblem: "Prevents double-booking and shows customers genuinely open times, not guesses.",
    recommendWhen: "A business is manually tracking their schedule (texts, paper calendar, memory).",
    poweredBy: "marketplace_availability.ts (getAvailability, listAppointmentSlots).",
    requires: "Business hours set; ideally a connected Google Calendar.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    statusNote: "Outlook is a declared source type with no real implementation — never claim Outlook support.",
    triggerKeywords: ["double booked", "double-booked", "availability", "open times", "schedule conflict"],
  },
  {
    id: "booking.googleCalendarSync",
    group: "booking",
    name: "Google Calendar Sync",
    whatItDoes: "Full two-way sync — OAuth connect, real-time webhook push updates, and a cron job that renews watches and catches anything a webhook missed.",
    customerProblem: "A business's existing Google Calendar stays the single source of truth; nothing gets double-booked across systems.",
    recommendWhen: "A business already lives in Google Calendar and doesn't want to switch tools.",
    poweredBy: "google-calendar-sync/push-job/webhook/maintain/oauth-start/callback/connection Edge Functions.",
    requires: "The business connects their Google account.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    statusNote: "The most mature area of the entire backend.",
    triggerKeywords: ["google calendar", "calendar sync", "sync my calendar"],
  },
  {
    id: "booking.creation",
    group: "booking",
    name: "Booking Creation & Confirmation",
    whatItDoes: "Creates a real booking record, triggers calendar sync, and sends a real confirmation email with a calendar attachment.",
    customerProblem: "A customer books, gets a real confirmation, and it's already on the business's calendar.",
    recommendWhen: "A business takes bookings by phone/text/DM today.",
    poweredBy: "marketplace/index.ts (booking_create), booking-confirmed Edge Function.",
    requires: "Availability Engine, Service Catalog.",
    industries: ["all"],
    dependsOn: ["booking.availability", "storefront.serviceCatalog"],
    status: "production_ready",
    statusNote: "Customer-initiated reschedule/cancel of an existing booking is not real yet.",
    triggerKeywords: ["book", "booking", "appointment", "schedule a", "take bookings"],
    relevantWhenMissing: ["scheduling"],
  },

  // --- crm ---------------------------------------------------------
  {
    id: "crm.customers",
    group: "crm",
    name: "Customer Records",
    whatItDoes: "A real, relational customer database with live dashboard updates.",
    customerProblem: "A business stops losing track of who their customers are and what they've bought.",
    recommendWhen: "A business is tracking customers in a notebook, spreadsheet, or not at all.",
    poweredBy: "public.customers table, real-time enabled.",
    requires: "Name and at least one contact method per customer.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["customer list", "keep track of customers", "crm", "client database"],
    relevantWhenMissing: ["crm"],
  },
  {
    id: "crm.jobs",
    group: "crm",
    name: "Jobs / Work Tracking",
    whatItDoes: "Tracks a unit of work for a customer — status, schedule, notes — the backbone Availability, Calendar Sync, Reviews, and Invoicing all read from.",
    customerProblem: "A business has one real record of what work is happening, scheduled, or done.",
    recommendWhen: "Almost always relevant once a business is past pure lead-gen.",
    poweredBy: "public.jobs table, real-time enabled, wired to Google Calendar sync.",
    requires: "A customer and a service.",
    industries: ["all"],
    dependsOn: ["crm.customers", "storefront.serviceCatalog"],
    status: "production_ready",
    triggerKeywords: ["jobs", "track work", "work order"],
  },
  {
    id: "crm.leads",
    group: "crm",
    name: "Leads Pipeline",
    whatItDoes: "A kanban-style pipeline view over jobs that haven't been promoted to a booked/customer state yet.",
    customerProblem: "Gives a business a place to see who's interested but not yet booked.",
    recommendWhen: "A business has inbound interest they're not tracking anywhere.",
    poweredBy: "public/hubly.html (renderLeadsBoard), computed over the real jobs table.",
    requires: "Nothing beyond Jobs existing.",
    industries: ["all", "home renovation", "events"],
    dependsOn: ["crm.jobs"],
    status: "partial",
    statusNote: "Real underlying data, but no first-class lead record — it's a filtered view, not a dedicated leads database. Don't describe it as one.",
    triggerKeywords: ["leads", "pipeline", "inquiries", "prospects"],
  },
  {
    id: "crm.invoices",
    group: "crm",
    name: "Invoices",
    whatItDoes: "For most businesses, persists as a specially-tagged job row (real, but no line items/invoice numbering). Photography businesses get a genuinely dedicated invoice table.",
    customerProblem: "Lets a business bill a customer and track whether they've paid.",
    recommendWhen: "A business is invoicing manually or off-platform.",
    poweredBy: "public/hubly.html (createInvoice()) generally; public.photography_project_invoices for Photography.",
    requires: "A job to invoice against.",
    industries: ["all", "photography"],
    dependsOn: ["crm.jobs"],
    status: "partial",
    statusNote: "Real and functional, but describe it as bill tracking on a job, not a formal invoicing system, outside Photography.",
    triggerKeywords: ["invoice", "billing", "bill customers", "get paid for a job"],
  },

  // --- marketing ---------------------------------------------------------
  {
    id: "marketing.studioCampaigns",
    group: "marketing",
    name: "Studio Campaign Engine",
    whatItDoes: "AI selects a proven playbook for the business's industry and goal, then generates a full structured campaign plan.",
    customerProblem: "A business gets a real, tailored marketing plan instead of generic advice.",
    recommendWhen: "A business says they want more customers, more bookings, or mentions an upcoming slow season/event.",
    poweredBy: "studio-api (campaign/* routes), hubly_campaign_engine.ts.",
    requires: "Industry and a stated goal.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    statusNote: "Plans and generates creative packages; does not execute/send a campaign on its own beyond Studio Email Publish.",
    triggerKeywords: ["more customers", "more bookings", "marketing plan", "campaign", "promotion", "slow season"],
    relevantWhenFieldMatches: [{ field: "goals", pattern: GROWTH_GOAL_PATTERN }],
  },
  {
    id: "marketing.customerEmail",
    group: "marketing",
    name: "Owner-Approved Customer Email",
    whatItDoes: "Sends a real one-off email to a customer (review requests, win-back, reschedule notices) via a real email provider, always after owner approval.",
    customerProblem: "A business can reach out to customers without writing every email from scratch.",
    recommendWhen: "A business wants to follow up with past customers, or has a specific message to send.",
    poweredBy: "send-customer-email (send), draft-customer-message (AI draft, never sends).",
    requires: "A customer with an email on file, and owner approval before sending.",
    industries: ["all"],
    dependsOn: ["crm.customers"],
    status: "production_ready",
    triggerKeywords: ["email my customers", "follow up", "win back", "reach out to customers"],
  },
  {
    id: "marketing.studioEmailPublish",
    group: "marketing",
    name: "Studio Email Publish",
    whatItDoes: "Publishes a Studio-created campaign or design via email.",
    customerProblem: "Turns a designed campaign into something that actually reaches customers' inboxes.",
    recommendWhen: "A business has a Studio campaign ready to send.",
    poweredBy: "hubly_studio_publisher.ts (EmailStudioPublisher).",
    requires: "A recipient email and a Studio project.",
    industries: ["all"],
    dependsOn: ["marketing.studioCampaigns"],
    status: "production_ready",
    statusNote: "Email only — never imply Facebook, Instagram, Google Business, LinkedIn, or SMS publishing.",
    triggerKeywords: ["send my campaign", "publish campaign", "email blast"],
  },

  // --- payments ---------------------------------------------------------
  {
    id: "payments.stripeConnect",
    group: "payments",
    name: "Stripe Connect Onboarding",
    whatItDoes: "Creates a real Stripe Express account for the business with a real, Stripe-hosted onboarding flow.",
    customerProblem: "Lets a business accept payments directly, with money going to their own account.",
    recommendWhen: "A business wants to collect deposits, payments, or sell products, and hasn't connected Stripe yet.",
    poweredBy: "stripe-connect-onboard, stripe.ts.",
    requires: "Basic business info Stripe needs for identity verification.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    statusNote: "The hard dependency almost every payment-related capability sits behind.",
    triggerKeywords: ["accept payments", "get paid", "stripe", "collect money", "take payments"],
    relevantWhenMissing: ["payments"],
    relevantWhenFieldMatches: [{ field: "payments", pattern: MANUAL_PAYMENT_PATTERN }],
  },
  {
    id: "payments.statusAndPayouts",
    group: "payments",
    name: "Payment Status & Payouts",
    whatItDoes: "Shows whether Stripe Connect is fully set up, and links to the business's real Stripe Express dashboard for payout details.",
    customerProblem: "A business can check their payment setup and see their money without Hubly maintaining a separate ledger.",
    recommendWhen: "A business asks where their money is, or whether they're set up to get paid.",
    poweredBy: "stripe-connect-connection.",
    requires: "Stripe Connect Onboarding completed.",
    industries: ["all"],
    dependsOn: ["payments.stripeConnect"],
    status: "production_ready",
    statusNote: "A thin passthrough to Stripe's own dashboard, not a separate Hubly ledger — describe it that way.",
    triggerKeywords: ["payout", "where's my money", "when do i get paid"],
  },

  // --- marketplace ---------------------------------------------------------
  {
    id: "marketplace.aiMatching",
    group: "marketplace",
    name: "AI Matching (Find a Pro)",
    whatItDoes: "A conversational AI understands what a consumer needs and returns a small, ranked set of real matched providers with plain-language reasons.",
    customerProblem: "A consumer describes a problem in their own words and gets matched to the right business.",
    recommendWhen: "Talking with a consumer (not a business owner) who needs to find a provider, or a business owner asking how Hubly can bring them customers.",
    poweredBy: "marketplace_intake.ts, marketplace_match.ts, hubly-find-pro.",
    requires: "A description of the job/need; a city helps.",
    industries: ["all"],
    dependsOn: ["marketplace.providerProfile"],
    status: "production_ready",
    statusNote: "No separate browsable/searchable directory exists — this AI-conversation path is the actual consumer product surface.",
    triggerKeywords: ["find a pro", "get matched", "marketplace", "find customers", "leads from hubly"],
  },
  {
    id: "marketplace.providerProfile",
    group: "marketplace",
    name: "Marketplace Provider Profile & Score",
    whatItDoes: "Assembles a public-safe provider profile and computes a real weighted quality score (completeness, photos, reviews, calendar connection, verification, bookings, cancellation rate).",
    customerProblem: "Gives consumers a trustworthy signal for choosing between providers, and gives a provider a concrete improvement list.",
    recommendWhen: "A provider wants to rank better in matching, or a consumer needs to compare providers.",
    poweredBy: "marketplace_provider.ts, marketplace_score.ts.",
    requires: "A marketplace provider profile to exist.",
    industries: ["all"],
    dependsOn: ["storefront.serviceCatalog", "online_presence.reviews"],
    status: "production_ready",
    statusNote: "The response-time score factor is never actually computed from real data yet — don't claim response time is being actively measured.",
    triggerKeywords: ["marketplace score", "provider score", "rank better", "get more marketplace leads"],
  },

  // --- studio ---------------------------------------------------------
  {
    id: "studio.mediaLibrary",
    group: "studio",
    name: "Media Library",
    whatItDoes: "Real storage for a business's logos, uploads, and job photos used across Studio.",
    customerProblem: "One real place for a business's visual assets instead of scattered files.",
    recommendWhen: "A business wants to build a campaign or update their site and needs assets organized.",
    poweredBy: "studio-api (assets resource) -> studio_assets table.",
    requires: "Files to upload.",
    industries: ["all", "photography", "detailing", "landscaping"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["upload photos", "media library", "my photos"],
  },
  {
    id: "studio.aiPhotoAnalysis",
    group: "studio",
    name: "AI Photo Analysis",
    whatItDoes: "Reviews uploaded photos, recommends a hero image, detects before/after pairs, infers quality/audience signals — works even pre-account.",
    customerProblem: "A business doesn't have to guess which photo makes the best first impression.",
    recommendWhen: "A business uploads photos, especially during onboarding or a site refresh.",
    poweredBy: "analyze-photos Edge Function.",
    requires: "At least one photo.",
    industries: ["detailing", "photography", "landscaping", "cleaning"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["before and after", "before/after", "hero image", "which photo"],
  },
  {
    id: "studio.creativeDirector",
    group: "studio",
    name: "Creative Director",
    whatItDoes: "A conversational assistant that helps shape a business's brand/creative direction, including reacting to an inspiration screenshot.",
    customerProblem: "A business without design instincts gets real creative guidance in plain conversation.",
    recommendWhen: "A business is unsure of their visual direction/branding.",
    poweredBy: "creative-director Edge Function.",
    requires: "A conversation; optionally an inspiration image.",
    industries: ["all"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["branding", "brand colors", "logo", "design direction"],
  },

  // --- analytics ---------------------------------------------------------
  {
    id: "analytics.dailyBriefing",
    group: "analytics",
    name: "AI Daily Briefing",
    whatItDoes: "Takes a business's already-computed stats and writes a real AI-generated narrative summary of how the business is doing.",
    customerProblem: "An owner gets a plain-language read on their numbers instead of a spreadsheet.",
    recommendWhen: "A business wants a quick read on how things are going, not raw numbers.",
    poweredBy: "hubly-daily Edge Function.",
    requires: "Stats supplied by the caller — this function narrates, it doesn't calculate.",
    industries: ["all"],
    dependsOn: ["analytics.dashboard"],
    status: "production_ready",
    triggerKeywords: ["how am i doing", "summarize my business", "daily briefing"],
  },
  {
    id: "analytics.dashboard",
    group: "analytics",
    name: "Dashboard / Reports",
    whatItDoes: "Revenue, jobs, pipeline, customer, marketing, and review metrics, computed from real data.",
    customerProblem: "Gives an owner visibility into how their business is performing.",
    recommendWhen: "A business asks how they're doing, or hasn't looked at their numbers recently.",
    poweredBy: "Computed client-side in public/journey-os/journey.js, over real source tables.",
    requires: "Jobs and customers to already exist.",
    industries: ["all"],
    dependsOn: ["crm.jobs", "crm.customers"],
    status: "partial",
    statusNote: "The numbers are real, but there's no backend reporting engine — calculated in the browser each time, not a queryable analytics service.",
    triggerKeywords: ["revenue", "my numbers", "performance", "reports", "dashboard"],
  },

  // --- integrations ---------------------------------------------------------
  {
    id: "integrations.adobeLightroom",
    group: "integrations",
    name: "Adobe Lightroom",
    whatItDoes: "A real, working OAuth-based integration for syncing with a business's Adobe Lightroom account.",
    customerProblem: "Photography businesses keep their existing editing workflow connected to Hubly.",
    recommendWhen: "A photography business mentions using Lightroom.",
    poweredBy: "hubly_provider_lightroom.ts.",
    requires: "The business connects their Adobe account.",
    industries: ["photography"],
    dependsOn: [],
    status: "production_ready",
    triggerKeywords: ["lightroom", "photo editing workflow"],
  },
];
