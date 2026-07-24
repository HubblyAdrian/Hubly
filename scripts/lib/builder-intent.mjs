/** Node mirror of hubly_brain_builder_intent.ts — Milestone 1.5 Epic 1 (esbuild). */


// supabase/functions/_shared/hubly_brain_builder_intent.ts
var BUILDER_INTENT_VERSION = "1.0.0";
var TOOL_TO_SYSTEM = {
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
function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function collectSignals(request) {
  const r = String(request || "").toLowerCase();
  const signals = [];
  if (/homepage|website|premium|luxury|brand(?:ing)?|hero|layout|feel more/.test(r)) {
    const branding = /premium|luxury|brand/.test(r);
    signals.push({
      category: branding && !/homepage|website/.test(r) ? "Branding" : "Website",
      system: "Website",
      label: branding ? "Website Improvement" : "Website Change",
      goal: branding ? "Premium Branding" : "Website Update",
      risk: "medium",
      defaultCaps: [{
        toolId: "website_builder",
        toolName: "Website Builder",
        capabilityId: "update_homepage",
        capabilityLabel: "Update Homepage"
      }],
      weight: branding ? 3 : 2
    });
  }
  if (/same-?day|no same.?day|arrival window|booking rule|minimum notice|appointments? are scheduled|travel buffer|minutes to drive|drive between|daily capacity|two jobs|2 jobs|maximum per day|weather|raining|reschedule exterior|fridays? (are|only).*ceramic|ceramic.*(friday|only|after 2)|coating.?only|never.*after 2|estimate.?only|estimates on|tuesdays? are estimate|optimiz(e|ing).*schedule|driving across town|seasonal|snow removal|skill rout|emergency.?only/.test(
    r
  )) {
    const goal = /same-?day/.test(r) ? "Minimum Notice" : /arrival/.test(r) ? "Arrival Windows" : /travel|drive/.test(r) ? "Travel Buffers" : /capacity|two jobs|2 jobs/.test(r) ? "Daily Capacity" : /weather|rain/.test(r) ? "Weather-Aware Scheduling" : /ceramic|friday|coating|after 2/.test(r) ? "Service-Specific Schedule" : /estimate/.test(r) ? "Estimate-Only Days" : /optimiz|route|driving across/.test(r) ? "Route Optimization" : /seasonal|snow/.test(r) ? "Seasonal Availability" : "Booking Intelligence";
    signals.push({
      category: "Booking",
      system: "Booking",
      label: "Booking Intelligence",
      goal,
      risk: "medium",
      defaultCaps: [{
        toolId: "booking",
        toolName: "Booking Intelligence Builder",
        capabilityId: /same-?day/.test(r) ? "no_same_day_bookings" : /arrival/.test(r) ? "arrival_windows" : "booking_rules",
        capabilityLabel: goal
      }],
      weight: 3
    });
  }
  if (/move .*above|jobs above|sidebar order|workspace|dashboard layout|put .+ above|hide revenue|hide marketing|never.*(use|look)|pin quick|calendar.*(home|landing)|make calendar|mobile workspace|phone workspace|what (do you think|should i)|focus mode|job day/.test(
    r
  )) {
    signals.push({
      category: "Workspace",
      system: "Workspace",
      label: "Workspace Intelligence",
      goal: /hide/.test(r) ? "Hide Module" : /pin/.test(r) ? "Pin Action" : /calendar|homepage|landing|home/.test(r) ? "Adaptive Homepage" : /mobile|phone/.test(r) ? "Mobile Workspace" : /recommend|what (do you think|should i)/.test(r) ? "Workspace Recommendations" : /focus|job day|sales day/.test(r) ? "Focus Mode" : "Navigation Order",
      risk: "low",
      defaultCaps: [{
        toolId: "workspace_builder",
        toolName: "Workspace Intelligence Builder",
        capabilityId: /pin/.test(r) ? "pin_actions" : "sidebar_order",
        capabilityLabel: /pin/.test(r) ? "Pin Actions" : "Sidebar Order"
      }],
      weight: 3
    });
  }
  if (/portfolio|upload.*(photo|image)|these \d+ photos|gallery|instagram|before.?after|hero.*photo|weak photo|organize everything|visual timeline/.test(r)) {
    signals.push({
      category: "Portfolio",
      system: "Portfolio",
      label: "Media Intelligence",
      goal: /hero/.test(r) ? "Hero Replacement" : /instagram|carousel/.test(r) ? "Social Content" : /before.?after/.test(r) ? "Before/After Pairs" : /timeline|evolved/.test(r) ? "Visual Timeline" : "Gallery Organization",
      risk: "low",
      defaultCaps: [
        {
          toolId: "portfolio_builder",
          toolName: "Media Intelligence Engine",
          capabilityId: "upload_photos",
          capabilityLabel: "Upload Photos"
        },
        {
          toolId: "image_processor",
          toolName: "Image Processor",
          capabilityId: "process_images",
          capabilityLabel: "Process Images"
        },
        {
          toolId: "website_builder",
          toolName: "Website Builder",
          capabilityId: "update_homepage",
          capabilityLabel: "Update Homepage"
        }
      ],
      weight: 3
    });
  }
  if (/prep instruction|after .+ booking|send .+ after|automation|workflow|reminder|review request|ask for (a )?review|follow up on quotes|quote.*5 day|membership.*month|friday.*(summary|report)|recurring customer|reschedule exterior.*rain|if it rains/.test(
    r
  )) {
    signals.push({
      category: "Automations",
      system: "Automations",
      label: "Automation Intelligence",
      goal: /prep/.test(r) ? "Post-Booking Prep Instructions" : /review/.test(r) ? "Review Requests" : /quote/.test(r) ? "Quote Follow-Up" : /rain|weather/.test(r) ? "Weather Reschedule" : /membership/.test(r) ? "Membership Billing" : /friday|summary/.test(r) ? "Friday Summary" : /recurring/.test(r) ? "Recurring Customers" : "Automated Workflow",
      risk: "medium",
      defaultCaps: [{
        toolId: "automation",
        toolName: "Automation Intelligence Builder",
        capabilityId: "create_workflow",
        capabilityLabel: "Create Workflow"
      }],
      weight: 3
    });
  }
  if (/crm|pipeline|lead|customer record|hide module|pin widget|pin the/.test(r) && !/jobs above/.test(r)) {
    signals.push({
      category: "CRM",
      system: "CRM",
      label: "CRM Change",
      goal: /hide/.test(r) ? "Hide Module" : /pin/.test(r) ? "Pin Widget" : "CRM Update",
      risk: "low",
      defaultCaps: [{
        toolId: "crm",
        toolName: "CRM",
        capabilityId: "update_customer",
        capabilityLabel: "Update Customer"
      }],
      weight: 3
    });
  }
  if (/package|pricing tier|membership/.test(r)) {
    signals.push({
      category: "Packages",
      system: "Packages",
      label: "Package Change",
      goal: "Package / Pricing Update",
      risk: "medium",
      defaultCaps: [{
        toolId: "packages_builder",
        toolName: "Packages Builder",
        capabilityId: "package_create",
        capabilityLabel: "Create Package"
      }],
      weight: 2
    });
  }
  if (/marketplace|service radius/.test(r)) {
    signals.push({
      category: "Marketplace",
      system: "Marketplace",
      label: "Marketplace Change",
      goal: "Marketplace Settings",
      risk: "medium",
      defaultCaps: [{
        toolId: "marketplace",
        toolName: "Marketplace",
        capabilityId: "marketplace_radius",
        capabilityLabel: "Radius"
      }],
      weight: 2
    });
  }
  if (/integrat|stripe|google calendar|connect /.test(r)) {
    signals.push({
      category: "Integrations",
      system: "Integrations",
      label: "Integration Change",
      goal: "Connect Integration",
      risk: "high",
      defaultCaps: [{
        toolId: "booking",
        toolName: "Booking",
        capabilityId: "calendar_sync",
        capabilityLabel: "Calendar Sync"
      }],
      weight: 2
    });
  }
  return signals;
}
function mergeCapabilities(signals, registry) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (c) => {
    const k = `${c.toolId}:${c.capabilityId}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };
  for (const s of signals) {
    for (const c of s.defaultCaps) push(c);
  }
  for (const c of registry || []) {
    const sys = TOOL_TO_SYSTEM[c.toolId];
    const relevant = !signals.length || signals.some((s) => s.system === sys || s.defaultCaps.some((d) => d.toolId === c.toolId));
    if (relevant) {
      push({
        toolId: c.toolId,
        toolName: c.toolName,
        capabilityId: c.capabilityId,
        capabilityLabel: c.capabilityLabel
      });
    }
  }
  return out;
}
function buildConfidenceExplanation(opts) {
  const reasons = [];
  const r = opts.request.toLowerCase();
  if (/premium|same-?day|arrival|travel|capacity|weather|ceramic|estimate|optimiz|seasonal|jobs above|portfolio|prep instruction/.test(r)) {
    reasons.push("I've seen this request pattern before.");
  } else {
    reasons.push("The request maps cleanly to a known builder category.");
  }
  const builders = [...new Set(opts.caps.map((c) => c.toolName))];
  if (builders.length) {
    reasons.push(
      builders.length === 1 ? `${builders[0]} supports it.` : `${builders.join(", ")} support it.`
    );
  }
  reasons.push("No conflicting rules exist in this Intent-only pass.");
  const industry = opts.memory && (opts.memory.industry || opts.memory.business?.industry);
  if (industry) {
    reasons.push(`Business Memory aligns with this change (${String(industry)}).`);
  } else {
    reasons.push("Business Memory does not conflict with this change.");
  }
  reasons.push("No additional clarification is required.");
  const summary = reasons.join(" ");
  return { reasons, summary };
}
function createBuilderIntent(request, ctx = {}) {
  const signals = collectSignals(request);
  const systems = [...new Set(signals.map((s) => s.system))];
  const multi = systems.length > 1;
  const primary = signals.sort((a, b) => b.weight - a.weight)[0] || {
    category: "Business Strategy",
    system: "Business",
    label: "Business Change",
    goal: "Understand Owner Request",
    risk: "low",
    defaultCaps: [],
    weight: 1
  };
  const intentCategory = multi ? "Multiple Systems" : primary.category;
  const caps = mergeCapabilities(signals, ctx.registryCapabilities);
  let confidence = 78;
  if (signals.length) confidence += 8;
  if (caps.length) confidence += 6;
  if (multi && caps.length >= 2) confidence += 4;
  if (ctx.memory && (ctx.memory.industry || ctx.memory.name)) confidence += 3;
  confidence = clamp(confidence);
  const risk = multi ? "medium" : signals.reduce((acc, s) => {
    if (s.risk === "high" || acc === "high") return "high";
    if (s.risk === "medium" || acc === "medium") return "medium";
    return "low";
  }, "low");
  const confidenceExplanation = buildConfidenceExplanation({
    request,
    category: intentCategory,
    caps,
    memory: ctx.memory,
    confidence
  });
  const evidence = [
    `category:${intentCategory}`,
    ...systems.map((s) => `system:${s}`),
    ...caps.map((c) => `cap:${c.toolId}/${c.capabilityId}`)
  ];
  return {
    intentId: uid("bint"),
    version: BUILDER_INTENT_VERSION,
    originalRequest: String(request || "").trim(),
    intentCategory,
    intentLabel: multi ? `Multi-System: ${systems.join(" + ")}` : primary.label,
    ownerGoal: multi ? signals.map((s) => s.goal).join(" \xB7 ") : primary.goal,
    affectedSystems: systems.length ? systems : ["Business"],
    requiredCapabilities: caps,
    estimatedRisk: risk,
    confidence,
    confidenceExplanation,
    requiresChangePlan: true,
    reasoning: [{
      reason: multi ? "Owner described changes spanning multiple systems \u2014 kept as one Builder Intent (not split)." : `Classified as ${primary.label} toward ${primary.goal}.`,
      evidence,
      confidence
    }],
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    applied: false,
    changePlanGenerated: false
  };
}
function isBuilderRequest(request) {
  return collectSignals(request).length > 0;
}
export {
  BUILDER_INTENT_VERSION,
  createBuilderIntent,
  isBuilderRequest
};
