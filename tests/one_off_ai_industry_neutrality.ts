/**
 * AI industry-neutrality + Business DNA regression proof.
 *
 * THE BUG THIS EXISTS FOR: a non-detailing business was given an automotive
 * storefront. The terminology did not come from the model — it came from Hubly's
 * own prompt text. The `storefront` capability's tool descriptions carried
 * detailing ×5, soap ×3, ceramic ×1, car wash ×1 and ZERO other industries,
 * while the model received no business name, no industry and no brand colour.
 * An exemplar monoculture with nothing to oppose it.
 *
 * These checks need no API key and no network, so they run in CI forever.
 *
 * Run: deno run --allow-env --allow-read --allow-net --no-check \
 *        tests/one_off_ai_industry_neutrality.ts
 */

import {
  HUBLY_CAPABILITY_REGISTRY,
  buildCapabilitiesPromptBlock,
} from "../supabase/functions/_shared/hubly_capability_registry.ts";
import {
  buildBusinessIdentityBlock,
  listBusinessDnaIds,
  resolveBusinessDna,
  tradeSellsProducts,
} from "../supabase/functions/_shared/hubly_business_dna.ts";

let passed = 0;
const failures: string[] = [];
const ck = (n: string, c: boolean, d?: unknown) => {
  if (c) { passed++; console.log("PASS · " + n); }
  else { failures.push(n); console.log("FAIL · " + n + (d !== undefined ? "  [" + JSON.stringify(d) + "]" : "")); }
};
const eq = (n: string, a: unknown, b: unknown) =>
  ck(n, JSON.stringify(a) === JSON.stringify(b), { actual: a, expected: b });

/* ══════════ 1. No capability may teach the model an industry ══════════ */
{
  // Every trade Hubly supports, plus the automotive vocabulary that actually leaked.
  const INDUSTRY_WORDS = [
    "detailing", "detailer", "ceramic coating", "car wash", "carnauba", "microfiber",
    "photography", "photographer", "lawn care", "landscaping", "pressure washing",
    "house cleaning", "window cleaning", "hvac", "salon", "barber", "bakery", "florist",
  ];
  for (const cap of HUBLY_CAPABILITY_REGISTRY) {
    const block = buildCapabilitiesPromptBlock([cap]);
    const found = new Map<string, number>();
    for (const w of INDUSTRY_WORDS) {
      const n = (block.match(new RegExp(w, "gi")) || []).length;
      if (n) found.set(w, n);
    }
    // A capability may legitimately illustrate with SEVERAL industries (that
    // teaches breadth). What it must never do is name only one — that is an
    // exemplar monoculture, and the model adopts it when nothing opposes it.
    const distinct = found.size;
    const total = [...found.values()].reduce((a, b) => a + b, 0);
    const monoculture = distinct === 1 && total >= 2;
    ck(
      `neutrality · "${cap.name}" is not an industry monoculture`,
      !monoculture,
      Object.fromEntries(found),
    );
  }

  // The specific regression, pinned by name.
  const sf = buildCapabilitiesPromptBlock(HUBLY_CAPABILITY_REGISTRY.filter((c) => c.name === "storefront"));
  for (const w of ["detailing", "ceramic coating", "car wash", "carnauba", "microfiber"]) {
    eq(`regression · storefront tools never say "${w}"`, (sf.match(new RegExp(w, "gi")) || []).length, 0);
  }
}

/* ══════════ 2. Business DNA actually reaches the reasoning layer ══════════ */
{
  const ids = listBusinessDnaIds();
  ck("dna · the server-side blueprint file loads", ids.length >= 8, ids);
  ck("dna · it covers the industries Hubly ships",
    ["detailing", "photography", "spa", "hvac"].every((i) => ids.includes(i)), ids);

  eq("dna · resolves an exact id", resolveBusinessDna("photography")?.id, "photography");
  eq("dna · resolves a synonym", resolveBusinessDna("auto detailing")?.id, "detailing");
  eq("dna · resolves loose casing/spacing", resolveBusinessDna("  Photography  ")?.id, "photography");

  // THE critical one: an unknown industry must NOT silently become detailing.
  // public/business-blueprints/registry.js getDefaultId() returns 'detailing' —
  // exactly the reflex that produced this bug. The server must never do that.
  eq("dna · an UNKNOWN industry resolves to null, never a default", resolveBusinessDna("taxidermy"), null);
  eq("dna · an empty industry resolves to null", resolveBusinessDna(""), null);
  eq("dna · null industry resolves to null", resolveBusinessDna(null), null);
}

/* ══════════ 3. Product Store vs Business Storefront, decided from DNA ══════════ */
{
  // Not "service business = no store". It is per-capability, from the blueprint.
  eq("ontology · a detailer does not sell products", tradeSellsProducts(resolveBusinessDna("detailing")), false);
  eq("ontology · a photographer DOES (prints)", tradeSellsProducts(resolveBusinessDna("photography")), true);
  eq("ontology · unknown industry is not assumed to sell products", tradeSellsProducts(null), false);
}

/* ══════════ 4. The identity block the model actually receives ══════════ */
{
  const photo = resolveBusinessDna("photography");
  const block = buildBusinessIdentityBlock(
    { name: "Willow & Vine Photography", businessType: "photography", accent: "#2E4A62" },
    photo,
    { productCount: 0 },
  );
  ck("identity · states the business name", block.includes("Willow & Vine Photography"));
  ck("identity · states the industry", /Industry:\s*Photography/i.test(block), block.slice(0, 200));
  ck("identity · carries the brand colour", block.includes("#2E4A62"));
  ck("identity · carries trade-specific guidance", /brand voice|customers decide|section priority/i.test(block));
  ck("identity · forbids importing other trades' language",
    /never import auto detailing, car-wash, or unrelated trade language/i.test(block));
  ck("identity · tells the model NOT to ask for what it already knows",
    /Never ask for any of it/i.test(block));
  ck("identity · says the catalog is empty rather than inventing one",
    /catalog: EMPTY/i.test(block), block);
  ck("identity · a photographer with no products is offered a first product, not an interview",
    /can genuinely sell products, but this one has none yet/i.test(block), block);

  // A detailer with no products must be steered OFF the product store.
  const det = buildBusinessIdentityBlock(
    { name: "Apex Auto Detailing", businessType: "detailing", accent: null },
    resolveBusinessDna("detailing"),
    { productCount: 0 },
  );
  ck("ontology · a detailer with no products is told the Store isn't their surface",
    /does not normally sell physical or digital products/i.test(det), det);
  ck("ontology · …and is pointed at their Website/Storefront",
    /Website\/Storefront/i.test(det), det);
  ck("ontology · …and is explicitly NOT interviewed",
    /Do NOT run a product-store interview/i.test(det), det);

  // Unknown industry: no guessing, and no adopting an example.
  const unknown = buildBusinessIdentityBlock({ name: "Someone", businessType: "taxidermy" }, null, {});
  ck("identity · unknown industry is stated as unknown", /Industry: NOT KNOWN/i.test(unknown), unknown);
  ck("identity · unknown industry forbids adopting an example industry",
    /do not adopt an industry from any example/i.test(unknown), unknown);
}

/* ══════════ 5. The storefront generation prompt is grounded ══════════ */
{
  // Rebuilt exactly as sfBuildStorefrontAst assembles it, to prove identity is
  // present in the real prompt rather than merely available to the function.
  const src = await Deno.readTextFile(
    new URL("../supabase/functions/_shared/hubly_capability_registry.ts", import.meta.url),
  );
  ck("prompt · storefront generation builds an identity block",
    /const identityBlock = buildBusinessIdentityBlock\(/.test(src));
  ck("prompt · the identity block is prepended to the catalog text",
    /const catalogText = `\$\{identityBlock\}/.test(src), "identityBlock not in catalogText");
  ck("prompt · businessType is threaded from both storefront actions",
    (src.match(/businessType: args\._businessType/g) || []).length === 2);
  ck("prompt · an owner's reference is demoted to style only",
    /Treat that as a stylistic preference only/.test(src));
  ck("prompt · the Product Store is distinguished from the Business Storefront",
    /This surface is the PRODUCT STORE/.test(src));

  const conv = await Deno.readTextFile(
    new URL("../supabase/functions/hubly-conversation/index.ts", import.meta.url),
  );
  ck("runtime · operate loads real business identity, not just owner_id",
    /select=owner_id,name,business_type,brand_color/.test(conv));
  ck("runtime · verified identity is injected into storefront dispatch",
    /dispatchArgs\._businessType = operateBusiness\.businessType/.test(conv));
  ck("runtime · the operate prompt receives the identity block",
    /buildBusinessIdentityBlock\(operate\.business, operate\.dna/.test(conv));
  ck("runtime · the Store prompt forbids the physical/digital/mix interview",
    /do you sell physical products, digital products, or a mix/i.test(conv), "guard sentence missing");
  ck("runtime · the Store prompt names both surfaces",
    /PRODUCT STORE/.test(conv) && /BUSINESS STOREFRONT/.test(conv));
}

/* ══════════ 6. Client blueprints and the server copy agree ══════════ */
{
  const dir = new URL("../public/business-blueprints/", import.meta.url);
  const clientIds: string[] = [];
  for await (const e of Deno.readDir(dir)) {
    if (e.isFile && e.name.endsWith(".json")) {
      const bp = JSON.parse(await Deno.readTextFile(new URL(e.name, dir)));
      clientIds.push(bp.id || bp.identity?.slug || e.name.replace(/\.json$/, ""));
    }
  }
  const serverIds = listBusinessDnaIds();
  eq("conformance · every client blueprint has a server copy",
    clientIds.filter((i) => !serverIds.includes(i)), []);
  eq("conformance · the server copy invents nothing",
    serverIds.filter((i) => !clientIds.includes(i)), []);
}

console.log(`\n==== AI INDUSTRY NEUTRALITY: ${passed} passed, ${failures.length} failed ====`);
if (failures.length) { failures.forEach((f) => console.log("  ✗ " + f)); Deno.exit(1); }
