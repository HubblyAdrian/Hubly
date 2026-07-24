/**
 * Milestone 2 · Epic 10 — Hubly Daily
 *
 * Morning business partner — not a notification feed or report.
 * Answers: What changed? What matters today? What would Hubly do?
 */
export const DAILY_VERSION = "1.0.0";
export const DAILY_LABEL = "Hubly Daily";

export const FORBIDDEN_DAILY = [
  "notification feed",
  "Your daily report",
  "Dashboard digest",
];

export const OVERNIGHT_SYSTEMS = [
  "Website","Bookings","Calendar","CRM","Reviews","Revenue","Business Health",
  "Marketplace demand","Weather","Automations","Portfolio","Open quotes","Follow-ups",
];

export const EXPERT_VOICES = [
  { id: "growth", label: "Growth Expert", lead: "I noticed" },
  { id: "brand", label: "Brand Expert", lead: "I found" },
  { id: "operations", label: "Operations Expert", lead: "I recommend" },
  { id: "finance", label: "Finance Expert", lead: "I noticed" },
  { id: "marketplace", label: "Marketplace Expert", lead: "I found" },
  { id: "success", label: "Customer Success Expert", lead: "I recommend" },
];

export const WRAP_UP_KINDS = [
  { id: "friday", label: "Week in Review", when: "Friday" },
  { id: "month", label: "Month in Review", when: "First of Month" },
  { id: "quarter", label: "Business Evolution", when: "Quarterly" },
  { id: "anniversary", label: "Business Story", when: "Anniversary" },
];

export const STAGE_CADENCE = {
  new: { id: "new", focus: "setup", line: "You're early — today's Daily focuses on setup and first customers." },
  growing: { id: "growing", focus: "customers", line: "You're growing — today's Daily focuses on customers and conversion." },
  established: { id: "established", focus: "optimization", line: "You're established — today's Daily focuses on optimization and margins." },
};

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

function resolveStage(ctx = {}) {
  const raw = String(ctx.businessStage || ctx.stage || "").toLowerCase();
  if (/establish|mature|scale|optim/.test(raw)) return "established";
  if (/grow|scaling|momentum/.test(raw)) return "growing";
  if (ctx.bookingCount != null && Number(ctx.bookingCount) >= 50) return "established";
  if (ctx.bookingCount != null && Number(ctx.bookingCount) >= 5) return "growing";
  return "new";
}

function firstNameOf(ctx = {}) {
  const owner = ctx.ownerName || ctx.firstName || (ctx.email ? String(ctx.email).split("@")[0] : null) || "there";
  return String(owner).replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim().split(/\s+/)[0] || "there";
}

function dayIndex(ctx = {}) {
  if (ctx.dayIndex != null && Number.isFinite(Number(ctx.dayIndex))) return Math.abs(Math.floor(Number(ctx.dayIndex))) % 7;
  if (ctx.date) {
    const d = new Date(ctx.date);
    if (!Number.isNaN(d.getTime())) return d.getDay() % 7;
  }
  return new Date().getDay() % 7;
}

function dayPack(headline, oppTitle, why, impact, action, win, metric, from, to, reason, ifMine, forecast) {
  return {
    headline,
    opportunity: { title: oppTitle, why, impact, action },
    win,
    healthChange: { metric, from, to, reason },
    ifMine,
    forecast,
  };
}

/** Seven unique days per industry — never duplicate across a week. */
export const INDUSTRY_DAILY_DAYS = {
  pressure_washing: [
    dayPack("Your biggest opportunity today is following up with yesterday's three quotes.","Follow up on three open quotes.","Warm quotes go cold after 24 hours in this trade.","+2 expected bookings this week.","Send follow-ups","Your average booking value increased 11%.","Trust",91,94,"Five new portfolio photos.","I'd text those three quotes before noon — pressure washing buyers decide fast when the driveway is still dirty.",{tomorrow:"Heavy rain may affect two jobs.",weekend:"Demand for pressure washing is expected to increase.",nextWeek:"You're on pace for your highest revenue week this month.",nextMonth:"Gutter cleaning demand typically rises in your area."}),
    dayPack("Tomorrow's weather will likely affect two jobs — act before customers ask.","Reschedule weather-sensitive jobs.","Proactive reschedules protect reviews and crew time.","-customer chase messages.","Reschedule before they ask","You've completed 12 jobs this week.","Operations",88,92,"Route density improved.","I'd lock alternate dry windows tonight so tomorrow doesn't scramble.",{tomorrow:"Rain window midday — keep soft-wash for later.",weekend:"Clear skies — ideal for house washes.",nextWeek:"Three neighborhood clusters look bookable.",nextMonth:"Spring algae season usually lifts soft-wash demand."}),
    dayPack("Three customers haven't left reviews yet — I drafted messages.","Send review drafts to three customers.","Recent finished jobs convert reviews fastest.","+trust proof on the homepage.","Ready to send?","Homepage conversion improved.","Growth",86,89,"Quote follow-ups landed.","I'd send the drafts while the work is still fresh in their driveway.",{tomorrow:"Two quote replies are likely after morning texts.",weekend:"Local search interest typically spikes Saturday.",nextWeek:"Membership pitch timing looks strong.",nextMonth:"HOA season often brings multi-home jobs."}),
    dayPack("Upload today's before-and-after photos while the jobs are fresh.","Upload today's before-and-after photos.","Finished work is your strongest trust signal.","+14% trust.","Add photos","You've reached 40 completed jobs.","Brand",90,93,"Gallery refresh.","I'd pin the strongest before/after above the book button tonight.",{tomorrow:"One open quote is likely to close if you follow up.",weekend:"Driveway inquiries usually rise after dry weather.",nextWeek:"Route fill looks 70% full already.",nextMonth:"Commercial lots often open budgets mid-month."}),
    dayPack("Your membership pitch is ready for five past customers.","Offer quarterly soft-wash memberships.","Repeat yards beat one-off chasing.","+$1,200/mo potential.","Send membership offer","Repeat customer rate ticked up.","Growth",89,91,"Membership interest.","I'd start with the five neighbors already on your route.",{tomorrow:"Two membership replies expected if you send tonight.",weekend:"Neighborhood density can climb with one street push.",nextWeek:"Soft-wash window looks favorable.",nextMonth:"Pre-summer packages typically convert well."}),
    dayPack("Open quotes are aging — two need a same-day nudge.","Nudge two aging quotes today.","Quotes older than 48 hours rarely close without contact.","Recover stalled revenue.","Send nudges","Response time stayed under 15 minutes.","Bookings",84,87,"Faster quote replies.","I'd call the larger quote and text the smaller one.",{tomorrow:"One of those quotes is likely to convert.",weekend:"Weather looks wash-friendly.",nextWeek:"Crew capacity still has two open slots.",nextMonth:"Commercial interest usually rises after month-end."}),
    dayPack("Your gallery is converting — double down with one more proof set.","Add one more before/after set to the hero gallery.","Proof compounds when visitors already trust the brand.","+conversion on cold traffic.","Publish proof set","Website visitors booked without a phone call.","Trust",94,95,"Consistent portfolio.","I'd keep publishing proof weekly — it's your quiet sales team.",{tomorrow:"Organic booking interest looks steady.",weekend:"Local demand usually rises after rain clears.",nextWeek:"Highest-pace week still in reach.",nextMonth:"Gutter + soft-wash bundles typically lift AOV."}),
  ],
  photography: [
    dayPack("Two couples asked about dates — your inquiry link should go out today.","Send inquiry links to two warm couples.","Warm wedding leads cool after a quiet weekend.","1–2 premium inquiries.","Send inquiry links","Your average package value held premium.","Growth",88,91,"Faster inquiry replies.","I'd lead with available Saturday dates, not a generic portfolio dump.",{tomorrow:"One couple is likely to book a consult.",weekend:"Engagement-session demand usually rises.",nextWeek:"Editing queue can clear with one focused block.",nextMonth:"Peak proposal season typically lifts inquiries."}),
    dayPack("Your editing queue is the bottleneck — clear one album early.","Deliver the oldest album today.","Speed of delivery drives referrals.","+referral rate.","Ship album","A client left a 5-star review unprompted.","Operations",82,86,"Queue movement.","I'd ship the oldest gallery before taking new weekend work.",{tomorrow:"One referral ask becomes natural after delivery.",weekend:"Two shoots on the books look solid.",nextWeek:"Portfolio refresh timing is strong.",nextMonth:"Holiday mini-sessions usually open soon."}),
    dayPack("Atmosphere photos convert better than gear — feature three above the fold.","Pin three atmosphere photos above packages.","Emotion converts wedding inquiries.","+emotional conversion.","Update hero gallery","Homepage time-on-page improved.","Brand",90,94,"Stronger hero story.","I'd remove one gear shot and lead with a real couple moment.",{tomorrow:"Inquiry quality should rise with the new hero.",weekend:"Consult calls usually cluster Saturday morning.",nextWeek:"One full-weekend package is in reach.",nextMonth:"Venue partnerships often open mid-season."}),
    dayPack("Clarify your weekend package as the default — decision fatigue is real.","Make one weekend package the default.","Too many options stall premium buyers.","Less decision fatigue.","Simplify packages","Two consults booked without discounting.","Conversion",85,89,"Clearer offer.","I'd hide add-ons until after the core package is chosen.",{tomorrow:"One stalled inquiry may reopen.",weekend:"Peak shoot day — protect buffer time.",nextWeek:"Editing SLA stays healthy if you ship one early.",nextMonth:"Engagement season typically accelerates."}),
    dayPack("Three past clients haven't been asked for a referral yet.","Ask three happy clients for referrals.","Warm social proof beats cold ads.","+qualified intros.","Send referral asks","You've booked 8 shoots this month.","Growth",91,93,"Referral loop starting.","I'd ask right after album delivery — gratitude is highest then.",{tomorrow:"One intro is likely if you ask tonight.",weekend:"Second shooter availability looks open.",nextWeek:"Portfolio can absorb two new hero images.",nextMonth:"Local wedding fairs often open registrations."}),
    dayPack("Your About page still sounds like a template — rewrite in your voice.","Rewrite About in your voice.","Couples buy the person behind the lens.","+trust on about visits.","Rewrite About","Brand consistency score rose.","Brand",94,96,"Voice alignment.","I'd tell one real story instead of listing gear.",{tomorrow:"About-page dwell time should improve.",weekend:"Consults look fully booked — protect creative rest.",nextWeek:"One mini-session test could fill a gap day.",nextMonth:"Peak season deposits usually start landing."}),
    dayPack("A stronger headline is ready for your homepage hero.","Ship the stronger homepage headline.","Outcome-first headlines outperform feature lists.","+cold traffic conversion.","Update headline","Inquiry form completion improved.","Conversion",89,92,"Clearer promise.","I'd A/B nothing — ship the clearer line and watch replies.",{tomorrow:"Organic inquiries should tick up.",weekend:"Two full-day shoots need confirmation texts.",nextWeek:"Editing backlog stays manageable.",nextMonth:"Premium packages typically outsell add-ons."}),
  ],
  hvac: [
    dayPack("Five past emergency customers are ready for a tune-up plan offer.","Offer tune-up plans to five past emergency jobs.","Emergency callers already trust you.","Recurring maintenance starts.","Send tune-up offers","Same-day booking windows filled twice.","Growth",84,88,"Maintenance interest.","I'd text the five hottest emergency jobs from last month first.",{tomorrow:"Heat advisory may spike service calls.",weekend:"Emergency demand usually rises after Friday.",nextWeek:"Parts inventory should cover common failures.",nextMonth:"Pre-season tune-ups typically convert well."}),
    dayPack("Licensed & insured proof still isn't above the fold.","Publish licensed & insured language above the fold.","Emergency fear drops with visible credentials.","Lower emergency fear.","Update hero proof","Call-to-book conversion improved.","Trust",87,92,"Credential visibility.","I'd put proof chips under the headline before any promo.",{tomorrow:"Two diagnostic calls are likely.",weekend:"After-hours demand may rise — set expectations.",nextWeek:"Maintenance plan closes look promising.",nextMonth:"Cooling season load typically climbs."}),
    dayPack("Open two same-day windows — HVAC buyers book the first trusted tech.","Open same-day / next-day windows.","Speed wins emergency and comfort calls.","Faster first bookings.","Open windows","Average response time dropped.","Operations",90,94,"Window coverage.","I'd open two slots before lunch and protect one for true emergencies.",{tomorrow:"Temperature swing may drive calls.",weekend:"Keep one tech on standby.",nextWeek:"Tune-up route can densify north side.",nextMonth:"Filter + maintenance bundles lift AOV."}),
    dayPack("Parts checklist gaps caused a return trip — fix the van list.","Attach parts checklists to today's jobs.","Second trips destroy margins.","-return trips.","Add checklists","First-time fix rate improved.","Operations",94,96,"Fewer callbacks.","I'd standardize the van list tonight before tomorrow's calls.",{tomorrow:"Three service calls look parts-heavy.",weekend:"Emergency stock should include capacitors.",nextWeek:"Maintenance density north looks strong.",nextMonth:"Commercial PM contracts often renew."}),
    dayPack("Two open quotes need a same-day call — not another email.","Call two open quotes today.","HVAC decisions move when someone answers questions live.","Recover stalled jobs.","Call quotes","Quote-to-book rate rose this week.","Bookings",86,90,"Live follow-up.","I'd call before 10am while homeowners are reachable.",{tomorrow:"One install estimate may close.",weekend:"After-hours triage volume may rise.",nextWeek:"Crew capacity still has room Thursday.",nextMonth:"Heat-wave weeks typically max out capacity."}),
    dayPack("Memberships aren't on the homepage — recurring revenue is waiting.","Feature maintenance memberships on the homepage.","Recurring plans stabilize seasonal swings.","+predictable revenue.","Feature memberships","Two members renewed automatically.","Growth",88,91,"Membership visibility.","I'd put memberships next to emergency booking — not buried in services.",{tomorrow:"Membership page visits should rise.",weekend:"Keep emergency SLA clear for members.",nextWeek:"PM route can add three homes.",nextMonth:"Fall heating tune-ups usually open early."}),
    dayPack("Your review ask after emergency jobs is still silent.","Ask two emergency customers for reviews.","Emergency wins create the strongest trust proof.","+local trust signals.","Send review asks","You've closed 25 service calls this month.","Trust",92,95,"Fresh reviews.","I'd ask the day after a successful fix — while relief is high.",{tomorrow:"One review is likely if you ask tonight.",weekend:"Standby coverage looks adequate.",nextWeek:"Install pipeline has one open slot.",nextMonth:"Pre-season campaigns usually lift plan sales."}),
  ],
  lawn_care: [
    dayPack("Invite ten neighbors onto a weekly route — density beats windshield time.","Share a neighborhood booking link on one street.","Route density is the profit lever.","Route density grows.","Share neighborhood link","Drive time per job dropped.","Operations",85,90,"Tighter clustering.","I'd pick one street you're already on and fill the gaps.",{tomorrow:"Rain may shift two mows.",weekend:"Catch-up demand usually rises after wet days.",nextWeek:"Biweekly customers may request weekly.",nextMonth:"Peak growing season typically lifts frequency."}),
    dayPack("Add before/after yard photos from your last three jobs.","Upload three yard transformations.","Reliability proof beats stock lawn photos.","+reliability proof.","Upload photos","New inquiries mentioned your gallery.","Trust",88,92,"Real yard proof.","I'd lead with the messiest before shot — contrast sells.",{tomorrow:"One neighbor referral is likely.",weekend:"Mowing windows look clear Saturday.",nextWeek:"Route can absorb four more homes.",nextMonth:"Aeration demand usually rises seasonally."}),
    dayPack("Pause/resume still isn't on — seasonal customers cancel instead.","Turn on pause/resume for seasonal customers.","Pausing beats churn.","Fewer cancellations.","Enable pause/resume","Two customers paused instead of canceling.","Growth",86,89,"Retention tooling.","I'd message seasonal folks before they ghost.",{tomorrow:"Two pause requests may arrive after rain.",weekend:"Catch-up mows look profitable.",nextWeek:"Crew load balances if you densify east.",nextMonth:"Leaf season typically needs capacity planning."}),
    dayPack("Today's route is scattered — reorder by neighborhood.","Cluster today's stops by neighborhood.","Scattered yards burn fuel and crew time.","-drive time.","Reorder route","On-time arrival rate improved.","Operations",90,94,"Smarter sequencing.","I'd rebuild the route tonight around the densest cluster.",{tomorrow:"Weather looks mow-friendly after 10am.",weekend:"Add-on edging requests often appear.",nextWeek:"One HOA proposal is ripe.",nextMonth:"Fertility plans usually upsell well."}),
    dayPack("Five weekly customers are due for a check-in text.","Check in with five weekly customers.","Quiet satisfaction prevents surprise cancellations.","+retention.","Send check-ins","You hit 60 recurring stops.","Bookings",91,93,"Stable recurring base.","I'd ask one simple question: anything you want adjusted?",{tomorrow:"One upsell (edging) is likely.",weekend:"Skip requests may rise if rain hits.",nextWeek:"East route can take three more homes.",nextMonth:"Fall cleanup interest typically starts."}),
    dayPack("Your booking page still hides biweekly — make frequency obvious.","Highlight weekly and biweekly on the homepage.","Clear frequency choices convert faster.","Higher repeat revenue.","Update frequency CTAs","Biweekly conversions improved.","Conversion",84,88,"Clearer plans.","I'd default to weekly for dense streets and offer biweekly as the alternate.",{tomorrow:"Plan-page visits should rise.",weekend:"New neighborhood interest looks strong.",nextWeek:"Crew overtime risk drops with denser routing.",nextMonth:"Seasonal packages usually lift AOV."}),
    dayPack("Two reviews from last week's yards are still unasked.","Ask two recent customers for reviews.","Fresh lawn photos + reviews compound trust.","+local proof.","Send review asks","You've completed 100 lawn visits.","Trust",92,95,"Review momentum.","I'd attach a before/after when you ask — makes reviewing easy.",{tomorrow:"One review is likely.",weekend:"Growth street still has open gaps.",nextWeek:"Highest-density week looks achievable.",nextMonth:"Leaf + cleanup demand typically rises."}),
  ],
  cleaning: [
    dayPack("Share your turnover booking link with three Airbnb hosts.","Text the turnover link to three local hosts.","Hosts need reliable turnovers more than one-off cleans.","Recurring turnovers.","Share with hosts","Two hosts booked repeat turnovers.","Growth",85,90,"Host channel opening.","I'd start with hosts already asking for same-day help.",{tomorrow:"One new host inquiry is likely.",weekend:"Checkout turnover demand usually spikes.",nextWeek:"Supplies reorder should happen before Friday.",nextMonth:"Shoulder-season hosts still need midweek cleans."}),
    dayPack("Collect two host reviews this week — trust compounds fast.","Ask two hosts for short reviews.","Host trust compounds with recent proof.","Faster host trust.","Request reviews","On-time turnover rate stayed perfect.","Trust",89,93,"Host reviews.","I'd ask right after a smooth checkout turn.",{tomorrow:"Two turnovers need supply checks.",weekend:"Peak checkout window — protect buffers.",nextWeek:"One weekly home can convert to biweekly.",nextMonth:"Short-term demand typically follows local events."}),
    dayPack("Highlight weekly and biweekly plans — repeat revenue beats deep cleans.","Feature weekly/biweekly on the homepage.","Repeat plans stabilize the calendar.","Higher repeat revenue.","Feature plans","Recurring revenue share increased.","Growth",90,92,"Plan visibility.","I'd put weekly first and deep cleans as add-ons.",{tomorrow:"One deep-clean quote may convert to weekly.",weekend:"Host turnovers look fully booked.",nextWeek:"Route west can absorb two homes.",nextMonth:"Spring clean interest usually rises."}),
    dayPack("Supplies checklist gaps risk a host complaint today.","Attach supplies lists to today's schedule.","Starting a turnover short creates host complaints.","-supply misses.","Attach supplies list","Zero supply misses this week.","Operations",91,95,"Checklist discipline.","I'd standardize kits per property type tonight.",{tomorrow:"Three turnovers back-to-back — kit twice.",weekend:"Checkout wave looks heavy Saturday.",nextWeek:"One host wants midweek holds.",nextMonth:"Linen partner pricing may need review."}),
    dayPack("Two recurring homes haven't had a quality check-in.","Quality check-in with two recurring homes.","Silent dissatisfaction becomes cancellation.","+retention.","Send check-ins","You've locked 18 recurring homes.","Bookings",92,94,"Stable recurring base.","I'd ask what to improve — then fix one thing visibly.",{tomorrow:"One upsell (fridge/oven) is likely.",weekend:"Host same-day asks may appear.",nextWeek:"East cluster still has gap homes.",nextMonth:"Move-out cleans typically rise."}),
    dayPack("Your booking flow still has one extra step for turnovers.","Collapse one step in the turnover book flow.","Hosts book under time pressure.","+same-session conversion.","Simplify booking","Mobile booking completion improved.","Conversion",86,90,"Fewer steps.","I'd prefill property details for returning hosts.",{tomorrow:"Host bookings should feel faster.",weekend:"Protect a buffer between checkouts.",nextWeek:"One commercial office clean is pending.",nextMonth:"Event weekends usually spike turnovers."}),
    dayPack("Draft messages for three customers who haven't left reviews.","Send drafted review messages.","Finished cleans convert reviews while memory is fresh.","+social proof.","Ready to send?","Five-star streak continued.","Trust",93,96,"Review velocity.","I'd send the drafts before adding new hosts.",{tomorrow:"Two reviews are likely.",weekend:"Checkout volume looks above average.",nextWeek:"Supplies restock before Thursday.",nextMonth:"Summer travel typically lifts turnovers."}),
  ],
};

function pickDayPack(industryKey, idx) {
  const days = INDUSTRY_DAILY_DAYS[industryKey] || INDUSTRY_DAILY_DAYS.pressure_washing;
  return days[idx % days.length];
}

export function buildOvernightReview(ctx = {}) {
  const stripeConnected = ctx.stripeConnected !== false;
  const systems = OVERNIGHT_SYSTEMS.map((name) => ({
    name,
    status: !stripeConnected && (name === "Revenue" || name === "Bookings") ? "limited" : "reviewed",
    note: !stripeConnected && name === "Revenue" ? "Stripe isn't connected — revenue insights are limited." : null,
  }));
  return { label: "Overnight Review", line: "Last night I reviewed your business.", systems, surfacedOnlyWhatMatters: true };
}

export function buildReturnSummary(ctx = {}) {
  const days = Number(ctx.daysAway);
  if (!Number.isFinite(days) || days < 14) return null;
  return {
    headline: "Welcome back — here's what changed while you were away.",
    bullets: [
      ctx.awayBookings != null ? `${ctx.awayBookings} bookings happened without you watching.` : "Booking activity continued.",
      ctx.awayReviews != null ? `${ctx.awayReviews} new review signals.` : "Reviews and follow-ups kept moving.",
      "I refreshed today's opportunity for where you are now — before the advice.",
    ],
    daysAway: days,
  };
}

export function buildWrapUps(ctx = {}) {
  const date = ctx.date ? new Date(ctx.date) : new Date();
  const dow = date.getDay();
  const dom = date.getDate();
  const month = date.getMonth();
  const wraps = [];
  if (dow === 5 || ctx.forceFriday) wraps.push({ kind: "friday", label: "Week in Review", summary: "This week: momentum on follow-ups, healthier trust, and one clear growth lever for next week." });
  if (dom === 1 || ctx.forceMonthStart) wraps.push({ kind: "month", label: "Month in Review", summary: "Last month closed with stronger conversion and a clearer customer rhythm." });
  if (([0, 3, 6, 9].includes(month) && dom <= 7) || ctx.forceQuarter) wraps.push({ kind: "quarter", label: "Business Evolution", summary: "This quarter: the business got sharper — less noise, more repeatable wins." });
  if (ctx.isAnniversary || ctx.forceAnniversary) wraps.push({ kind: "anniversary", label: "Business Story", summary: "A year of building in public — from idea to a living business. Here's the arc." });
  return wraps;
}

export function searchDailyArchive(archive, query) {
  const q = String(query || "").toLowerCase().trim();
  const list = Array.isArray(archive) ? archive : [];
  if (!q) return list.slice();
  return list.filter((d) => {
    const blob = [d.date, d.headline, d.opportunity?.title, d.ifMine, d.greeting, d.weekday].join(" ").toLowerCase();
    if (blob.includes(q)) return true;
    if (/last tuesday|tuesday/i.test(q) && /tue/i.test(d.weekday || "")) return true;
    return false;
  });
}

export function buildArchiveSeed(ctx = {}) {
  const key = resolveKey(ctx);
  const days = INDUSTRY_DAILY_DAYS[key] || INDUSTRY_DAILY_DAYS.pressure_washing;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((d, i) => ({
    id: `day-${i}`,
    date: ctx.baseDate || `2026-07-${String(13 + i).padStart(2, "0")}`,
    weekday: weekdays[i % 7],
    headline: d.headline,
    opportunity: d.opportunity,
    ifMine: d.ifMine,
    greeting: `Good morning — archive day ${i + 1}`,
  }));
}

export function orchestrateHublyDaily(ctx = {}) {
  const industryKey = resolveKey(ctx);
  const stageKey = resolveStage(ctx);
  const idx = dayIndex(ctx);
  const pack = pickDayPack(industryKey, idx);
  const name = firstNameOf(ctx);
  const stripeConnected = ctx.stripeConnected !== false;
  const stage = STAGE_CADENCE[stageKey];
  const overnight = buildOvernightReview(ctx);
  const returnSummary = buildReturnSummary(ctx);
  const wrapUps = buildWrapUps(ctx);
  const archive = Array.isArray(ctx.archive) ? ctx.archive : buildArchiveSeed(ctx);

  let opportunity = { ...pack.opportunity };
  let headline = pack.headline;
  if (!stripeConnected) {
    if (/membership|payment|stripe|checkout|revenue week|\$1,200/i.test(opportunity.title + headline + opportunity.impact)) {
      opportunity = {
        title: "Connect Stripe so booking and payments can fully activate.",
        why: "Without Stripe, payment-backed recommendations aren't available yet.",
        impact: "Unlock booking + payments.",
        action: "Connect Stripe",
      };
      headline = "Stripe isn't connected — I'll focus on what we can do without payments today.";
    }
  }

  const expertNotes = [
    { lead: "I noticed", text: pack.healthChange.reason, expert: "brand" },
    { lead: "I recommend", text: opportunity.title, expert: "growth" },
    { lead: "I found", text: pack.win, expert: "success" },
  ];

  return {
    version: DAILY_VERSION,
    label: DAILY_LABEL,
    notAFeed: true,
    notAReport: true,
    industryKey,
    stageKey,
    dayIndex: idx,
    greeting: `Good morning, ${name}`,
    reviewLine: "Last night I reviewed your business.",
    foundLine: "Here's what I found.",
    overnight,
    headline,
    opportunity: { ...opportunity, hasWhy: true, hasImpact: true, hasAction: true },
    opportunities: [opportunity],
    wins: [pack.win],
    healthChange: pack.healthChange,
    ifMine: { label: "If this were my business...", recommendation: pack.ifMine },
    expertNotes,
    oneVoice: true,
    neverShowAgents: true,
    forecast: { label: "Looking Ahead", ...pack.forecast },
    wrapUps,
    archive,
    stage,
    returnSummary,
    askContinuation: {
      label: "Ask Hubly",
      prompts: ["Why do you think that?", "What would you do next?", "Explain the health change."],
      continuous: true,
    },
    freshDaily: true,
    signature: [industryKey, stageKey, idx, opportunity.title.slice(0, 40)].join("::"),
  };
}

export function simulateSevenDays(ctx = {}) {
  return [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => orchestrateHublyDaily({ ...ctx, dayIndex }));
}

export function dailyExperiencesAreDistinct(a, b) {
  return a?.signature && b?.signature && a.signature !== b.signature;
}

export function evaluateDailyHtml(html) {
  const h = String(html || "");
  const issues = [];
  const ok = (cond, msg) => {
    if (!cond) issues.push(msg);
    return !!cond;
  };
  const slice = (() => {
    const i = h.indexOf('id="is-step-hubly-daily"');
    if (i < 0) {
      const j = h.indexOf('id="is-step-hubly-daily-shell"');
      if (j < 0) return "";
      const k = h.indexOf('id="is-step-vibe"', j);
      return k > j ? h.slice(j, k) : h.slice(j, j + 50000);
    }
    const k = h.indexOf('id="is-step-vibe"', i);
    return k > i ? h.slice(i, k) : h.slice(i, i + 50000);
  })();

  const checks = {
    dailyCanvas: ok(/data-hubly-daily|is-hubly-daily|id="is-step-hubly-daily"/.test(h), "Missing Hubly Daily canvas"),
    morningBrief: ok(/Good morning|Last night I reviewed|is-daily-brief/.test(h), "Missing Daily Brief"),
    overnight: ok(/Overnight Review|OVERNIGHT_SYSTEMS|is-daily-overnight/.test(h), "Missing Overnight Review"),
    headline: ok(/is-daily-headline|biggest opportunity|Your biggest opportunity/.test(h), "Missing one headline"),
    oneVoice: ok(/I noticed|I recommend|I found|neverShowAgents|is-daily-voice/.test(h), "Missing one Hubly voice"),
    opportunities: ok(/Expected Impact|is-daily-opportunity|Ready to send/.test(h), "Missing Daily Opportunities"),
    wins: ok(/is-daily-wins|average booking value|completed jobs|Homepage conversion/.test(h), "Missing Wins"),
    healthChanges: ok(/is-daily-health|Trust increased|healthChange|Reason:/.test(h), "Missing Business Health changes"),
    ifMine: ok(/If this were my business|is-daily-ifmine/.test(h), "Missing If this were my business"),
    askContinue: ok(/Ask Hubly|Why do you think that|is-daily-ask|dailyAskThread/.test(h), "Missing Ask continuation"),
    wrapUps: ok(/Week in Review|Month in Review|Business Evolution|Business Story|WRAP_UP|is-daily-wrap/.test(h), "Missing wrap-ups"),
    archive: ok(/Daily Archive|searchDailyArchive|is-daily-archive|last Tuesday/.test(h), "Missing Daily Archive"),
    cadence: ok(/STAGE_CADENCE|is-daily-cadence|Focus on setup|growing|established/.test(h), "Missing adaptive cadence"),
    forecast: ok(/Looking Ahead|Hubly Forecast|is-daily-forecast|Next Month/.test(h), "Missing Hubly Forecast"),
    homeHandoff: ok(/isEnterBusinessHome[\s\S]{0,900}isRunHublyDaily|isEnterHublyDaily|fromDaily|skipDaily/.test(h), "Business Home / login not handing off to Hubly Daily"),
    livingShell: ok(/is-step-living-business|Living Business|Epic 11/.test(h), "Missing Living Business soft shell"),
    wordmark: ok(/hubly-wordmark/.test(slice) || /is-daily-brand/.test(h), "Missing Hubly brand"),
  };
  return { passed: issues.length === 0, issues, checks };
}

export const HublyDaily = {
  version: DAILY_VERSION,
  label: DAILY_LABEL,
  orchestrate: orchestrateHublyDaily,
  simulateSevenDays,
  searchArchive: searchDailyArchive,
};
