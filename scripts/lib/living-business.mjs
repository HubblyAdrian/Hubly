/**
 * Milestone 2 · Epic 11 — Living Business
 *
 * Continuous evolution with approval — never auto-apply.
 * Includes "What I Learned" Journal — accumulated business intelligence.
 */
export const LIVING_VERSION = "1.0.0";
export const LIVING_LABEL = "Living Business";

export const EVOLUTION_SYSTEMS = [
  "Website","Booking flow","Packages","Portfolio","Pricing","Reviews","SEO",
  "Business Health","Customer behavior","Marketplace trends","Competitor changes","Business goals",
];

export const EVOLUTION_CATEGORIES = [
  { id: "brand", label: "Brand" },
  { id: "booking", label: "Booking" },
  { id: "growth", label: "Growth" },
  { id: "operations", label: "Operations" },
  { id: "marketplace", label: "Marketplace" },
  { id: "finance", label: "Finance" },
];

export const APPROVAL_WORKFLOW = [
  { id: "preview", label: "Preview" },
  { id: "conversation", label: "Conversation" },
  { id: "approval", label: "Approval" },
  { id: "deployment", label: "Deployment" },
];

function resolveKey(ctx = {}) {
  const raw = String(ctx.industryId || ctx.industryKey || ctx.industry || ctx.businessType || ctx.seed || "").toLowerCase();
  if (/pressure|power\s*wash|soft\s*wash/.test(raw)) return "pressure_washing";
  if (/photo|wedding/.test(raw)) return "photography";
  if (/hvac|heating|furnace|air\s*condition/.test(raw)) return "hvac";
  if (/lawn|landscap|mow/.test(raw)) return "lawn_care";
  if (/clean|maid|airbnb|turnover|short.?term/.test(raw)) return "cleaning";
  if (/\bspa\b|massage|facial|wellness/.test(raw)) return "spa";
  return "pressure_washing";
}

function weekIndex(ctx = {}) {
  if (ctx.weekIndex != null && Number.isFinite(Number(ctx.weekIndex))) return Math.abs(Math.floor(Number(ctx.weekIndex))) % 4;
  if (ctx.dayIndex != null) return Math.floor(Math.abs(Number(ctx.dayIndex)) / 7) % 4;
  return Math.floor(Date.now() / (7 * 86400000)) % 4;
}

function opp(partial) {
  return {
    preview: true,
    neverAutoApply: true,
    ...partial,
    hasWhy: true,
    hasConfidence: true,
    hasImpact: true,
    hasPreview: true,
  };
}

/** Industry opportunity pools — rotated by week so a month never repeats. */
export const INDUSTRY_EVOLUTION_POOL = {
  pressure_washing: [
    [
      opp({ id: "pw-hero", category: "brand", title: "Homepage Hero", whatChanged: "New portfolio photos available.", why: "I found a stronger hero layout based on your latest portfolio photos.", impact: "+9% trust", confidence: 94, effort: "15 min", current: "Generic hero with stock driveway", recommended: "Before/after hero using your last five jobs", reasoning: "Finished work outperforms stock for local trust.", seasonal: false }),
      opp({ id: "pw-windows", category: "booking", title: "Arrival Windows", whatChanged: "Abandoned bookings rose on all-day holds.", why: "2-hour arrival windows cut no-shows for driveway jobs.", impact: "-18% abandoned bookings", confidence: 91, effort: "10 min", current: "All-day arrival holds", recommended: "2-hour arrival windows", reasoning: "Homeowners hate waiting all day.", seasonal: false }),
      opp({ id: "pw-member", category: "growth", title: "Memberships", whatChanged: "Repeat neighbors asking about next wash.", why: "Quarterly soft-wash memberships lock route density.", impact: "+$1,200/mo potential", confidence: 88, effort: "30 min", current: "One-off packages only", recommended: "Quarterly soft-wash membership", reasoning: "Repeat yards beat windshield chasing.", seasonal: false }),
    ],
    [
      opp({ id: "pw-spring", category: "marketplace", title: "House Wash Campaign", whatChanged: "Spring demand rising in your area.", why: "Seasonal Intelligence: spring arrives — house wash campaigns convert now.", impact: "+seasonal bookings", confidence: 90, effort: "25 min", current: "No seasonal campaign", recommended: "Spring house wash landing + offer", reasoning: "Local search for house wash spikes in spring.", seasonal: true, season: "spring" }),
      opp({ id: "pw-price", category: "finance", title: "Raise Package Floor", whatChanged: "Your middle package is chosen 68% of the time.", why: "Room to lift the floor without losing conversion.", impact: "+11% AOV", confidence: 86, effort: "20 min", current: "Entry package underpriced vs demand", recommended: "Raise entry package 8–12%", reasoning: "Middle-package dominance signals pricing headroom.", seasonal: false }),
      opp({ id: "pw-follow", category: "operations", title: "Quote Follow-up Automation", whatChanged: "Three quotes aged past 48 hours.", why: "Automate same-day nudges after quote send.", impact: "+quote recovery", confidence: 92, effort: "20 min", current: "Manual follow-ups only", recommended: "Same-day quote nudge automation", reasoning: "Warm quotes cool fast in this trade.", seasonal: false }),
    ],
    [
      opp({ id: "pw-gutter", category: "marketplace", title: "Gutter Add-on", whatChanged: "Gutter cleaning demand rising next month.", why: "Bundle gutter cleaning with soft-wash.", impact: "+bundle AOV", confidence: 87, effort: "25 min", current: "No gutter attach", recommended: "Gutter add-on on booking", reasoning: "Seasonal demand aligns with soft-wash routes.", seasonal: true, season: "fall" }),
      opp({ id: "pw-colors", category: "brand", title: "Calmer Palette", whatChanged: "You dismissed bold concepts twice.", why: "Creative Memory: lean minimal — quieter contrast fits your taste.", impact: "+brand consistency", confidence: 89, effort: "15 min", current: "High-energy accents", recommended: "Minimal navy + orange accent", reasoning: "Owner preference history rejects bold.", seasonal: false }),
      opp({ id: "pw-referral", category: "growth", title: "Neighbor Referral Offer", whatChanged: "Route density still has street gaps.", why: "Referral offer for neighbors on the same street.", impact: "+route fill", confidence: 85, effort: "20 min", current: "No referral loop", recommended: "Street-neighbor referral credit", reasoning: "Density is the profit lever.", seasonal: false }),
    ],
    [
      opp({ id: "pw-seo", category: "brand", title: "Local SEO Proof Block", whatChanged: "Organic visits up, conversion flat.", why: "Add licensed + service-area proof above fold.", impact: "+local conversion", confidence: 88, effort: "15 min", current: "Proof buried in footer", recommended: "Above-fold service-area + reviews", reasoning: "Local trust chips convert cold search.", seasonal: false }),
      opp({ id: "pw-deposit", category: "finance", title: "Increase Deposits", whatChanged: "No-show cost on large jobs rose.", why: "Raise deposits on packages over $400.", impact: "-no-show loss", confidence: 84, effort: "10 min", current: "Low or no deposit", recommended: "25% deposit on large packages", reasoning: "Commitment reduces cancellations.", seasonal: false }),
      opp({ id: "pw-schedule", category: "operations", title: "Weather Reschedule Assist", whatChanged: "Two rain delays last week.", why: "Proactive weather reschedule messages.", impact: "-chase messages", confidence: 93, effort: "15 min", current: "Reactive reschedules", recommended: "Weather-triggered reschedule assist", reasoning: "Owners who message first keep reviews.", seasonal: false }),
    ],
  ],
  photography: [
    [
      opp({ id: "ph-hero", category: "brand", title: "Atmosphere Hero", whatChanged: "Gear-heavy hero underperforms.", why: "Feature real couple atmosphere above packages.", impact: "+emotional conversion", confidence: 93, effort: "15 min", current: "Gear-forward hero", recommended: "Atmosphere couple hero", reasoning: "Emotion converts wedding inquiries.", seasonal: false }),
      opp({ id: "ph-pkg", category: "booking", title: "Default Weekend Package", whatChanged: "Decision fatigue on packages.", why: "Make one weekend package the default.", impact: "Less decision fatigue", confidence: 90, effort: "20 min", current: "Six equal packages", recommended: "One default weekend package", reasoning: "Clarity beats option sprawl.", seasonal: false }),
      opp({ id: "ph-wedding", category: "marketplace", title: "Wedding Landing Page", whatChanged: "Wedding season begins.", why: "Seasonal Intelligence: wedding landing page now.", impact: "+seasonal inquiries", confidence: 92, effort: "40 min", current: "Generic photography homepage", recommended: "Dedicated wedding landing page", reasoning: "Seasonal search intent is wedding-specific.", seasonal: true, season: "wedding" }),
    ],
    [
      opp({ id: "ph-album", category: "operations", title: "Album Delivery SLA", whatChanged: "Editing queue growing.", why: "Ship oldest album early to unlock referrals.", impact: "+referral rate", confidence: 91, effort: "today", current: "FIFO ignored under new shoots", recommended: "Oldest-album-first rule", reasoning: "Speed of delivery drives referrals.", seasonal: false }),
      opp({ id: "ph-price", category: "finance", title: "Premium Floor", whatChanged: "Discount messaging underperforms.", why: "What I Learned: premium messaging beats discounts.", impact: "+AOV", confidence: 88, effort: "15 min", current: "Occasional discount banners", recommended: "Remove discounts; lead premium", reasoning: "Audience responds to elevation, not cuts.", seasonal: false }),
      opp({ id: "ph-referral", category: "growth", title: "Post-Album Referral Ask", whatChanged: "Three happy deliveries last week.", why: "Ask for referrals right after album delivery.", impact: "+qualified intros", confidence: 87, effort: "10 min", current: "No systematic referral ask", recommended: "Post-delivery referral prompt", reasoning: "Gratitude peaks at delivery.", seasonal: false }),
    ],
    [
      opp({ id: "ph-about", category: "brand", title: "Rewrite About", whatChanged: "About still template-like.", why: "Rewrite About in your voice.", impact: "+trust on about visits", confidence: 89, effort: "25 min", current: "Template bio", recommended: "Story-led About", reasoning: "Couples buy the person behind the lens.", seasonal: false }),
      opp({ id: "ph-inquiry", category: "booking", title: "Simpler Inquiry Form", whatChanged: "Mobile abandon on long form.", why: "Collapse inquiry to date + email first.", impact: "-form abandon", confidence: 90, effort: "20 min", current: "Long multi-field inquiry", recommended: "Two-step inquiry", reasoning: "Warm leads hate long forms.", seasonal: false }),
      opp({ id: "ph-mini", category: "marketplace", title: "Holiday Mini Sessions", whatChanged: "Holiday season approaching.", why: "Open mini-session packages.", impact: "+off-peak revenue", confidence: 86, effort: "30 min", current: "Full sessions only", recommended: "Holiday mini-session offer", reasoning: "Seasonal demand for short sessions.", seasonal: true, season: "holiday" }),
    ],
    [
      opp({ id: "ph-headline", category: "brand", title: "Stronger Homepage Headline", whatChanged: "Cold traffic conversion flat.", why: "Outcome-first headline ready.", impact: "+cold traffic conversion", confidence: 91, effort: "10 min", current: "Feature-list headline", recommended: "Outcome-first promise", reasoning: "Outcomes outperform gear lists.", seasonal: false }),
      opp({ id: "ph-deposit", category: "finance", title: "Raise Wedding Deposits", whatChanged: "Date holds without commitment.", why: "Increase wedding deposits.", impact: "-soft holds", confidence: 85, effort: "10 min", current: "Low deposit", recommended: "Higher wedding deposit", reasoning: "Serious couples commit earlier.", seasonal: false }),
      opp({ id: "ph-second", category: "operations", title: "Second Shooter Buffer", whatChanged: "Two full weekends stacked.", why: "Protect second-shooter booking buffer.", impact: "-crew scramble", confidence: 84, effort: "15 min", current: "Ad-hoc second shooter", recommended: "Pre-booked weekend buffer", reasoning: "Peak weekends need coverage.", seasonal: false }),
    ],
  ],
  hvac: [
    [
      opp({ id: "hv-proof", category: "brand", title: "Licensed & Insured Above Fold", whatChanged: "Emergency fear still high.", why: "Publish credentials above the fold.", impact: "Lower emergency fear", confidence: 94, effort: "10 min", current: "Credentials in footer", recommended: "Hero proof chips", reasoning: "Emergency buyers need instant proof.", seasonal: false }),
      opp({ id: "hv-tune", category: "growth", title: "Tune-up Plans", whatChanged: "Five past emergency customers idle.", why: "Offer tune-up plans to past emergencies.", impact: "Recurring maintenance starts", confidence: 91, effort: "25 min", current: "Emergency-only relationship", recommended: "Tune-up plan offer", reasoning: "Trust already earned.", seasonal: false }),
      opp({ id: "hv-same", category: "booking", title: "Same-Day Windows", whatChanged: "Buyers book first available trusted tech.", why: "Open same-day windows this week.", impact: "Faster first bookings", confidence: 90, effort: "15 min", current: "Next-day only", recommended: "Two same-day slots", reasoning: "Speed wins HVAC.", seasonal: false }),
    ],
    [
      opp({ id: "hv-heat", category: "marketplace", title: "Pre-Season Tune-up Campaign", whatChanged: "Cooling/heating season shift.", why: "Seasonal Intelligence: pre-season tune-ups convert now.", impact: "+seasonal plan sales", confidence: 92, effort: "30 min", current: "No seasonal campaign", recommended: "Pre-season tune-up campaign", reasoning: "Seasonal search intent is predictable.", seasonal: true, season: "preseason" }),
      opp({ id: "hv-parts", category: "operations", title: "Van Parts Checklist", whatChanged: "Return trip last week.", why: "Attach parts checklists to jobs.", impact: "-return trips", confidence: 93, effort: "20 min", current: "Ad-hoc van stock", recommended: "Job-linked parts checklist", reasoning: "Second trips destroy margins.", seasonal: false }),
      opp({ id: "hv-member", category: "finance", title: "Membership on Homepage", whatChanged: "Memberships buried.", why: "Feature maintenance memberships on homepage.", impact: "+predictable revenue", confidence: 88, effort: "15 min", current: "Memberships in services only", recommended: "Homepage membership CTA", reasoning: "Visibility drives recurring revenue.", seasonal: false }),
    ],
    [
      opp({ id: "hv-call", category: "operations", title: "Live Quote Calls", whatChanged: "Two quotes aging.", why: "Call open quotes — not another email.", impact: "Recover stalled jobs", confidence: 89, effort: "today", current: "Email-only follow-up", recommended: "Same-day quote calls", reasoning: "HVAC decisions move live.", seasonal: false }),
      opp({ id: "hv-deposit", category: "finance", title: "Install Deposits", whatChanged: "Large install holds soft.", why: "Raise deposits on installs.", impact: "-cancel risk", confidence: 86, effort: "10 min", current: "Low install deposit", recommended: "Higher install deposit", reasoning: "Commitment protects schedule.", seasonal: false }),
      opp({ id: "hv-review", category: "growth", title: "Post-Emergency Reviews", whatChanged: "Silent after successful fixes.", why: "Ask for reviews day after emergency wins.", impact: "+local trust", confidence: 90, effort: "10 min", current: "No review ask", recommended: "Day-after review ask", reasoning: "Relief peaks next day.", seasonal: false }),
    ],
    [
      opp({ id: "hv-filter", category: "marketplace", title: "Filter Bundle Upsell", whatChanged: "Marketplace demand for maintenance bundles.", why: "Add filter + maintenance bundle.", impact: "+AOV", confidence: 85, effort: "20 min", current: "À la carte only", recommended: "Filter + tune-up bundle", reasoning: "Bundles lift ticket size.", seasonal: false }),
      opp({ id: "hv-sla", category: "booking", title: "Member Emergency SLA", whatChanged: "Members unclear on priority.", why: "Clarify member emergency SLA on site.", impact: "+member retention", confidence: 87, effort: "15 min", current: "Vague priority language", recommended: "Clear member SLA block", reasoning: "Clarity reduces churn.", seasonal: false }),
      opp({ id: "hv-minimal", category: "brand", title: "Quieter Brand Direction", whatChanged: "You rejected bold twice.", why: "Creative Memory: prefer quieter premium.", impact: "+fit to taste", confidence: 88, effort: "20 min", current: "High-energy promo look", recommended: "Quiet premium direction", reasoning: "Preference history steers creative.", seasonal: false }),
    ],
  ],
  lawn_care: [
    [
      opp({ id: "ln-density", category: "growth", title: "Neighborhood Route Fill", whatChanged: "Scattered yards burning drive time.", why: "Invite ten neighbors onto one street route.", impact: "Route density grows", confidence: 92, effort: "20 min", current: "Scattered one-offs", recommended: "Street density campaign", reasoning: "Density beats windshield time.", seasonal: false }),
      opp({ id: "ln-photos", category: "brand", title: "Before/After Yard Proof", whatChanged: "Stock lawn photos still on site.", why: "Upload three real yard transformations.", impact: "+reliability proof", confidence: 91, effort: "15 min", current: "Stock photography", recommended: "Real before/after gallery", reasoning: "Proof beats stock.", seasonal: false }),
      opp({ id: "ln-pause", category: "booking", title: "Pause / Resume", whatChanged: "Seasonal cancels instead of pauses.", why: "Enable pause/resume on plans.", impact: "Fewer cancellations", confidence: 90, effort: "20 min", current: "Cancel-only", recommended: "Pause/resume controls", reasoning: "Pausing beats churn.", seasonal: false }),
    ],
    [
      opp({ id: "ln-peak", category: "marketplace", title: "Peak Growing Campaign", whatChanged: "Growing season demand rising.", why: "Seasonal Intelligence: push weekly frequency now.", impact: "+frequency upgrades", confidence: 89, effort: "25 min", current: "Static biweekly push", recommended: "Peak-season weekly upgrade offer", reasoning: "Growth season lifts frequency need.", seasonal: true, season: "growing" }),
      opp({ id: "ln-route", category: "operations", title: "Reorder Today's Route", whatChanged: "Stops still scattered.", why: "Cluster stops by neighborhood.", impact: "-drive time", confidence: 93, effort: "10 min", current: "Creation-order routing", recommended: "Neighborhood cluster route", reasoning: "Sequencing saves fuel and time.", seasonal: false }),
      opp({ id: "ln-freq", category: "booking", title: "Clear Frequency CTAs", whatChanged: "Biweekly buried on site.", why: "Highlight weekly/biweekly on homepage.", impact: "Higher repeat revenue", confidence: 88, effort: "15 min", current: "Frequency unclear", recommended: "Homepage frequency CTAs", reasoning: "Clear choices convert.", seasonal: false }),
    ],
    [
      opp({ id: "ln-leaf", category: "marketplace", title: "Leaf Cleanup Offer", whatChanged: "Fall leaf demand approaching.", why: "Add leaf cleanup package.", impact: "+seasonal revenue", confidence: 87, effort: "25 min", current: "Mow-only menu", recommended: "Leaf cleanup package", reasoning: "Seasonal demand is predictable.", seasonal: true, season: "fall" }),
      opp({ id: "ln-check", category: "operations", title: "Weekly Check-ins", whatChanged: "Five weeklies due for contact.", why: "Check in before silent cancels.", impact: "+retention", confidence: 86, effort: "15 min", current: "No proactive check-ins", recommended: "Five weekly check-in texts", reasoning: "Quiet satisfaction needs a pulse.", seasonal: false }),
      opp({ id: "ln-price", category: "finance", title: "Dense-Street Premium", whatChanged: "Dense routes still priced like scatter.", why: "Slight premium for non-dense one-offs.", impact: "+margin on scatter", confidence: 84, effort: "15 min", current: "Flat pricing everywhere", recommended: "Density-aware pricing", reasoning: "Windshield time has a cost.", seasonal: false }),
    ],
    [
      opp({ id: "ln-review", category: "growth", title: "Yard Review Asks", whatChanged: "Two strong yards unreviewed.", why: "Ask with before/after attached.", impact: "+local proof", confidence: 90, effort: "10 min", current: "No review asks", recommended: "Photo-attached review ask", reasoning: "Visual proof makes reviewing easy.", seasonal: false }),
      opp({ id: "ln-aerate", category: "marketplace", title: "Aeration Upsell", whatChanged: "Marketplace aeration interest up.", why: "Offer aeration to weekly customers.", impact: "+AOV", confidence: 85, effort: "20 min", current: "Mow-only relationship", recommended: "Aeration upsell to weeklies", reasoning: "Existing trust converts add-ons.", seasonal: false }),
      opp({ id: "ln-minimal", category: "brand", title: "Quiet Local Brand", whatChanged: "Bold dismissed previously.", why: "Creative Memory: stay friendly-minimal.", impact: "+fit", confidence: 88, effort: "15 min", current: "Busy promo blocks", recommended: "Quieter local brand", reasoning: "Preference history.", seasonal: false }),
    ],
  ],
  cleaning: [
    [
      opp({ id: "cl-host", category: "growth", title: "Host Turnover Link", whatChanged: "Airbnb hosts asking ad-hoc.", why: "Share turnover booking link with three hosts.", impact: "Recurring turnovers", confidence: 92, effort: "15 min", current: "One-off cleans only", recommended: "Host turnover link outreach", reasoning: "Hosts need reliability.", seasonal: false }),
      opp({ id: "cl-plans", category: "booking", title: "Feature Weekly Plans", whatChanged: "Deep cleans dominating.", why: "Highlight weekly/biweekly on homepage.", impact: "Higher repeat revenue", confidence: 90, effort: "15 min", current: "Deep clean first", recommended: "Weekly plans first", reasoning: "Repeat beats one-offs.", seasonal: false }),
      opp({ id: "cl-supplies", category: "operations", title: "Supplies Checklist", whatChanged: "Near miss on a turnover.", why: "Attach supplies lists to schedule.", impact: "-supply misses", confidence: 93, effort: "15 min", current: "Memory-based kits", recommended: "Per-job supplies checklist", reasoning: "Hosts complain when short.", seasonal: false }),
    ],
    [
      opp({ id: "cl-gift", category: "marketplace", title: "Holiday Gift Cards", whatChanged: "Holiday season approaching.", why: "Seasonal Intelligence: offer cleaning gift cards.", impact: "+seasonal revenue", confidence: 89, effort: "25 min", current: "No gift cards", recommended: "Holiday gift card offer", reasoning: "Gift cleaning is seasonal demand.", seasonal: true, season: "holiday" }),
      opp({ id: "cl-review", category: "growth", title: "Host Reviews", whatChanged: "Two smooth turnovers unreviewed.", why: "Collect two host reviews this week.", impact: "Faster host trust", confidence: 91, effort: "10 min", current: "No host review asks", recommended: "Post-turnover review ask", reasoning: "Host trust compounds.", seasonal: false }),
      opp({ id: "cl-steps", category: "booking", title: "Simpler Turnover Book", whatChanged: "Extra booking step for hosts.", why: "Collapse one step in turnover flow.", impact: "+same-session conversion", confidence: 90, effort: "20 min", current: "Extra friction for hosts", recommended: "One fewer book step", reasoning: "Hosts book under time pressure.", seasonal: false }),
    ],
    [
      opp({ id: "cl-check", category: "operations", title: "Recurring Quality Check-in", whatChanged: "Two homes silent.", why: "Quality check-in before churn.", impact: "+retention", confidence: 87, effort: "15 min", current: "No quality pulse", recommended: "Two-home check-in", reasoning: "Silent dissatisfaction cancels.", seasonal: false }),
      opp({ id: "cl-price", category: "finance", title: "Same-Day Turnover Premium", whatChanged: "Same-day asks rising.", why: "Price same-day turnovers with a premium.", impact: "+margin on urgency", confidence: 86, effort: "10 min", current: "Flat turnover pricing", recommended: "Same-day premium", reasoning: "Urgency has value.", seasonal: false }),
      opp({ id: "cl-move", category: "marketplace", title: "Move-out Package", whatChanged: "Move-out demand rising.", why: "Publish move-out cleaning package.", impact: "+seasonal packages", confidence: 85, effort: "25 min", current: "Generic deep clean only", recommended: "Move-out package", reasoning: "Seasonal/local move cycles.", seasonal: true, season: "moves" }),
    ],
    [
      opp({ id: "cl-pref", category: "brand", title: "Calm Host-Facing Brand", whatChanged: "You rejected bold promos.", why: "Creative Memory: calm, reliable tone.", impact: "+host fit", confidence: 88, effort: "15 min", current: "Loud promo blocks", recommended: "Calm reliable brand", reasoning: "Hosts buy reliability.", seasonal: false }),
      opp({ id: "cl-auto", category: "operations", title: "Checkout Reminder Automation", whatChanged: "Weekend checkout waves.", why: "Automate host checkout reminders.", impact: "-last-minute scrambles", confidence: 90, effort: "20 min", current: "Manual reminders", recommended: "Checkout reminder automation", reasoning: "Weekend waves need systems.", seasonal: false }),
      opp({ id: "cl-deposit", category: "finance", title: "Recurring Deposit Clarity", whatChanged: "Confusion on first weekly.", why: "Clarify first-clean deposit on plans.", impact: "-billing confusion", confidence: 84, effort: "10 min", current: "Unclear first invoice", recommended: "Clear first-clean deposit copy", reasoning: "Clarity reduces support load.", seasonal: false }),
    ],
  ],
};

export const LEARNING_JOURNAL_BY_INDUSTRY = {
  pressure_washing: [
    "Your customers respond better to before-and-after photos than close-up detail shots.",
    "Saturday mornings consistently produce your highest booking rate.",
    "Quotes sent within 15 minutes convert 22% better.",
    "Customers tend to choose your middle package 68% of the time.",
    "Premium messaging performs better than discount messaging for your audience.",
  ],
  photography: [
    "Atmosphere photos convert better than gear lists for your inquiries.",
    "Weekend packages close faster when one option is the default.",
    "Albums delivered under 10 days generate more referrals.",
    "Couples respond to story-led About pages over template bios.",
    "Premium messaging outperforms discount offers for your audience.",
  ],
  hvac: [
    "Licensed & insured proof above the fold lowers emergency hesitation.",
    "Same-day windows fill before next-day slots.",
    "Tune-up offers convert best with past emergency customers.",
    "Live quote calls outperform email follow-ups.",
    "Membership visibility on the homepage lifts recurring signups.",
  ],
  lawn_care: [
    "Route density predicts profit more than raw job count.",
    "Before/after yard photos beat stock lawn imagery.",
    "Pause/resume reduces seasonal cancellations.",
    "Neighborhood clustering cuts drive time meaningfully.",
    "Weekly check-ins catch dissatisfaction before churn.",
  ],
  cleaning: [
    "Hosts convert on reliability messaging more than promotions.",
    "Weekly plans outperform one-off deep cleans for retention.",
    "Supply checklists prevent the complaints that lose hosts.",
    "Same-day turnovers accept a premium when framed clearly.",
    "Post-turnover review asks compound host trust quickly.",
  ],
};

function filterByMemory(opps, ctx = {}) {
  const rejected = Array.isArray(ctx.rejectedIds) ? ctx.rejectedIds : [];
  const prefs = Array.isArray(ctx.creativePreferences) ? ctx.creativePreferences.map(String) : [];
  const preferMinimal = prefs.some((p) => /minimal|quiet|dark|calm/i.test(p)) || ctx.preferMinimal;
  let list = opps.filter((o) => !rejected.includes(o.id));
  if (preferMinimal) {
    list = list.filter((o) => !/bold|high-energy|loud/i.test(o.recommended + o.title + (o.current || "")));
    // Prefer quieter brand opps when memory says minimal
    list = list.map((o) =>
      o.category === "brand" && /bold|energy/i.test(o.current || "")
        ? { ...o, why: o.why + " Creative Memory adapted — skipping bold.", confidence: Math.min(99, o.confidence + 1) }
        : o,
    );
  }
  // If five+ rejects, avoid similar titles
  if (rejected.length >= 5) {
    list = list.filter((o) => !rejected.some((id) => id.split("-")[1] && o.id.includes(id.split("-")[1])));
  }
  return list;
}

export function buildEvolutionOpportunities(ctx = {}) {
  const key = resolveKey(ctx);
  const week = weekIndex(ctx);
  const pool = INDUSTRY_EVOLUTION_POOL[key] || INDUSTRY_EVOLUTION_POOL.pressure_washing;
  const raw = (pool[week] || pool[0]).map((o) => ({ ...o }));
  return filterByMemory(raw, ctx);
}

export function buildEvolutionScore(ctx = {}) {
  const recommended = Number(ctx.recommendedCount ?? ctx.opportunities?.length ?? 3);
  const completed = Number(ctx.completedCount ?? 14);
  const impact = ctx.impactLabel || "+18%";
  const score = Math.max(70, Math.min(99, 80 + Math.min(12, completed) + Math.min(6, recommended)));
  return {
    label: "Business Evolution",
    score,
    recommended,
    completed,
    impact,
  };
}

export function buildEvolutionTimeline(ctx = {}) {
  const history = Array.isArray(ctx.timeline) ? ctx.timeline.slice() : [
    { when: "Last Week", event: "Homepage improved", impact: "+12% conversion", outcome: "accepted" },
    { when: "Yesterday", event: "Booking simplified", impact: "-18% abandoned bookings", outcome: "accepted" },
    { when: "Today", event: "Memberships recommended", impact: "Pending", outcome: "recommended" },
  ];
  if (Array.isArray(ctx.accepted) && ctx.accepted.length) {
    ctx.accepted.forEach((a) => history.push({ when: "Today", event: a.title || a, impact: a.impact || "Applied", outcome: "accepted" }));
  }
  if (Array.isArray(ctx.rejected) && ctx.rejected.length) {
    ctx.rejected.forEach((r) => history.push({ when: "Today", event: (r.title || r) + " dismissed", impact: "Skipped", outcome: "rejected" }));
  }
  return history;
}

export function buildLearningJournal(ctx = {}) {
  const key = resolveKey(ctx);
  const lines = (LEARNING_JOURNAL_BY_INDUSTRY[key] || LEARNING_JOURNAL_BY_INDUSTRY.pressure_washing).slice();
  return {
    label: "What I've learned about your business",
    lines,
    notRecommendations: true,
    accumulates: true,
  };
}

export function buildOvernightEvolutionNote(ctx = {}) {
  const opps = ctx.opportunities || buildEvolutionOpportunities(ctx);
  return {
    line: "I reviewed your business overnight.",
    differentToday: `Here's what's different today… ${opps.length} evolution opportunities ready for your approval.`,
    count: opps.length,
  };
}

export function simulateMonthOfEvolution(ctx = {}) {
  return [0, 1, 2, 3].map((weekIndex) => {
    const opps = buildEvolutionOpportunities({ ...ctx, weekIndex });
    return {
      weekIndex,
      opportunityIds: opps.map((o) => o.id),
      titles: opps.map((o) => o.title),
      signature: opps.map((o) => o.id).join("|"),
    };
  });
}

export function adaptAfterRejections(ctx = {}) {
  const rejectedIds = Array.isArray(ctx.rejectedIds) ? ctx.rejectedIds : [];
  const before = buildEvolutionOpportunities({ ...ctx, rejectedIds: [] });
  const after = buildEvolutionOpportunities({ ...ctx, rejectedIds, preferMinimal: true, creativePreferences: ["Prefers minimalist designs"] });
  return {
    beforeIds: before.map((o) => o.id),
    afterIds: after.map((o) => o.id),
    adapted: after.every((o) => !rejectedIds.includes(o.id)) && after.some((o) => /Creative Memory|minimal|quiet|calm/i.test(o.why + o.recommended)),
  };
}

/**
 * Full Living Business / Evolution payload.
 */
export function orchestrateLivingBusiness(ctx = {}) {
  const industryKey = resolveKey(ctx);
  const week = weekIndex(ctx);
  const opportunities = buildEvolutionOpportunities(ctx);
  const byCategory = EVOLUTION_CATEGORIES.map((c) => ({
    ...c,
    items: opportunities.filter((o) => o.category === c.id),
  })).filter((c) => c.items.length);
  const score = buildEvolutionScore({ ...ctx, opportunities, recommendedCount: opportunities.length });
  const timeline = buildEvolutionTimeline(ctx);
  const journal = buildLearningJournal(ctx);
  const overnight = buildOvernightEvolutionNote({ opportunities });
  const compare = opportunities[0]
    ? {
        current: opportunities[0].current,
        recommended: opportunities[0].recommended,
        impact: opportunities[0].impact,
        reasoning: opportunities[0].reasoning,
      }
    : null;

  return {
    version: LIVING_VERSION,
    label: LIVING_LABEL,
    neverAutoApply: true,
    industryKey,
    weekIndex: week,
    systems: EVOLUTION_SYSTEMS.slice(),
    categories: EVOLUTION_CATEGORIES.map((c) => ({ ...c })),
    opportunities,
    byCategory,
    score,
    timeline,
    journal,
    overnight,
    compare,
    approvalWorkflow: APPROVAL_WORKFLOW.map((s) => ({ ...s })),
    center: {
      label: "Business Evolution",
      thisWeek: `${opportunities.length} opportunities found.`,
    },
    askPrompts: ["Why?", "What data supports this?", "Show me another option.", "Is this worth doing?"],
    signature: [industryKey, week, opportunities.map((o) => o.id).join(",")].join("::"),
  };
}

export function livingExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluateLivingHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };
  const slice = (() => {
    const i = h.indexOf('id="is-step-living-business"');
    if (i < 0) return "";
    const k = h.indexOf('id="is-step-vibe"', i);
    return k > i ? h.slice(i, k) : h.slice(i, i + 60000);
  })();

  const checks = {
    livingCanvas: ok(/data-living-business|is-living-business|id="is-step-living-business"/.test(h), "Missing Living Business canvas"),
    evolutionEngine: ok(/Business Evolution Engine|EVOLUTION_SYSTEMS|orchestrateLivingBusiness|is-evo-engine/.test(h), "Missing Evolution Engine"),
    evolutionCenter: ok(/Business Evolution|is-evo-center|opportunities found/.test(h), "Missing Evolution Center"),
    opportunityCards: ok(/Expected impact|Confidence|Preview|Ask Why|Apply|Dismiss|is-evo-card/.test(h), "Missing Opportunity Cards"),
    categories: ok(/Brand|Booking|Growth|Operations|Marketplace|Finance|EVOLUTION_CATEGORIES|is-evo-cats/.test(h), "Missing categories"),
    compare: ok(/Compare Before|Current|Recommended|is-evo-compare|before\/after|Before \/ After/i.test(h), "Missing before/after compare"),
    timeline: ok(/Evolution Timeline|is-evo-timeline|accepted|rejected/.test(h), "Missing Evolution Timeline"),
    askHubly: ok(/Ask Hubly|Why\?|What data supports|is-evo-ask/.test(h), "Missing Ask Hubly on recs"),
    seasonal: ok(/Seasonal Intelligence|seasonal:|House wash|Wedding landing|Gift cards|is-evo-seasonal/.test(h), "Missing Seasonal Intelligence"),
    approval: ok(/Preview[\s\S]{0,80}Conversation[\s\S]{0,80}Approval[\s\S]{0,80}Deployment|APPROVAL_WORKFLOW|is-evo-workflow/.test(h), "Missing approval workflow"),
    evolutionScore: ok(/Business Evolution|is-evo-score|Recommended|Completed|Impact/.test(h), "Missing Evolution Score"),
    dailyLink: ok(/reviewed your business overnight|Here's what's different today|is-daily-evolution|overnight evolution/i.test(h), "Missing Daily overnight evolution link"),
    creativeMemory: ok(/Creative Memory|preferMinimal|adaptAfterRejections|is-evo-memory/.test(h), "Missing Creative Memory adaptation"),
    learningJournal: ok(/What I've learned about your business|is-evo-journal|LEARNING_JOURNAL/.test(h), "Missing What I Learned Journal"),
    homeCenter: ok(/is-home-evolution|Open Evolution|isEnterLivingBusiness|isRunLivingBusiness/.test(h), "Missing Home Evolution Center"),
    polishShell: ok(/is-step-polish|Polish & Delight|Epic 12/.test(h), "Missing Polish soft shell"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-evo-brand/.test(h), "Missing Hubly brand"),
  };
  return { passed: issues.length === 0, issues, checks };
}

export const HublyLivingBusiness = {
  version: LIVING_VERSION,
  label: LIVING_LABEL,
  orchestrate: orchestrateLivingBusiness,
  simulateMonth: simulateMonthOfEvolution,
  adapt: adaptAfterRejections,
  journal: buildLearningJournal,
};
