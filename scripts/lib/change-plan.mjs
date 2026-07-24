/** Node mirror of hubly_brain_change_plan.ts — Milestone 1.5 Epic 2 (esbuild). */


// supabase/functions/_shared/hubly_brain_change_plan.ts
var CHANGE_PLAN_VERSION = "1.0.0";
var CHANGE_PLAN_OWNER = "hubly_brain";
var SUPPORTED_BUILDERS = /* @__PURE__ */ new Set([
  "website_builder",
  "booking",
  "crm",
  "workspace_builder",
  "portfolio_builder",
  "packages_builder",
  "automation",
  "marketplace",
  "multi"
]);
var SYSTEM_TO_BUILDER = {
  Website: { type: "website_builder", owner: "Website Builder" },
  Branding: { type: "website_builder", owner: "Website Builder" },
  Booking: { type: "booking", owner: "Booking Intelligence Builder" },
  Integrations: { type: "booking", owner: "Booking Intelligence Builder" },
  CRM: { type: "crm", owner: "CRM Builder" },
  Workspace: { type: "workspace_builder", owner: "Workspace Intelligence Builder" },
  Portfolio: { type: "portfolio_builder", owner: "Media Intelligence Engine" },
  Packages: { type: "packages_builder", owner: "Packages Builder" },
  Automations: { type: "automation", owner: "Automation Intelligence Builder" },
  Marketplace: { type: "marketplace", owner: "Marketplace Builder" },
  Business: { type: "website_builder", owner: "Business Builder" }
};
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}
function draftActionsFromIntent(intent) {
  const desiredState = {};
  const actions = [];
  const req = intent.originalRequest.toLowerCase();
  const systems = new Set(intent.affectedSystems);
  const push = (a) => {
    actions.push(a);
    setPath(desiredState, a.path, a.desired);
  };
  if (systems.has("Website") || systems.has("Branding") || /premium|luxury|homepage|website/.test(req)) {
    if (/premium|luxury|brand/.test(req)) {
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.premium_feel",
        desired: true,
        reason: "Owner asked for a more premium website feel.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          trustPct: 12,
          conversionPct: 4,
          complexity: "low",
          summary: "Premium branding cues tend to lift trust and conversion modestly."
        },
        confidence: Math.max(80, intent.confidence - 2),
        capabilityId: "update_homepage"
      });
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.hero.headline_tone",
        desired: "premium",
        reason: "Premium feel usually starts with hero headline tone.",
        risk: "low",
        dependencies: ["website.premium_feel"],
        estimatedImpact: {
          trustPct: 8,
          conversionPct: 3,
          complexity: "low",
          summary: "Clearer premium positioning on first impression."
        },
        confidence: Math.max(78, intent.confidence - 4),
        capabilityId: "update_hero"
      });
    }
    if (/faq/.test(req)) {
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.faq.enabled",
        desired: true,
        reason: "Owner wants FAQ content on the site.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { trustPct: 6, complexity: "low", summary: "FAQ reduces common objections." },
        confidence: 85,
        capabilityId: "add_sections"
      });
    }
    if (/explain.*(arrival|window)|website to explain|update my website|update my homepage|update.*(homepage|website)/.test(req)) {
      push({
        builderOwner: "Website Builder",
        builderType: "website_builder",
        system: "Website",
        path: "website.explain_arrival_windows",
        desired: true,
        reason: "Website should explain arrival windows so customers know what to expect.",
        risk: "low",
        dependencies: ["booking.arrival_window.enabled"],
        estimatedImpact: {
          trustPct: 10,
          conversionPct: 3,
          complexity: "low",
          summary: "Explaining arrival windows reduces confusion and no-shows."
        },
        confidence: Math.max(82, intent.confidence - 3),
        capabilityId: "update_homepage"
      });
    }
  }
  if (systems.has("Booking") || /same-?day|arrival window|minimum notice|travel buffer|minutes to drive|daily capacity|two jobs|weather|raining|reschedule exterior|fridays? (are|only).*ceramic|ceramic.*(friday|only|after 2)|coating.?only|estimate.?only|tuesdays? are estimate|optimiz(e|ing).*schedule|seasonal|snow removal|skill rout/.test(
    req
  )) {
    const bookingOwner = "Booking Intelligence Builder";
    if (/same-?day|no same.?day|minimum notice/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.same_day_bookings.allowed",
        desired: false,
        reason: "Owner does not want same-day bookings.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          schedulingFlexibility: "medium",
          complexity: "low",
          summary: "Protects schedule; slightly less last-minute flexibility."
        },
        confidence: Math.max(88, intent.confidence - 1),
        capabilityId: "no_same_day_bookings"
      });
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.minimum_notice.hours",
        desired: 24,
        reason: "Minimum notice of 24 hours enforces no same-day bookings.",
        risk: "medium",
        dependencies: ["booking.same_day_bookings.allowed"],
        estimatedImpact: {
          schedulingFlexibility: "high",
          complexity: "low",
          summary: "24h notice improves prep time and route planning."
        },
        confidence: Math.max(86, intent.confidence - 2),
        capabilityId: "booking_rules"
      });
    }
    if (/arrival window|arrival windows/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.arrival_window",
        desired: { enabled: true, before_minutes: 60, after_minutes: 60 },
        reason: "Owner wants appointment arrival windows.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          trustPct: 9,
          schedulingFlexibility: "high",
          complexity: "low",
          summary: "Arrival windows set clear expectations for customers."
        },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "arrival_windows"
      });
    }
    if (/travel|drive between|buffer between|minutes to drive|30.?minute travel|45.?minute/.test(req)) {
      const mins = /45/.test(req) ? 45 : /20/.test(req) ? 20 : 30;
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.travel_buffer.minutes",
        desired: { enabled: true, minutes: mins },
        reason: `Owner needs ${mins}-minute travel buffers between jobs.`,
        risk: "low",
        dependencies: [],
        estimatedImpact: {
          schedulingFlexibility: "medium",
          complexity: "low",
          summary: "Travel buffers protect drive time and reduce late arrivals."
        },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/two jobs|2 jobs|only two|maximum per day|daily capacity|capacity/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.daily_capacity.max_jobs",
        desired: { max_jobs: 2 },
        reason: "Owner wants a daily job capacity limit.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          schedulingFlexibility: "medium",
          complexity: "low",
          summary: "Daily capacity protects quality and travel."
        },
        confidence: Math.max(88, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/weather|raining|rain|reschedule exterior/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.weather.exterior_delay",
        desired: { enabled: true, condition: "rain", action: "reschedule_exterior" },
        reason: "Weather should delay exterior work.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          trustPct: 8,
          complexity: "medium",
          summary: "Rain-aware scheduling protects exterior jobs."
        },
        confidence: Math.max(87, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/winter|seasonal|snow removal|summer only/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.seasonal.rules",
        desired: { service: "snow_removal", seasons: ["winter"] },
        reason: "Seasonal availability for weather-dependent services.",
        risk: "low",
        dependencies: [],
        estimatedImpact: {
          complexity: "low",
          summary: "Seasonal rules match how the business actually operates."
        },
        confidence: Math.max(85, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/fridays? (are|only).*ceramic|ceramic.*(friday|only|after 2)|coating.?only|never.*after 2|after 2\s*pm/.test(
      req
    )) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.service_rules.ceramic_coating",
        desired: {
          service: "ceramic_coating",
          days: /friday/.test(req) ? ["friday"] : void 0,
          latest_start: /after 2|after 14|2\s*pm/.test(req) ? "14:00" : null
        },
        reason: "Service-specific scheduling for ceramic coatings.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          schedulingFlexibility: "medium",
          complexity: "medium",
          summary: "Ceramic coatings get dedicated schedule rules."
        },
        confidence: Math.max(88, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/estimate.?only|estimates on tuesday|tuesdays? are estimate/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.estimate_days",
        desired: { days: ["tuesday"], mode: "estimates_only" },
        reason: "Tuesdays are estimate-only availability.",
        risk: "low",
        dependencies: [],
        estimatedImpact: {
          complexity: "low",
          summary: "Estimate days keep sales work from competing with installs."
        },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/employee|skill|interiors|team/.test(req) && /book|schedul|rout|handle/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.team.skill_routing",
        desired: { skill: "interiors", assignee: "employee" },
        reason: "Skill routing for team scheduling.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          complexity: "medium",
          summary: "Jobs route to the teammate with the right skill."
        },
        confidence: Math.max(84, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
    if (/optimiz(e|ing).*schedule|route|driving across town/.test(req)) {
      push({
        builderOwner: bookingOwner,
        builderType: "booking",
        system: "Booking",
        path: "booking.optimization.route",
        desired: { enabled: true, horizon_days: 1 },
        reason: "Optimize tomorrow's schedule / route.",
        risk: "low",
        dependencies: [],
        estimatedImpact: {
          schedulingFlexibility: "high",
          complexity: "medium",
          summary: "Route optimization cuts cross-town driving."
        },
        confidence: Math.max(86, intent.confidence),
        capabilityId: "booking_rules"
      });
    }
  }
  if (systems.has("Workspace") || /jobs above|sidebar|move |hide revenue|hide marketing|never.*(use|look)|pin quick|calendar.*(home|landing)|homepage|mobile|phone workspace|what (do you think|should i)|focus mode|job day/.test(
    req
  )) {
    const workspaceOwner = "Workspace Intelligence Builder";
    if (/(?:put|move|place).+above|jobs above|sidebar/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.sidebar_order",
        desired: ["Jobs", "Customers"],
        reason: "Owner wants Jobs above Customers in navigation.",
        risk: "low",
        dependencies: [],
        estimatedImpact: {
          complexity: "low",
          summary: "Navigation matches how the owner works day to day."
        },
        confidence: Math.max(92, intent.confidence),
        capabilityId: "sidebar_order"
      });
    }
    if (/hide revenue|never.*(look at|use) revenue|don'?t (need|use) revenue/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.hidden_modules",
        desired: ["Revenue"],
        reason: "Owner never looks at Revenue \u2014 hide it.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Less clutter; focus on used surfaces." },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "dashboard_layout"
      });
    }
    if (/never.*(use|open|look).*marketing|hide marketing|don'?t (need|use) marketing/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.hidden_modules",
        desired: ["Marketing"],
        reason: "Owner never uses Marketing \u2014 hide it.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Hide unused Marketing module." },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "dashboard_layout"
      });
    }
    if (/calendar.*(home|landing|start)|make calendar|land on calendar|homepage.*calendar/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.homepage",
        desired: "Calendar",
        reason: "Make Calendar the adaptive homepage.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Homepage matches morning habits." },
        confidence: Math.max(91, intent.confidence),
        capabilityId: "dashboard_layout"
      });
    }
    if (/pin quick quote|quick quote|pin .+quote/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.pinned",
        desired: ["Quick Quote"],
        reason: "Pin Quick Quote for constant quote creation.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Faster access to Quick Quote." },
        confidence: Math.max(92, intent.confidence),
        capabilityId: "pin_actions"
      });
    }
    if (/mobile|phone workspace|for (my )?phone|build me a workspace for mobile/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.devices.phone",
        desired: {
          navigation: ["Today's Jobs", "Maps", "Customer Calls"],
          homepage: "Today's Jobs"
        },
        reason: "Build a mobile-first workspace.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "Phone prioritizes jobs, maps, calls." },
        confidence: Math.max(88, intent.confidence),
        capabilityId: "dashboard_layout"
      });
    }
    if (/what (do you think|should i)|recommend|suggest.*(change|workspace)|should change/.test(req)) {
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.recommendations",
        desired: { generate: true },
        reason: "Owner asked what to change \u2014 generate explained recommendations.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "AI recommendations with explanations." },
        confidence: Math.max(85, intent.confidence),
        capabilityId: "dashboard_layout"
      });
    }
    if (/focus mode|job day|sales day|admin day|growth day|what kind of day/.test(req)) {
      const mode = /sales/.test(req) ? "sales_day" : /admin|invoice/.test(req) ? "admin_day" : /growth|marketing|review/.test(req) ? "growth_day" : "job_day";
      push({
        builderOwner: workspaceOwner,
        builderType: "workspace_builder",
        system: "Workspace",
        path: "workspace.focus_mode",
        desired: { mode },
        reason: "Focus Mode reorganizes the workspace around today's priority.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "Day-type Focus Mode." },
        confidence: Math.max(87, intent.confidence),
        capabilityId: "dashboard_layout"
      });
    }
  }
  if (systems.has("CRM") && !systems.has("Workspace")) {
    if (/hide/.test(req)) {
      push({
        builderOwner: "CRM Builder",
        builderType: "crm",
        system: "CRM",
        path: "crm.modules.hide",
        desired: ["unused"],
        reason: "Owner wants to hide a CRM module.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Less clutter in CRM." },
        confidence: 80,
        capabilityId: "update_customer"
      });
    }
    if (/pin/.test(req)) {
      push({
        builderOwner: "CRM Builder",
        builderType: "crm",
        system: "CRM",
        path: "crm.widgets.pin",
        desired: ["priority"],
        reason: "Owner wants a CRM widget pinned.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Faster access to pinned work." },
        confidence: 80,
        capabilityId: "update_customer"
      });
    }
  }
  if (systems.has("Portfolio") || /portfolio|photos|gallery|upload|instagram|before.?after|hero|homepage.*(photo|image)|weak photo|organize everything|visual timeline|evolved over/.test(
    req
  )) {
    const mediaOwner = "Media Intelligence Engine";
    if (/upload|here are|today'?s photos|these \d+ photos|organize everything|photos/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.gallery.organize",
        desired: true,
        reason: "Organize uploaded photos with Media Intelligence.",
        risk: "low",
        dependencies: [],
        estimatedImpact: {
          trustPct: 11,
          conversionPct: 5,
          complexity: "medium",
          summary: "Organized gallery strengthens proof of work."
        },
        confidence: Math.max(84, intent.confidence - 2),
        capabilityId: "upload_photos"
      });
    }
    if (/ceramic.*galler|galler.*ceramic|build.*(galler|portfolio)|portfolio/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.gallery",
        desired: { organize: true, service: /ceramic/.test(req) ? "ceramic_coating" : void 0 },
        reason: /ceramic/.test(req) ? "Build a ceramic coating gallery." : "Build / organize portfolio gallery.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { trustPct: 12, complexity: "medium", summary: "Curated service gallery." },
        confidence: Math.max(86, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
    if (/hero|homepage.*(photo|image|hero)|replace.*(homepage|hero|weak)/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.hero_images.select",
        desired: true,
        reason: "Replace homepage hero with stronger media.",
        risk: "medium",
        dependencies: ["portfolio.gallery.organize"],
        estimatedImpact: { trustPct: 7, conversionPct: 3, complexity: "low", summary: "Stronger first impression." },
        confidence: 82,
        capabilityId: "manage_gallery"
      });
    }
    if (/before.?after|before and after|pairs/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.before_after",
        desired: { pair: true },
        reason: "Create before/after pairs.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { trustPct: 10, complexity: "low", summary: "Transformation pairs build trust." },
        confidence: Math.max(88, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
    if (/instagram|carousel|social content/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.social.instagram_carousel",
        desired: { options: 3 },
        reason: "Build Instagram carousel content.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Social-ready carousels from uploads." },
        confidence: Math.max(85, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
    if (/weak photo|show me weak|remove weak|weaker image/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.quality.weak",
        desired: { flag_weak: true },
        reason: "Identify weak photos.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Drop weak shots that hurt trust." },
        confidence: Math.max(87, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
    if (/premium|more premium|luxury/.test(req) && /portfolio|gallery|media|photo/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.creative",
        desired: { premium: true },
        reason: "Premium creative pass on portfolio media.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: { trustPct: 9, complexity: "medium", summary: "Reorder, captions, hero for premium feel." },
        confidence: Math.max(84, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
    if (/caption/.test(req) || /12 photos|photos/.test(req) && /hero|upload/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.captions.generate",
        desired: true,
        reason: "Generate captions for portfolio images.",
        risk: "low",
        dependencies: ["portfolio.gallery.organize"],
        estimatedImpact: { trustPct: 5, complexity: "low", summary: "Captions add context for visitors." },
        confidence: 78,
        capabilityId: "manage_gallery"
      });
    }
    if (/evolved|visual timeline|how my business|over the last year|business memory/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.memory.visual_timeline",
        desired: true,
        reason: "Business Memory Through Media \u2014 visual timeline.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { trustPct: 8, complexity: "low", summary: "Living visual history of the business." },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
    if (/upload|ceramic|12 photo|multi.?surface|publish/.test(req)) {
      push({
        builderOwner: mediaOwner,
        builderType: "portfolio_builder",
        system: "Portfolio",
        path: "portfolio.publish.surfaces",
        desired: {
          surfaces: [
            "website_gallery",
            "marketplace_profile",
            "portfolio",
            "quote_library",
            "instagram_carousel",
            "google_business",
            "hero_candidate"
          ]
        },
        reason: "Multi-surface publishing proposal from one upload.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "One approval \u2192 many destinations." },
        confidence: Math.max(83, intent.confidence),
        capabilityId: "manage_gallery"
      });
    }
  }
  if (systems.has("Automations") || /prep instruction|automation|workflow|reminder|review request|ask for (a )?review|quote.*(follow|5 day)|rain|reschedule exterior|membership|friday.*(summary|report)|recurring customer|when someone books/.test(
    req
  )) {
    const autoOwner = "Automation Intelligence Builder";
    if (/prep instruction|prep (email|message)|ceramic.*prep|prep.*ceramic|after ceramic|when someone books.*ceramic|books a ceramic/.test(req)) {
      const multi = /when someone books|books a ceramic|ceramic coating\.\.\./.test(req);
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: multi ? "automations.workflows.multisystem_ceramic" : "automations.workflows.prep_after_ceramic",
        desired: [
          {
            id: multi ? "multisystem_ceramic" : "prep_after_ceramic",
            trigger: "booking.created.service:ceramic_coating",
            steps: multi ? [
              { type: "updateBooking", config: { calendar_reminder: true } },
              { type: "sendEmail", config: { template: "prep_instructions" } },
              { type: "tagCrm", config: { tag: "ceramic" } },
              { type: "portalMessage", config: { template: "prep" } },
              { type: "wait", config: { days: 1 } },
              { type: "sendEmail", config: { template: "review_request" } },
              { type: "upsell", config: { offer: "maintenance" } }
            ] : [
              { type: "createWorkflow", config: { name: "Ceramic coating prep" } },
              { type: "wait", config: { minutes: 5 } },
              { type: "sendEmail", config: { template: "prep_instructions" } },
              { type: "wait", config: { until: "day_before" } },
              { type: "sendReminder", config: { channel: "sms" } }
            ]
          }
        ],
        reason: multi ? "Multi-system ceramic booking workflow from one conversation." : "Send prep instructions after ceramic coating bookings.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: {
          trustPct: 10,
          complexity: "medium",
          summary: multi ? "Booking, CRM, portal, review, and upsell from one ask." : "Automated prep instructions reduce day-of questions."
        },
        confidence: Math.max(85, intent.confidence - 3),
        capabilityId: "create_workflow"
      });
    }
    if (/review|ask for (a )?review|review request/.test(req)) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows.review_after_job",
        desired: [
          {
            id: "review_after_job",
            trigger: "booking.completed",
            steps: [
              { type: "wait", config: { days: 3 } },
              { type: "sendEmail", config: { template: "review_request" } }
            ]
          }
        ],
        reason: "Ask for reviews after every completed job.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { trustPct: 12, complexity: "low", summary: "Consistent review asks without manual work." },
        confidence: Math.max(88, intent.confidence),
        capabilityId: "create_workflow"
      });
    }
    if (/quote.*(follow|5 day|five day)|follow up on quotes|haven'?t responded/.test(req)) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows.quote_followup",
        desired: [
          {
            id: "quote_followup_5d",
            trigger: "quote.no_response.days:5",
            steps: [{ type: "sendEmail", config: { template: "quote_followup" } }]
          }
        ],
        reason: "Follow up on quotes after 5 days.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { conversionPct: 5, complexity: "low", summary: "Recover silent quotes automatically." },
        confidence: Math.max(87, intent.confidence),
        capabilityId: "create_workflow"
      });
    }
    if (/reschedule exterior.*rain|rain.*reschedule exterior|if it rains/.test(req)) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows.weather_exterior",
        desired: [
          {
            id: "weather_exterior",
            trigger: "weather.rain.forecast",
            steps: [
              { type: "updateBooking", config: { action: "reschedule_exterior" } },
              { type: "sendEmail", config: { template: "weather_reschedule" } }
            ]
          }
        ],
        reason: "Reschedule exterior work if it rains.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "Weather-aware operations automation." },
        confidence: Math.max(86, intent.confidence),
        capabilityId: "create_workflow"
      });
    }
    if (/membership|charge.*month|monthly billing|bill.*membership/.test(req)) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows.membership_billing",
        desired: [
          {
            id: "membership_monthly",
            trigger: "schedule.monthly",
            steps: [
              { type: "charge", config: { product: "membership" } },
              { type: "sendEmail", config: { template: "receipt" } }
            ]
          }
        ],
        reason: "Charge memberships every month.",
        risk: "high",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "Hands-off membership renewals." },
        confidence: Math.max(84, intent.confidence),
        capabilityId: "create_workflow"
      });
    }
    if (/friday.*(summary|report)|business summary|weekly summary|send me a friday/.test(req)) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows.friday_summary",
        desired: [
          {
            id: "friday_summary",
            trigger: "schedule.friday",
            steps: [
              { type: "report", config: { type: "weekly_summary" } },
              { type: "sendEmail", config: { template: "owner_summary" } }
            ]
          }
        ],
        reason: "Send a Friday business summary.",
        risk: "low",
        dependencies: [],
        estimatedImpact: { complexity: "low", summary: "Owner gets a weekly ops snapshot automatically." },
        confidence: Math.max(90, intent.confidence),
        capabilityId: "create_workflow"
      });
    }
    if (/recurring customer|automate.*recurring|repeat customer/.test(req)) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows.recurring_customers",
        desired: [
          {
            id: "recurring_customers",
            trigger: "customer.recurring.due",
            steps: [
              { type: "updateBooking", config: { propose_next: true } },
              { type: "sendEmail", config: { template: "recurring_confirm" } }
            ]
          }
        ],
        reason: "Automate recurring customers.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "Repeat customers rebook with less chase." },
        confidence: Math.max(85, intent.confidence),
        capabilityId: "create_workflow"
      });
    }
    if (!actions.some((a) => a.path.startsWith("automations."))) {
      push({
        builderOwner: autoOwner,
        builderType: "automation",
        system: "Automations",
        path: "automations.workflows",
        desired: [
          {
            id: "generic_workflow",
            trigger: "booking.created",
            steps: [
              { type: "createWorkflow", config: { name: "Owner-requested automation" } },
              { type: "sendEmail", config: { template: "notification" } }
            ]
          }
        ],
        reason: "Owner wants an automation workflow.",
        risk: "medium",
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: "Automation from natural language." },
        confidence: Math.max(80, intent.confidence - 5),
        capabilityId: "create_workflow"
      });
    }
  }
  if (systems.has("Packages") || /package|membership|pricing tier/.test(req)) {
    push({
      builderOwner: "Packages Builder",
      builderType: "packages_builder",
      system: "Packages",
      path: "packages.tiers",
      desired: [{ name: "Membership", enabled: true }],
      reason: "Owner wants package / pricing tier changes.",
      risk: "medium",
      dependencies: [],
      estimatedImpact: { conversionPct: 4, complexity: "medium", summary: "Clearer offers for customers." },
      confidence: 80,
      capabilityId: "package_create"
    });
  }
  if (!actions.length) {
    for (const cap of intent.requiredCapabilities.slice(0, 3)) {
      const meta = SYSTEM_TO_BUILDER[TOOL_SYSTEM(cap.toolId)] || SYSTEM_TO_BUILDER.Website;
      const path = `${meta.type.replace(/_builder$/, "").replace("booking", "booking")}.capability.${cap.capabilityId}`;
      push({
        builderOwner: meta.owner,
        builderType: meta.type,
        system: TOOL_SYSTEM(cap.toolId) || "Business",
        path: path.includes(".") ? path : `website.capability.${cap.capabilityId}`,
        desired: true,
        reason: `Capability ${cap.capabilityLabel} required by Builder Intent.`,
        risk: intent.estimatedRisk,
        dependencies: [],
        estimatedImpact: { complexity: "medium", summary: `Plan includes ${cap.capabilityLabel}.` },
        confidence: intent.confidence,
        capabilityId: cap.capabilityId
      });
    }
  }
  return { desiredState, actions };
}
function TOOL_SYSTEM(toolId) {
  const map = {
    website_builder: "Website",
    booking: "Booking",
    crm: "CRM",
    workspace_builder: "Workspace",
    portfolio_builder: "Portfolio",
    packages_builder: "Packages",
    automation: "Automations",
    marketplace: "Marketplace",
    image_processor: "Portfolio"
  };
  return map[toolId] || "Business";
}
function validateChangePlan(plan) {
  const issues = [];
  const paths = /* @__PURE__ */ new Set();
  let noDuplicates = true;
  let noConflicts = true;
  let validCapabilities = true;
  let supportedBuilders = true;
  const validPermissions = true;
  for (const a of plan.changes) {
    if (paths.has(a.path)) {
      noDuplicates = false;
      issues.push(`Duplicate action path: ${a.path}`);
    }
    paths.add(a.path);
    if (!SUPPORTED_BUILDERS.has(a.builderType)) {
      supportedBuilders = false;
      issues.push(`Unsupported builder: ${a.builderType}`);
    }
    if (!a.builderOwner) {
      issues.push(`Action ${a.path} missing builder owner`);
      validCapabilities = false;
    }
    if (a.capabilityId === void 0) {
      validCapabilities = false;
      issues.push(`Action ${a.path} missing capability`);
    }
  }
  const sameDay = plan.changes.find((c) => c.path === "booking.same_day_bookings.allowed");
  if (sameDay && sameDay.desired === true) {
    const notice = plan.changes.find((c) => c.path === "booking.minimum_notice.hours");
    if (notice) {
      noConflicts = false;
      issues.push("Conflict: same-day allowed with minimum notice");
    }
  }
  const blob = JSON.stringify(plan.desiredState);
  if (/\b(SELECT|INSERT|UPDATE|DELETE)\s+|useEffect|setState|fetch\(/i.test(blob)) {
    issues.push("Desired state must stay declarative \u2014 no SQL/React/API payloads");
    noConflicts = false;
  }
  const ok = issues.length === 0 && noDuplicates && noConflicts && validCapabilities && supportedBuilders && plan.changes.length > 0;
  return {
    ok,
    issues,
    checked: {
      noConflicts,
      noDuplicates,
      validCapabilities,
      validPermissions,
      supportedBuilders
    }
  };
}
function aggregateImpact(actions) {
  const trust = actions.reduce((s, a) => s + (a.estimatedImpact.trustPct || 0), 0);
  const conv = actions.reduce((s, a) => s + (a.estimatedImpact.conversionPct || 0), 0);
  const flex = actions.map((a) => a.estimatedImpact.schedulingFlexibility).find(Boolean) || null;
  const complexity = actions.some((a) => a.estimatedImpact.complexity === "high") ? "high" : actions.some((a) => a.estimatedImpact.complexity === "medium") ? "medium" : "low";
  return {
    trustPct: trust || null,
    conversionPct: conv || null,
    schedulingFlexibility: flex,
    complexity,
    summary: actions.map((a) => a.estimatedImpact.summary).filter(Boolean).slice(0, 3).join(" ")
  };
}
function maxRisk(actions) {
  if (actions.some((a) => a.risk === "high")) return "high";
  if (actions.some((a) => a.risk === "medium")) return "medium";
  return "low";
}
function generateChangePlan(intent, opts = {}) {
  const { desiredState, actions: drafts } = draftActionsFromIntent(intent);
  const replayId = opts.missionControlReplayId ?? null;
  const changes = drafts.map((d) => ({
    ...d,
    actionId: uid("act"),
    missionControlReplayId: replayId
  }));
  const builders = [...new Set(changes.map((c) => c.builderType))];
  const builderType = builders.length > 1 ? "multi" : builders[0] || "multi";
  const impact = aggregateImpact(drafts);
  const risk = maxRisk(drafts);
  const confidence = clamp(
    changes.length ? changes.reduce((s, c) => s + c.confidence, 0) / changes.length : intent.confidence
  );
  const deps = [...new Set(changes.flatMap((c) => c.dependencies))];
  const draftPlan = {
    id: uid("cpl"),
    version: CHANGE_PLAN_VERSION,
    builderType,
    intentId: intent.intentId,
    title: intent.intentLabel,
    description: `Declarative Change Plan for: ${intent.ownerGoal}`,
    affectedSystems: [...intent.affectedSystems],
    requiredCapabilities: [...intent.requiredCapabilities],
    desiredState,
    changes,
    dependencies: deps,
    risk,
    confidence,
    requiresApproval: true,
    estimatedImpact: impact,
    rollbackStrategy: {
      mode: "restore_previous_desired_state",
      note: "Epic 5 will restore the prior desired-state snapshot. Epic 2 only describes desired state."
    },
    reasoning: [
      {
        reason: "Change Plan Engine mapped Builder Intent into declarative desired state (not procedural steps).",
        evidence: [
          `intent:${intent.intentId}`,
          `category:${intent.intentCategory}`,
          ...changes.map((c) => `path:${c.path}`)
        ],
        confidence
      },
      ...intent.reasoning
    ],
    status: "draft",
    applied: false,
    executed: false,
    previewGenerated: false,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    originalRequest: intent.originalRequest
  };
  const validation = validateChangePlan(draftPlan);
  const changePlan = { ...draftPlan, validation };
  return { changePlan, fromIntentId: intent.intentId };
}
var HublyChangePlanEngine = {
  version: CHANGE_PLAN_VERSION,
  owner: CHANGE_PLAN_OWNER,
  generate: generateChangePlan,
  validate: validateChangePlan
};
export {
  CHANGE_PLAN_OWNER,
  CHANGE_PLAN_VERSION,
  HublyChangePlanEngine,
  generateChangePlan,
  validateChangePlan
};
