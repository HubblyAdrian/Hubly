#!/usr/bin/env node
/**
 * Live A/B: Chat Completions vs Responses for every HublyAI capability shape.
 * Requires OPENAI_API_KEY. Updates docs/OPENAI_RESPONSES_BENCHMARK.md.
 *
 * Merge gate for PR #184: Responses must match or beat Chat on success,
 * JSON reliability, vision correctness, and not regress latency badly.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const apiKey = (process.env.OPENAI_API_KEY || '').trim();
const model = (process.env.OPENAI_MODEL || 'gpt-5.5').trim();
const runs = Math.max(1, Number(process.env.BENCHMARK_RUNS || 2));
const outDir = path.join(root, 'docs');
const outMd = path.join(outDir, 'OPENAI_RESPONSES_BENCHMARK.md');
const outJson = path.join(outDir, 'OPENAI_RESPONSES_BENCHMARK.json');

const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Capability fixtures — same Memory/DNA/prompt for both transports. */
const CAPABILITIES = [
  {
    id: 'business_build',
    label: 'Business Build',
    json: true,
    vision: false,
    system:
      'You are Hubly Website Runtime. BUSINESS MEMORY (facts): trade=window cleaning, city=Austin, name=ClearView Pros. BUSINESS DNA (identity): tone=premium, calm. Never invent customers. Return ONLY valid JSON.',
    user:
      'Produce JSON {"hero_headline":string,"hero_sub":string,"about":string} for this business.',
    maxTokens: 1200,
  },
  {
    id: 'website_runtime',
    label: 'Website Runtime',
    json: true,
    vision: false,
    system:
      'You are Hubly generateWebsite. Memory: services=[Interior,Exterior], city=Austin. DNA: voice=trustworthy. Return ONLY valid JSON.',
    user:
      'JSON {"seo_title":string,"seo_description":string,"faq":[{"q":string,"a":string}]} with exactly 2 FAQ items.',
    maxTokens: 1400,
  },
  {
    id: 'creative_director',
    label: 'Creative Director',
    json: true,
    vision: true,
    system:
      'You are Hubly Creative Director. Memory: biz=ClearView Pros. DNA: mood=dusk. Return ONLY valid JSON. Never copy another brand from the image.',
    user:
      'Owner said: make the first screen feel warmer. Inspiration image attached. JSON {"reply":string,"apply":{"accent":string},"advance":boolean}.',
    maxTokens: 900,
  },
  {
    id: 'storefront_chat',
    label: 'Storefront Chat',
    json: false,
    vision: false,
    system:
      'You are the storefront concierge for ClearView Pros (window cleaning, Austin). Memory: open Mon-Fri 8-5. DNA: friendly, short. Do not invent prices.',
    user: 'Customer: How soon can you come out this week?',
    maxTokens: 500,
  },
  {
    id: 'photo_analysis',
    label: 'Photo Analysis',
    json: true,
    vision: true,
    system:
      'You are Hubly photoAnalysis. Return ONLY valid JSON describing the attached photo for a service business gallery.',
    user:
      'JSON {"photos":[{"index":0,"suitable_for_gallery":boolean,"notes":string}],"hero_recommendation_index":0}',
    maxTokens: 700,
  },
  {
    id: 'import_offers',
    label: 'Import Offers',
    json: true,
    vision: false,
    system:
      'You are Hubly import-offers. Extract packages from the price list. Return ONLY valid JSON.',
    user:
      'Price list text: Interior $149 · Exterior $199 · Full house $299. JSON {"packages":[{"name":string,"price":number}]}',
    maxTokens: 700,
  },
  {
    id: 'draft_customer_message',
    label: 'Draft Customer Message',
    json: false,
    vision: false,
    system:
      'You are Hubly customerSupport. Memory: customer=Sam, job=Exterior clean on Tuesday. DNA: warm, concise. Write the email body only.',
    user: 'Draft a short thank-you + soft review ask after job completion.',
    maxTokens: 500,
  },
  {
    id: 'ask_ai',
    label: 'Ask AI',
    json: false,
    vision: false,
    system:
      'You are Hubly Business Coach. OPS: health.overall=72, unpaid=2, leads=3. Memory: trade=window cleaning. DNA: premium. Advise from facts only.',
    user: 'What should I do today to get more paid jobs?',
    maxTokens: 700,
  },
];

if (!apiKey) {
  const stub = `# OpenAI transport benchmark — Chat Completions vs Responses

**Release Candidate gate for PR #184 — DO NOT MERGE until this file has live numbers.**

Generated stub: \`${new Date().toISOString()}\` (no \`OPENAI_API_KEY\` in this environment).

## How to run

\`\`\`bash
OPENAI_API_KEY=sk-… BENCHMARK_RUNS=2 node scripts/benchmark-openai-transport.mjs
\`\`\`

Compares Chat vs Responses for: Business Build, Website Runtime, Creative Director (+vision), Storefront Chat, Photo Analysis (+vision), Import Offers, Draft Customer Message, Ask AI.

## Merge criteria

Merge **only if** Responses is equal or better on:

1. Success rate (≥ Chat)
2. JSON reliability for JSON tasks (≥ Chat)
3. Vision tasks return usable structured/text output (≥ Chat)
4. Average latency not catastrophically worse (document if >1.5× Chat)
5. Side-by-side outputs look consistent (no empty / truncated / off-contract replies)

## Results

_Awaiting live staging run._

## Rollback

\`OPENAI_TRANSPORT=chat\`
`;
  fs.writeFileSync(outMd, stub);
  console.error('SKIP: OPENAI_API_KEY not set — wrote RC merge-gate stub to docs/OPENAI_RESPONSES_BENCHMARK.md');
  process.exit(0);
}

function userContentChat(cap) {
  if (!cap.vision) return cap.user;
  return [
    { type: 'text', text: cap.user },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${tinyPng}` } },
  ];
}

function userContentResponses(cap) {
  if (!cap.vision) return cap.user;
  return [
    { type: 'input_text', text: cap.user },
    { type: 'input_image', detail: 'auto', image_url: `data:image/png;base64,${tinyPng}` },
  ];
}

function parseJsonLoose(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function extractResponsesText(data) {
  let text = String(data?.output_text || '');
  if (text.trim()) return text.trim();
  const chunks = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if ((part?.type === 'output_text' || part?.type === 'text') && part.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

async function callChat(cap) {
  const started = Date.now();
  const body = {
    model,
    max_tokens: cap.maxTokens,
    messages: [
      { role: 'system', content: cap.system },
      { role: 'user', content: userContentChat(cap) },
    ],
  };
  if (cap.json) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - started;
  const data = await res.json().catch(() => ({}));
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return score(cap, 'chat', res.ok, latencyMs, text, data?.usage, data?.error);
}

async function callResponses(cap) {
  const started = Date.now();
  const body = {
    model,
    store: false,
    max_output_tokens: cap.maxTokens,
    instructions: cap.system,
    input: [{ role: 'user', content: userContentResponses(cap) }],
  };
  if (cap.json) body.text = { format: { type: 'json_object' } };
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - started;
  const data = await res.json().catch(() => ({}));
  const text = extractResponsesText(data);
  const usage = data?.usage
    ? {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.total_tokens,
      }
    : null;
  return score(cap, 'responses', res.ok, latencyMs, text, usage, data?.error);
}

function score(cap, transport, okHttp, latencyMs, text, usage, err) {
  const json = parseJsonLoose(text);
  const jsonOk = cap.json ? !!json : null;
  const visionOk = cap.vision ? !!(text && text.length > 8) : null;
  const success = !!okHttp && !!text && (!cap.json || !!json);
  return {
    capability: cap.id,
    label: cap.label,
    transport,
    success,
    latencyMs,
    jsonOk,
    visionOk,
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    outputPreview: text.slice(0, 500),
    error: err ? String(err.message || JSON.stringify(err)).slice(0, 200) : null,
  };
}

function avg(rows, key) {
  const vals = rows.map((r) => r[key]).filter((n) => typeof n === 'number');
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function rate(rows, pred) {
  if (!rows.length) return '—';
  return `${Math.round((100 * rows.filter(pred).length) / rows.length)}%`;
}

const all = [];
for (const cap of CAPABILITIES) {
  for (let i = 0; i < runs; i++) {
    console.log(`${cap.id} chat ${i + 1}/${runs}`);
    all.push(await callChat(cap));
    console.log(`${cap.id} responses ${i + 1}/${runs}`);
    all.push(await callResponses(cap));
  }
}

const chatAll = all.filter((r) => r.transport === 'chat');
const respAll = all.filter((r) => r.transport === 'responses');

function rollup(rows) {
  return {
    n: rows.length,
    success: rate(rows, (r) => r.success),
    avgLatencyMs: avg(rows, 'latencyMs'),
    jsonSuccess: rate(rows.filter((r) => r.jsonOk !== null), (r) => r.jsonOk),
    visionSuccess: rate(rows.filter((r) => r.visionOk !== null), (r) => r.visionOk),
    avgInputTokens: avg(rows, 'inputTokens'),
    avgOutputTokens: avg(rows, 'outputTokens'),
    avgTotalTokens: avg(rows, 'totalTokens'),
  };
}

const summary = { model, runs, generatedAt: new Date().toISOString(), chat: rollup(chatAll), responses: rollup(respAll) };

const byCap = CAPABILITIES.map((cap) => {
  const c = chatAll.filter((r) => r.capability === cap.id);
  const r = respAll.filter((r) => r.capability === cap.id);
  return {
    id: cap.id,
    label: cap.label,
    json: cap.json,
    vision: cap.vision,
    chat: rollup(c),
    responses: rollup(r),
    sideBySide: {
      chatPreview: c[0]?.outputPreview || '',
      responsesPreview: r[0]?.outputPreview || '',
    },
  };
});

const chatSuccess = chatAll.filter((r) => r.success).length / Math.max(1, chatAll.length);
const respSuccess = respAll.filter((r) => r.success).length / Math.max(1, respAll.length);
const chatJson = chatAll.filter((r) => r.jsonOk === true).length;
const respJson = respAll.filter((r) => r.jsonOk === true).length;
const jsonDenom = chatAll.filter((r) => r.jsonOk !== null).length;
const mergeOk =
  respSuccess + 1e-9 >= chatSuccess &&
  (jsonDenom === 0 || respJson >= chatJson);

const md = `# OpenAI transport benchmark — Chat Completions vs Responses

Generated: \`${summary.generatedAt}\`  
Model: \`${model}\` · Runs per capability/transport: ${runs}

## Merge gate (PR #184)

| Criterion | Chat | Responses | Pass? |
|---|---:|---:|:---:|
| Success rate | ${summary.chat.success} | ${summary.responses.success} | ${respSuccess >= chatSuccess ? '✅' : '❌'} |
| JSON reliability | ${summary.chat.jsonSuccess} | ${summary.responses.jsonSuccess} | ${respJson >= chatJson ? '✅' : '❌'} |
| Vision usable output | ${summary.chat.visionSuccess} | ${summary.responses.visionSuccess} | ✅ review |
| Avg latency (ms) | ${summary.chat.avgLatencyMs ?? '—'} | ${summary.responses.avgLatencyMs ?? '—'} | document |
| Avg total tokens | ${summary.chat.avgTotalTokens ?? '—'} | ${summary.responses.avgTotalTokens ?? '—'} | document |

**Merge recommendation:** ${mergeOk ? '✅ Responses ≥ Chat on success/JSON — eligible to merge after human review of side-by-sides.' : '❌ Do not merge — Responses lagged Chat on success and/or JSON.'}

## Overall

| Metric | Chat Completions | Responses |
|---|---:|---:|
| Runs | ${summary.chat.n} | ${summary.responses.n} |
| Success rate | ${summary.chat.success} | ${summary.responses.success} |
| Avg latency (ms) | ${summary.chat.avgLatencyMs ?? '—'} | ${summary.responses.avgLatencyMs ?? '—'} |
| JSON parse success | ${summary.chat.jsonSuccess} | ${summary.responses.jsonSuccess} |
| Vision success | ${summary.chat.visionSuccess} | ${summary.responses.visionSuccess} |
| Avg input tokens | ${summary.chat.avgInputTokens ?? '—'} | ${summary.responses.avgInputTokens ?? '—'} |
| Avg output tokens | ${summary.chat.avgOutputTokens ?? '—'} | ${summary.responses.avgOutputTokens ?? '—'} |
| Avg total tokens | ${summary.chat.avgTotalTokens ?? '—'} | ${summary.responses.avgTotalTokens ?? '—'} |

## Per capability

${byCap
  .map(
    (c) => `### ${c.label} (\`${c.id}\`)

| Metric | Chat | Responses |
|---|---:|---:|
| Success | ${c.chat.success} | ${c.responses.success} |
| Latency ms | ${c.chat.avgLatencyMs ?? '—'} | ${c.responses.avgLatencyMs ?? '—'} |
| JSON | ${c.chat.jsonSuccess} | ${c.responses.jsonSuccess} |
| Vision | ${c.chat.visionSuccess} | ${c.responses.visionSuccess} |
| Tokens | ${c.chat.avgTotalTokens ?? '—'} | ${c.responses.avgTotalTokens ?? '—'} |

**Chat preview**

\`\`\`
${c.sideBySide.chatPreview || '(empty)'}
\`\`\`

**Responses preview**

\`\`\`
${c.sideBySide.responsesPreview || '(empty)'}
\`\`\`
`,
  )
  .join('\n')}

## Rollback

\`OPENAI_TRANSPORT=chat\`
`;

fs.writeFileSync(outMd, md);
fs.writeFileSync(outJson, JSON.stringify({ summary, byCap, raw: all }, null, 2));
console.log(JSON.stringify({ summary, mergeOk }, null, 2));
console.log('Wrote', outMd);
process.exit(mergeOk ? 0 : 2);
