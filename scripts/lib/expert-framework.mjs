/**
 * Hubly Brain — AI Expert Framework (Milestone 1 · Section 3)
 *
 * Extensible registry: experts self-register with full metadata.
 * Hubly Brain discovers and routes via the registry — never hardcodes expert lists.
 * Adding Growth / Finance / Marketplace / etc. = implement interface + register.
 * No Hubly Brain / think() modifications required.
 *
 * Rules:
 * - Experts never call models directly (Brain / HublyAI.complete only).
 * - Experts never talk to each other — everything routes through Hubly Brain.
 * - Adding an expert = register() only.
 */
import {
  withTimeout,
  DEFAULT_TIMEOUTS,
  recordMetric,
  circuitSuccess,
  circuitFailure,
  ownerSafeError as reliabilitySafeError,
} from "./reliability.mjs";

export const EXPERT_FRAMEWORK_VERSION = "1.0.0";
const REGISTRY = new Map();
const DISCOVERY_LOG = [];
function logDiscovery(event, expertId, detail) {
    const entry = { at: new Date().toISOString(), event, expertId, detail };
    DISCOVERY_LOG.push(entry);
    while (DISCOVERY_LOG.length > 200)
        DISCOVERY_LOG.shift();
    console.log("HublyBrain.expertFramework", entry);
}
function cloneDef(def) {
    return {
        ...def,
        responsibilities: [...(def.responsibilities || [])],
        inputs: [...def.inputs],
        outputs: [...def.outputs],
        requiredMemory: [...def.requiredMemory],
        allowedTools: [...(def.allowedTools || def.capability.tools || [])],
        allowedActions: [...(def.allowedActions || def.capability.actions || [])],
        capability: {
            can: [...def.capability.can],
            tools: [...def.capability.tools],
            reads: [...def.capability.reads],
            actions: [...def.capability.actions],
        },
        confidence: { ...def.confidence },
        reasoning: { ...def.reasoning, fields: [...def.reasoning.fields] },
        dependencies: [...(def.dependencies || [])],
        intents: def.intents ? [...def.intents] : null,
    };
}
function normalizeDef(def) {
    const capability = {
        can: [...(def.capability?.can || [])],
        tools: [...(def.capability?.tools || def.allowedTools || [])],
        reads: [...(def.capability?.reads || [])],
        actions: [...(def.capability?.actions || def.allowedActions || [])],
    };
    return cloneDef({
        ...def,
        responsibilities: def.responsibilities || [],
        allowedTools: def.allowedTools?.length ? def.allowedTools : capability.tools,
        allowedActions: def.allowedActions?.length ? def.allowedActions : capability.actions,
        capability,
        confidence: def.confidence || { baseline: 70, reportsReasoning: true },
        reasoning: def.reasoning || {
            required: true,
            fields: ["reason", "evidence", "confidence", "expectedImpact"],
        },
        executionPriority: def.executionPriority ?? 500,
        dependencies: def.dependencies || [],
        failureBehavior: def.failureBehavior || "fallback_local",
    });
}
/** Experts self-register here. Brain never maintains a static list. */
export function registerExpert(def, handler) {
    if (!def?.id)
        throw new Error("Expert registration requires id");
    if (!handler)
        throw new Error(`Expert ${def.id} requires a handler`);
    const normalized = normalizeDef(def);
    REGISTRY.set(normalized.id, { def: normalized, handler });
    logDiscovery("register", normalized.id, `${normalized.name}@${normalized.version}`);
}
/** Remove an expert cleanly (Demo Expert lifecycle). */
export function unregisterExpert(id) {
    const ok = REGISTRY.delete(String(id));
    if (ok)
        logDiscovery("unregister", id, "removed");
    else
        logDiscovery("unregister_miss", id, "not_registered");
    return ok;
}
export function getExpert(id) {
    return REGISTRY.get(String(id)) || null;
}
export function isExpertRegistered(id) {
    return REGISTRY.has(String(id));
}
/** Automatic discovery — returns all registered expert definitions. */
export function discoverExperts() {
    const list = listExperts();
    logDiscovery("discover", undefined, `${list.length}_experts`);
    return list;
}
export function listExperts() {
    return [...REGISTRY.values()]
        .map((e) => cloneDef(e.def))
        .sort((a, b) => a.executionPriority - b.executionPriority || a.id.localeCompare(b.id));
}
export function listExpertCapabilities() {
    return listExperts().map((e) => ({
        id: e.id,
        capability: e.capability,
        purpose: e.purpose,
        executionPriority: e.executionPriority,
    }));
}
export function listDiscoveryLog(limit = 40) {
    return DISCOVERY_LOG.slice(-Math.max(1, Math.min(200, limit))).map((e) => ({ ...e }));
}
export function clearRegistryForTests() {
    REGISTRY.clear();
    DISCOVERY_LOG.length = 0;
}
/** Sort expert ids by registry executionPriority (Brain uses this — no hardcoded order). */
export function orderExpertsByPriority(ids) {
    const unique = [...new Set(ids.map(String))];
    return unique
        .map((id) => ({
        id,
        priority: getExpert(id)?.def.executionPriority ?? 9999,
    }))
        .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
        .map((x) => x.id);
}
function expertMatchesIntent(def, intent, request) {
    if (def.alwaysInclude)
        return true;
    const intents = def.intents || [];
    if (intents.includes("*") || intents.includes(intent))
        return true;
    const hay = `${intent} ${request}`.toLowerCase();
    return def.capability.can.some((c) => {
        const token = c.toLowerCase();
        return hay.includes(token) || token === intent;
    });
}
/**
 * Registry-based routing — Hubly Brain selects experts from metadata only.
 * No hardcoded expert name lists in the orchestrator.
 */
export function selectExpertsFromRegistry(opts) {
    const intent = String(opts.intent || "general").toLowerCase();
    const request = String(opts.request || "").toLowerCase();
    const selected = new Set();
    if (opts.forced?.length) {
        opts.forced.forEach((id) => {
            if (getExpert(id))
                selected.add(String(id));
        });
        // Guardians still apply
        for (const e of listExperts()) {
            if (e.alwaysInclude)
                selected.add(e.id);
        }
    }
    else {
        for (const e of listExperts()) {
            if (expertMatchesIntent(e, intent, request))
                selected.add(e.id);
        }
        // Narrow fast-path intents: only alwaysInclude + experts that explicitly opt into that intent
        if (intent === "weather" || intent === "workspace") {
            for (const id of [...selected]) {
                const def = getExpert(id)?.def;
                if (!def)
                    continue;
                if (def.alwaysInclude)
                    continue;
                const intents = def.intents || [];
                const opted = intents.includes(intent) || def.capability.can.some((c) => c.toLowerCase() === intent);
                if (!opted)
                    selected.delete(id);
            }
        }
    }
    // Resolve dependencies transitively
    let changed = true;
    while (changed) {
        changed = false;
        for (const id of [...selected]) {
            const deps = getExpert(id)?.def.dependencies || [];
            for (const dep of deps) {
                if (getExpert(dep) && !selected.has(dep)) {
                    selected.add(dep);
                    changed = true;
                }
            }
        }
    }
    const ordered = orderExpertsByPriority([...selected]);
    logDiscovery("route", undefined, `${intent} → ${ordered.join(",") || "(none)"}`);
    return ordered;
}
/** @deprecated use selectExpertsFromRegistry — kept for older callers. */
export function expertsForIntent(intent) {
    return selectExpertsFromRegistry({ intent, request: intent });
}
/** Strip stacks / provider jargon — internal diagnostics only. */
export function sanitizeExpertError(err) {
    const raw = err instanceof Error ? err.message : String(err || "unknown");
    return raw
        .replace(/\s+at\s+\S+.*/g, "")
        .replace(/openai|anthropic|api\.|gpt-?\d|claude|stack|exception/gi, "system")
        .slice(0, 240)
        .trim() || "expert_failed";
}
function finalizeExpertOutput(id, name, out, meta) {
    const structured = out.output ?? out.payload ?? null;
    return {
        ...out,
        expertId: id,
        expertName: out.expertName || name,
        executionTimeMs: meta.executionTimeMs,
        retries: meta.retries,
        status: meta.status,
        output: structured,
        payload: out.payload ?? structured,
        ok: out.ok !== false && meta.status !== "failed" && meta.status !== "skipped",
        reasoning: Array.isArray(out.reasoning) ? out.reasoning : [],
        confidence: typeof out.confidence === "number" ? out.confidence : 0,
        error: out.error ? sanitizeExpertError(out.error) : null,
    };
}
/**
 * Run one expert through Hubly Brain.
 * Retries when appropriate, continues safely on failure, never throws to the customer path.
 */
export async function runExpert(id, ctx) {
    const entry = getExpert(id);
    if (!entry) {
        logDiscovery("execute_miss", id, "not_registered");
        return {
            expertId: id,
            expertName: id,
            ok: false,
            status: "failed",
            executionTimeMs: 0,
            retries: 0,
            summary: "Expert not available — Hubly will continue with what it knows.",
            reasoning: [{ reason: "Expert was not registered in the framework.", evidence: [], confidence: 0 }],
            confidence: 0,
            error: "not_registered",
        };
    }
    const name = entry.def.name;
    const maxRetries = entry.def.failureBehavior === "skip" ? 0 : 1;
    let lastErr = null;
    const started = Date.now();
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        logDiscovery(attempt === 0 ? "execute" : "execute_retry", id, `${name}${attempt ? `@${attempt}` : ""}`);
        try {
            const t0 = Date.now();
            // Section 14 — every expert call is bounded by timeout (Reliability).
            const out = await withTimeout(
                () => entry.handler(ctx),
                DEFAULT_TIMEOUTS.expert,
                `expert:${id}`,
            );
            const ms = Date.now() - t0;
            const status = attempt > 0 ? "retried" : "ok";
            circuitSuccess("expert");
            recordMetric("expert_execution", id, ms, true, { retries: attempt });
            logDiscovery("execute_ok", id, `confidence=${out.confidence};retries=${attempt}`);
            return finalizeExpertOutput(id, name, out, {
                executionTimeMs: ms,
                retries: attempt,
                status,
            });
        }
        catch (err) {
            lastErr = err;
            circuitFailure("expert", err);
            recordMetric("expert_execution", id, Date.now() - started, false, {
                error: reliabilitySafeError(err),
            });
            const msg = sanitizeExpertError(err);
            logDiscovery("execute_fail", id, msg);
            if (attempt < maxRetries)
                continue;
        }
    }
    const ms = Date.now() - started;
    const internal = sanitizeExpertError(lastErr);
    const skipped = entry.def.failureBehavior === "skip";
    logDiscovery(skipped ? "execute_skip" : "execute_soft_fail", id, internal);
    return finalizeExpertOutput(id, name, {
        expertId: id,
        expertName: name,
        ok: false,
        summary: skipped
            ? "This step was skipped so Hubly could keep moving."
            : "This step had trouble — Hubly will continue with the rest of the plan.",
        reasoning: [{
                reason: skipped
                    ? "Expert failureBehavior=skip — Brain continued without this output."
                    : "Expert failed after retry — Brain continued safely without exposing internals.",
                evidence: [],
                confidence: 0,
                expectedImpact: "Customer still receives a calm Hubly response",
            }],
        confidence: 0,
        error: internal,
        output: { type: "Failure", internalOnly: true },
        payload: { type: "Failure", internalOnly: true },
    }, {
        executionTimeMs: ms,
        retries: maxRetries,
        status: skipped ? "skipped" : "failed",
    });
}
export const HublyExpertFramework = {
    version: EXPERT_FRAMEWORK_VERSION,
    register: registerExpert,
    unregister: unregisterExpert,
    get: getExpert,
    isRegistered: isExpertRegistered,
    list: listExperts,
    discover: discoverExperts,
    listCapabilities: listExpertCapabilities,
    selectFromRegistry: selectExpertsFromRegistry,
    orderByPriority: orderExpertsByPriority,
    expertsForIntent,
    run: runExpert,
    sanitizeError: sanitizeExpertError,
    discoveryLog: listDiscoveryLog,
    clearForTests: clearRegistryForTests,
};
