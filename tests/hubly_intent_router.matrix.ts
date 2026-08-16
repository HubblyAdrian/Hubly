/**
 * Intent Router — shadow-mode scenario matrix.
 *
 * The 13 approved scenarios plus the Storefront/detailing contamination
 * regression, run against the real router with no API key and no network.
 *
 * This is the dataset we judge Phase 1 on: for each utterance it records what the
 * CURRENT surface-driven system would have routed to, what the router chooses,
 * and whether they agree — the old-vs-new comparison, not just the new plan.
 *
 * Run: deno run --allow-read --no-check tests/hubly_intent_router.matrix.ts
 */

import { buildPlan, landingPrompts, type BusinessContext, type RouterInput, type SurfaceId } from "../supabase/functions/_shared/hubly_intent_router.ts";
import { compareRouting, formatComparison } from "../supabase/functions/_shared/hubly_routing_shadow.ts";
import { resolveBusinessDna } from "../supabase/functions/_shared/hubly_business_dna.ts";

let passed = 0;
const failures: string[] = [];
const ck = (n: string, c: boolean, d?: unknown) => {
  if (c) { passed++; console.log("  PASS · " + n); }
  else { failures.push(n); console.log("  FAIL · " + n + (d !== undefined ? "  [" + JSON.stringify(d) + "]" : "")); }
};

/* ── two real businesses, neither of them a detailer ── */
function biz(over: Partial<BusinessContext> = {}, type = "photography"): BusinessContext {
  return {
    id: "biz-test",
    identity: { name: "Willow & Vine Photography", businessType: type, accent: "#2E4A62", city: "Provo" },
    dna: resolveBusinessDna(type),
    entitlements: { tier: "pro", capabilities: { website: true } },
    state: {
      hasWebsiteDocument: true, hasStorefrontAst: false,
      serviceCount: 4, productCount: 0, photoCount: 12,
      hasLogo: true, hasBrandColor: true,
      hasStripeConnect: true, hasGoogleCalendar: false,
      openSessionCount: 1, upcomingJobCount: 3,
      customerCount: 40, unbookedLeadCount: 14,
      marketplaceProvider: "none",
    },
    ...over,
  };
}

function run(utterance: string, opts: Partial<RouterInput> = {}) {
  const input: RouterInput = {
    utterance,
    actor: opts.actor ?? { kind: "owner" },
    business: opts.business !== undefined ? opts.business : biz(),
    surfaceHint: opts.surfaceHint ?? null,
    intentSeed: opts.intentSeed ?? null,
    classifierHint: opts.classifierHint ?? null,
    history: opts.history,
  };
  const { plan, comparison } = compareRouting(input);
  console.log(formatComparison(comparison));
  return { plan, comparison };
}

const agreementTally: Record<string, number> = {};
function tally(a: string) { agreementTally[a] = (agreementTally[a] ?? 0) + 1; }

console.log("\n═══ SHADOW-MODE MATRIX ═══\n");

/* 1 ── Website: build */
{
  console.log("── 1. Build website ──");
  const { plan, comparison } = run("Build me a website.", { surfaceHint: "landing" });
  tally(comparison.agreement);
  ck("routes to create_website", plan.intent === "create_website", plan.intent);
  ck("selects the website capability", plan.capabilities.includes("website"));
  ck("BUILD-FIRST: asks nothing (name, type, services all known)", plan.ask === null, plan.ask);
  ck("plans a real action", plan.steps.some((s) => s.action === "generateDocument"));
}

/* 2 ── Website: edit */
{
  console.log("\n── 2. Edit website ──");
  const { plan } = run("Make it more premium.", { surfaceHint: "website" });
  ck("routes to refine_website", plan.intent === "refine_website", plan.intent);
  ck("asks nothing", plan.ask === null);
  ck("patches rather than regenerates", plan.steps.some((s) => s.action === "patchDocument"));
}

/* 3 ── Website: design reference */
{
  console.log("\n── 3. Design reference ──");
  const { plan } = run("Use this website as inspiration.", { surfaceHint: "website" });
  ck("routes to apply_design_reference", plan.intent === "apply_design_reference", plan.intent);
  ck("stays inside the website capability", plan.capabilities.every((c) => c === "website"));
}

/* 4 ── Product Store: shirts */
{
  console.log("\n── 4. Sell shirts ──");
  const { plan, comparison } = run("I want to sell shirts.", { surfaceHint: null });
  tally(comparison.agreement);
  ck("routes to enable_commerce", plan.intent === "enable_commerce", plan.intent);
  ck("NEVER HIDDEN: commerce is offered, not refused",
    !plan.preconditions.some((p) => p.status === "unavailable"), plan.preconditions);
  ck("asks nothing — enabling is the offer, not a question", plan.ask === null, plan.ask);
}

/* 5 ── Product Store: prints (photographer, printStore:true) */
{
  console.log("\n── 5. Sell prints ──");
  const { plan } = run("I want to sell prints.");
  ck("routes to enable_commerce", plan.intent === "enable_commerce", plan.intent);
  const pre = plan.preconditions.find((p) => p.id === "commerce.enabled");
  ck("commerce is resolvable (enable-on-demand), not unavailable", pre?.status === "resolvable", pre);
  ck("the enable path comes from the blueprint, not a guess",
    pre?.status === "resolvable" && pre.missing.defaultApplied?.source === "dna", pre);
  ck("no product-type interview", plan.ask === null, plan.ask);
}

/* 6 ── One-Off Session */
{
  console.log("\n── 6. Create a One-Off Session ──");
  const { plan, comparison } = run("I'm doing mini sessions August 20 from 8 to 2.", { surfaceHint: "landing" });
  tally(comparison.agreement);
  ck("routes to create_one_off_session", plan.intent === "create_one_off_session", plan.intent);
  ck("selects sessions + calendar + payments",
    ["sessions", "calendar", "payments"].every((c) => plan.capabilities.includes(c)), plan.capabilities);
  ck("BUILD-FIRST: duration defaulted from DNA, not asked",
    plan.missing_requirements.some((m) => m.id === "session.duration" && !m.blocking && m.defaultApplied?.source === "dna"),
    plan.missing_requirements);
  ck("asks nothing", plan.ask === null, plan.ask);
  ck("creating a draft is not consequential", plan.requires_confirmation === false);
}

/* 7 ── Cross-capability: promote session */
{
  console.log("\n── 7. Promote session to website ──");
  const { plan, comparison } = run("Put my mini sessions on my website.", { surfaceHint: "sessions" });
  tally(comparison.agreement);
  ck("routes to promote_session", plan.intent === "promote_session", plan.intent);
  ck("CROSS-CAPABILITY: sessions + storefront in one plan",
    plan.capabilities.includes("sessions") && plan.capabilities.includes("storefront"), plan.capabilities);
  ck("asks nothing — one open session is inferred", plan.ask === null, plan.ask);
}

/* 8 ── Marketplace: consumer */
{
  console.log("\n── 8. Marketplace customer ──");
  const { plan } = run("I need someone to detail my car.", { actor: { kind: "anonymous" }, business: null });
  ck("routes to find_pro", plan.intent === "find_pro", plan.intent);
  ck("needs no business context", plan.ask === null, plan.ask);
  ck("owner capabilities are unreachable", !plan.capabilities.includes("storefront"));
}

/* 9 ── Marketplace: provider */
{
  console.log("\n── 9. Marketplace provider ──");
  const { plan, comparison } = run("I want to get more jobs through Hubly.");
  tally(comparison.agreement);
  ck("routes to join_marketplace", plan.intent === "join_marketplace", plan.intent);
  ck("asks nothing — city already known", plan.ask === null, plan.ask);

  const noCity = run("I want to get more jobs through Hubly.", {
    business: biz({ identity: { name: "Willow & Vine Photography", businessType: "photography", accent: null, city: null } }),
  }).plan;
  ck("with no service area, asks exactly ONE question", !!noCity.ask && noCity.ask.resolves === "provider.area", noCity.ask);
}

/* 10 ── Operations: move a job */
{
  console.log("\n── 10. Move an appointment ──");
  const { plan, comparison } = run("Move John's appointment to 3.", { surfaceHint: "jobs" });
  tally(comparison.agreement);
  ck("routes to reschedule_appointment", plan.intent === "reschedule_appointment", plan.intent);
  ck("selects jobs + calendar", plan.capabilities.includes("jobs") && plan.capabilities.includes("calendar"));
  ck("consequential ⇒ requires confirmation", plan.requires_confirmation === true);
}

/* 11 ── Leads query */
{
  console.log("\n── 11. Lead query ──");
  const { plan } = run("Who hasn't booked after getting a quote?", { surfaceHint: "leads" });
  ck("routes to lead_query", plan.intent === "lead_query", plan.intent);
  ck("read-only ⇒ no confirmation", plan.requires_confirmation === false);
}

/* 12 ── Automation */
{
  console.log("\n── 12. Follow-up automation ──");
  const { plan, comparison } = run("Follow up with people who didn't book.");
  tally(comparison.agreement);
  ck("routes to create_followup", plan.intent === "create_followup", plan.intent);
  ck("selects automation + crm", plan.capabilities.includes("automation") && plan.capabilities.includes("crm"));
  ck("CONSEQUENTIAL: contacting real people requires confirmation", plan.requires_confirmation === true);
  ck("audience verified against real state", plan.preconditions.some((p) => p.id === "audience.nonEmpty" && p.status === "satisfied"));

  const noAudience = run("Follow up with people who didn't book.", {
    business: biz({ state: { ...biz().state, unbookedLeadCount: 0 } }),
  }).plan;
  ck("with nobody to contact, it does not invent an audience",
    noAudience.preconditions.some((p) => p.status === "unavailable") || noAudience.steps.length === 0, noAudience);
}

/* 13 ── Ambiguous: exactly one question */
{
  console.log("\n── 13. Ambiguous ──");
  const { plan } = run("I want to sell.");
  ck("does not guess", plan.intent === "unclear" || !!plan.ask, plan.intent);
  ck("asks EXACTLY ONE question", plan.ask !== null && typeof plan.ask.question === "string", plan.ask);
  ck("the question names the requirement it resolves",
    !!plan.ask?.resolves && (plan.ask.resolves === "intent" ||
      plan.preconditions.some((p) => p.id === plan.ask!.resolves)), plan.ask);
  ck("it is a USEFUL question, not a product-type interview",
    /what would you like to sell|do you mean/i.test(plan.ask?.question ?? "") &&
    !/physical|digital|mix/i.test(plan.ask?.question ?? ""), plan.ask);
  // The real invariant: naming a capability is not permission to act. Nothing
  // runs while a blocking question is open.
  ck("NOTHING EXECUTES while a question is open", plan.steps.length === 0, plan.steps);
  ck("and it is not treated as confirmed", plan.requires_confirmation === false);
}

/* ══ THE REGRESSION: the original failure, permanently pinned ══ */
{
  console.log("\n── REGRESSION · non-detailer asks for a storefront ──");
  for (const trade of ["photography", "spa", "landscaping"]) {
    const b = biz({ identity: { name: "Test Co", businessType: trade, accent: "#123456", city: "Provo" } }, trade);
    b.dna = resolveBusinessDna(trade);
    const { plan, comparison } = run("I need a storefront.", { business: b, surfaceHint: "store" });
    tally(comparison.agreement);

    ck(`[${trade}] does NOT route to the product store`,
      plan.intent !== "enable_commerce" && plan.intent !== "design_product_store", plan.intent);
    ck(`[${trade}] routes to the Business Storefront`, plan.intent === "create_storefront", plan.intent);
    ck(`[${trade}] the open Store tab did NOT decide it`,
      comparison.surface_hint === "store" && plan.intent === "create_storefront");

    // No product-commerce interview, ever.
    const asked = (plan.ask?.question ?? "").toLowerCase();
    for (const banned of ["physical", "digital", "mix", "shipping", "pickup", "categor", "best seller"]) {
      ck(`[${trade}] never asks about "${banned}"`, !asked.includes(banned), asked);
    }
    // No automotive language anywhere in the plan.
    const blob = JSON.stringify(plan).toLowerCase();
    for (const banned of ["detailing", "detailer", "ceramic coating", "car wash", "carnauba", "microfiber", "automotive"]) {
      ck(`[${trade}] plan contains no "${banned}"`, !blob.includes(banned), banned);
    }
  }

  // The follow-up turn from the original bug report.
  const b = biz({}, "photography");
  const { plan } = run("Can you show me this?", { business: b, surfaceHint: "store" });
  const asked = (plan.ask?.question ?? "").toLowerCase();
  ck("follow-up turn does not start a product interview",
    !["physical", "digital", "mix"].some((w) => asked.includes(w)), asked);
}

/* ══ Landing prompts come from the registry ══ */
{
  console.log("\n── Landing-page capability prompts ──");
  const anon = landingPrompts("anonymous");
  ck("generated from the intent registry", anon.length > 0, anon);
  ck("anonymous is offered building, not operating",
    anon.some((p) => p.id === "create_website") && !anon.some((p) => p.id === "create_followup"), anon);
  console.log("   " + anon.map((p) => p.label).join(" · "));
}

/* ══ Authorization invariant ══ */
{
  console.log("\n── Authorization invariant ──");
  const starter = biz({ entitlements: { tier: "starter", capabilities: {} } });
  const { plan } = run("I want to sell prints.", { business: starter });
  ck("a plan carries no credential — only capability NAMES",
    plan.capabilities.every((c) => typeof c === "string") &&
    !JSON.stringify(plan).includes("token") && !JSON.stringify(plan).includes("authorized"), plan.capabilities);
  ck("entitlement is NOT decided by the router (dispatch re-checks)",
    !("granted" in (plan as unknown as Record<string, unknown>)));
}

/* ── the Phase 1 headline ── */
console.log("\n═══ OLD vs NEW AGREEMENT ═══");
for (const [k, v] of Object.entries(agreementTally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(18)} ${v}`);
}

console.log(`\n==== ROUTER MATRIX: ${passed} passed, ${failures.length} failed ====`);
if (failures.length) { failures.forEach((f) => console.log("  ✗ " + f)); Deno.exit(1); }
