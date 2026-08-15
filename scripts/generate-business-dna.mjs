#!/usr/bin/env node
/**
 * Business DNA — client blueprints → one server-side file the AI can actually read.
 *
 * `public/business-blueprints/*.json` are loaded by the browser (HublyBlueprints) and
 * have never reached a single OpenAI call — no server-side loader exists. That is why
 * the AI cannot tell a photographer from a detailer: the Business Type Engine was never
 * wired into the reasoning layer at all.
 *
 * This mirrors the pattern connected-apps already uses (hubly-core/connected-apps-catalog.json
 * → supabase/functions/_shared/connected_apps_catalog.json): one source of truth, one
 * generated server copy, and a conformance test that fails if they drift.
 *
 * Only the fields the AI can actually reason with are shipped — not gallery seed images,
 * layout ids, dashboard widgets or growth playbooks. ~13KB for all eight industries.
 *
 *   node scripts/generate-business-dna.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/business-blueprints');
const OUT = path.join(ROOT, 'supabase/functions/_shared/business_dna.json');

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.json'));
const dna = {};

for (const file of files) {
  const bp = JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  const id = bp.id || (bp.identity && bp.identity.slug) || file.replace(/\.json$/, '');
  const identity = bp.identity || {};
  const knowledge = bp.knowledge || {};
  dna[id] = {
    id,
    name: identity.name || id,
    slug: identity.slug || id,
    description: identity.description || '',
    // Synonyms let the resolver match a stored business_type that doesn't
    // exactly equal the blueprint id ("auto detailing" → detailing).
    synonyms: Array.isArray(identity.synonyms) ? identity.synonyms : [],
    brandVoice: knowledge.brandVoice || '',
    customerPsychology: knowledge.customerPsychology || '',
    buyingBehavior: knowledge.buyingBehavior || '',
    homepageGoals: knowledge.homepageGoals || [],
    trustSignals: knowledge.trustSignals || [],
    copyRules: knowledge.copyRules || [],
    decisionFactors: bp.decisionFactors || [],
    customerExpectations: bp.customerExpectations || [],
    homepagePriority: (bp.homepage && bp.homepage.priority) || [],
    // The capability flags are what decide whether this industry genuinely sells
    // products — i.e. whether the Product Store is even the right surface for it.
    capabilities: bp.capabilities || {},
    // Names only. Prices/durations belong to the business's real catalog, never
    // to the blueprint — the AI must not present a blueprint example as a real service.
    exampleServices: ((bp.services && bp.services.catalog) || [])
      .map((s) => s && s.name).filter(Boolean).slice(0, 8),
  };
}

const payload = {
  generated_from: 'public/business-blueprints/*.json',
  generator: 'scripts/generate-business-dna.mjs',
  blueprints: dna,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(
  `business_dna.json written · ${Object.keys(dna).length} industries · ` +
  `${(fs.statSync(OUT).size / 1024).toFixed(1)}KB`,
);
