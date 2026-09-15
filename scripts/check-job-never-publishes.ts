/**
 * A JOB NEVER PUBLISHES TO THE PAGE. IT OFFERS.
 *
 *   deno run --allow-env --allow-net=127.0.0.1 scripts/check-job-never-publishes.ts
 *   (or: npm run check:job-publishes)
 *
 * ADRIAN'S RULING, 2026-09-15:
 *
 *   "Adding a job is internal work. Adding a service changes what the public sees and what
 *    strangers can book. Those are different acts and a paste of one may not silently perform
 *    the other. Notice the gap: yes, that is exactly Hubly's job. Publish without being asked:
 *    never."
 *
 * WHAT SHIPPED. He typed "I need a job added: Thursday at 2 to do the driveway, 14 Maple St,
 * 555-0134, we said $180" and four seconds before his job row existed, `driveway` $180 went live
 * in BOTH stores — services and meta.service_catalog — with flags.website, flags.marketplace and
 * instant_book_eligible all true. A stranger could book it.
 *
 * HOW THIS CHECK WORKS. It runs the REAL applyExtractedFacts from the shipping registry, with
 * `fetch` replaced by a declared fake that answers as PostgREST would and RECORDS EVERY WRITE.
 * The branching, the two-store guard and the proposal are the product's; only the transport is
 * simulated, and it is simulated so that a write cannot silently succeed against nothing.
 *
 * SIMULATED AND SAID SO: no database. What is proved is the decision — publish or propose — and
 * that is where the defect lived.
 *
 * Exit: 0 PASS · 1 FAIL
 */
import { applyExtractedFacts } from "../supabase/functions/_shared/hubly_capability_registry.ts";

let failed = 0;
const say = (n: string, ok: boolean, d?: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
  if (!ok) failed++;
};

const BIZ = "00000000-0000-0000-0000-0000000000cc";
const OWNER = "00000000-0000-0000-0000-0000000000dd";

type Writes = { rpc: string; body: Record<string, unknown> }[];

/** The fake backend. Answers reads from `row`, and RECORDS every write instead of performing
 *  one — so "it wrote nothing" is proved by an empty list, not by the absence of an error. */
function install(row: Record<string, unknown>, servicesRows: unknown[]): Writes {
  const writes: Writes = [];
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:1");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "simulated-not-a-real-key");
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/rpc/")) {
      const fn = url.split("/rest/v1/rpc/")[1].split("?")[0];
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(String(init?.body || "{}")); } catch { /* ignore */ }
      writes.push({ rpc: fn, body });
      return json({ ok: true });
    }
    if (url.includes("/rest/v1/businesses")) return json([row]);
    if (url.includes("/rest/v1/services")) return json(servicesRows);
    if (url.includes("/auth/v1/user")) return json({ id: OWNER });
    return json([]);
  }) as typeof fetch;
  return writes;
}

const SERVICE = [{ name: "driveway", price: 180 }];
const catalogWith = (n: number) => JSON.stringify({
  service_catalog: { services: Array.from({ length: n }, (_, i) => ({ name: `Existing ${i + 1}`, pricing: { price_cents: 12000 } })) },
});

// ── 1. A CLAIMED BUSINESS: nothing is published, the service is PROPOSED. ───────────────
{
  const writes = install({ id: BIZ, owner_id: OWNER, meta: catalogWith(3) }, []);
  const r = await applyExtractedFacts(BIZ, "", {}, SERVICE, OWNER, "we said $180 for the driveway");
  const serviceWrites = writes.filter((w) => /service|catalog/i.test(w.rpc));
  say("1 a claimed business publishes NOTHING from an inferred price",
    serviceWrites.length === 0,
    serviceWrites.length ? JSON.stringify(serviceWrites.map((w) => w.rpc)) : `${writes.length} write(s), none to services`);
  say("2 and the service is PROPOSED instead, by name and price",
    r.proposedServices.length === 1 && r.proposedServices[0].name === "driveway" && r.proposedServices[0].price === 180,
    JSON.stringify(r.proposedServices));
  say("3 nothing is reported as written",
    !r.written.some((w) => /service/i.test(w)), JSON.stringify(r.written));
}

// ── 1b. THE CLAIMED RULE, ISOLATED. ────────────────────────────────────────────────────
//
// Leg 1 above uses a business with a 3-service catalog, so the two-store guard would block the
// write even with the claimed rule removed — and it did: restoring the defect left leg 1 GREEN.
// A leg that passes because a DIFFERENT guard caught the defect does not test the guard it
// names, and that is how a rule ships believed and unproved.
//
// So: a CLAIMED business with NOTHING in either store. Only the claimed rule can stop the
// publish here, and this is the real shape of the harm — an owner whose relational `services`
// table is empty while his page is live.
{
  const writes = install({ id: BIZ, owner_id: OWNER, meta: null }, []);
  const r = await applyExtractedFacts(BIZ, "", {}, SERVICE, OWNER, "we said $180 for the driveway");
  const serviceWrites = writes.filter((w) => /service|catalog/i.test(w.rpc));
  say("1b a claimed business with NO services anywhere still publishes nothing",
    serviceWrites.length === 0 && r.proposedServices.length === 1,
    serviceWrites.length
      ? `PUBLISHED ${JSON.stringify(serviceWrites.map((w) => w.rpc))} to a live page`
      : "proposed, not published");
}

// ── 2. THE TWO-STORE GUARD. An empty `services` table is not an empty business. ─────────
//
// This is WHY the publish fired at all: the floor asked the `services` table, which held 0,
// while meta.service_catalog held 3 and is what the page renders. Proved on an UNCLAIMED draft
// so the claimed rule above cannot be what makes it pass.
{
  const writes = install({ id: BIZ, owner_id: null, meta: catalogWith(3) }, []);
  await applyExtractedFacts(BIZ, "draft-token", {}, SERVICE, null, "we said $180 for the driveway");
  const serviceWrites = writes.filter((w) => /service|catalog/i.test(w.rpc));
  say("4 a business whose services live only in meta.service_catalog is not treated as empty",
    serviceWrites.length === 0,
    serviceWrites.length ? `wrote ${JSON.stringify(serviceWrites.map((w) => w.rpc))} over a 3-service catalog` : "catalog counted");
}

// ── 3. THE INTAKE FLOW IS UNTOUCHED. A genuinely empty draft still captures prices. ─────
//
// The ruling is about publishing to a LIVE page. A draft mid-intake has no page a stranger can
// reach, and the owner is answering "what do you charge" — an answer, not an inference. If this
// leg goes red the fix has become a regression: the highest-value capture in the product.
{
  const writes = install({ id: BIZ, owner_id: null, meta: null }, []);
  const r = await applyExtractedFacts(BIZ, "draft-token", {}, SERVICE, null, "express wash $60, full detail $180");
  say("5 an empty unclaimed draft STILL captures priced services",
    writes.some((w) => /service|catalog/i.test(w.rpc)) && r.proposedServices.length === 0,
    `writes=${JSON.stringify(writes.map((w) => w.rpc))} proposed=${r.proposedServices.length}`);
}

// ── 4. THE OFFER IS AN ASK, AND IT IS WIRED AS ONE. ─────────────────────────────────────
{
  const idx = await Deno.readTextFile(new URL("../supabase/functions/hubly-conversation/index.ts", import.meta.url));
  say("6 the proposal is handed to the model as a question, never as a completed change",
    /proposeServices/.test(idx) && /NEVER say it was added, is on the page, or is live/.test(idx),
    "capability result forbids claiming the change");
  say("7 and it declares itself an ask, so the one-ask floor holds it",
    /proposedServiceOffer \? "services"/.test(idx),
    'askedFor:"services" set from the proposal');
  say("8 the write on a yes goes through setServices, an explicit decision",
    /If they say yes, call business\.setServices then/.test(idx), "yes -> setServices");
}

console.log(failed
  ? `\n${failed} assertion(s) failed.`
  : "\nA job writes a job. A price noticed on a live page is offered, never published.");
Deno.exit(failed ? 1 : 0);
