#!/usr/bin/env node
/**
 * Live A/B: Chat Completions vs Responses for Hubly-shaped payloads.
 * Requires OPENAI_API_KEY. Updates docs/OPENAI_RESPONSES_BENCHMARK.md.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const apiKey = (process.env.OPENAI_API_KEY || '').trim();
const model = (process.env.OPENAI_MODEL || 'gpt-5.5').trim();
const runs = Math.max(1, Number(process.env.BENCHMARK_RUNS || 3));

if (!apiKey) {
  console.error('SKIP: OPENAI_API_KEY not set — structural checks still apply via check-openai-responses.mjs');
  console.error('Fill docs/OPENAI_RESPONSES_BENCHMARK.md after a staging run.');
  process.exit(0);
}

const system =
  'You are Hubly AI. Return ONLY valid JSON. Never invent customers.';
const user =
  'Given Business Memory {trade:"window cleaning",city:"Austin"} and DNA {tone:"premium"}, reply with JSON {"advice":string,"next_step":string}.';

const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function callChat() {
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${tinyPng}` } },
          ],
        },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  const data = await res.json().catch(() => ({}));
  const text = String(data?.choices?.[0]?.message?.content || '');
  return summarize('chat', res.ok, latencyMs, text, data?.usage);
}

async function callResponses() {
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 800,
      instructions: system,
      text: { format: { type: 'json_object' } },
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: user },
            { type: 'input_image', detail: 'auto', image_url: `data:image/png;base64,${tinyPng}` },
          ],
        },
      ],
    }),
  });
  const latencyMs = Date.now() - started;
  const data = await res.json().catch(() => ({}));
  let text = String(data?.output_text || '');
  if (!text && Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if ((part?.type === 'output_text' || part?.type === 'text') && part.text) text += part.text;
      }
    }
  }
  const usage = data?.usage
    ? {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.total_tokens,
      }
    : null;
  return summarize('responses', res.ok, latencyMs, text, usage);
}

function summarize(transport, okHttp, latencyMs, text, usage) {
  let jsonOk = false;
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      JSON.parse(text.slice(start, end + 1));
      jsonOk = true;
    }
  } catch {
    jsonOk = false;
  }
  return {
    transport,
    ok: !!okHttp && !!text.trim(),
    latencyMs,
    jsonOk,
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

function avg(rows, key) {
  const vals = rows.map((r) => r[key]).filter((n) => typeof n === 'number');
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function rate(rows, pred) {
  if (!rows.length) return null;
  return `${Math.round((100 * rows.filter(pred).length) / rows.length)}%`;
}

const chatRows = [];
const respRows = [];
for (let i = 0; i < runs; i++) {
  console.log(`run ${i + 1}/${runs} chat…`);
  chatRows.push(await callChat());
  console.log(`run ${i + 1}/${runs} responses…`);
  respRows.push(await callResponses());
}

function metrics(rows) {
  return {
    runs: rows.length,
    avgLatencyMs: avg(rows, 'latencyMs'),
    failureRate: rate(rows, (r) => !r.ok),
    jsonSuccess: rate(rows, (r) => r.jsonOk),
    avgInputTokens: avg(rows, 'inputTokens'),
    avgOutputTokens: avg(rows, 'outputTokens'),
    avgTotalTokens: avg(rows, 'totalTokens'),
  };
}

const chat = metrics(chatRows);
const resp = metrics(respRows);
console.log(JSON.stringify({ model, chat, responses: resp }, null, 2));

const md = `# OpenAI transport benchmark — Chat Completions vs Responses

Generated by \`scripts/benchmark-openai-transport.mjs\` on ${new Date().toISOString()}.

Model: \`${model}\` · Runs per transport: ${runs}

## Results (latest run)

| Metric | Chat Completions | Responses |
|---|---:|---:|
| Runs | ${chat.runs} | ${resp.runs} |
| Avg latency (ms) | ${chat.avgLatencyMs ?? '—'} | ${resp.avgLatencyMs ?? '—'} |
| Failure rate | ${chat.failureRate ?? '—'} | ${resp.failureRate ?? '—'} |
| JSON parse success | ${chat.jsonSuccess ?? '—'} | ${resp.jsonSuccess ?? '—'} |
| Avg input tokens | ${chat.avgInputTokens ?? '—'} | ${resp.avgInputTokens ?? '—'} |
| Avg output tokens | ${chat.avgOutputTokens ?? '—'} | ${resp.avgOutputTokens ?? '—'} |
| Avg total tokens | ${chat.avgTotalTokens ?? '—'} | ${resp.avgTotalTokens ?? '—'} |

## Rollback

\`OPENAI_TRANSPORT=chat\` reverts without product code changes.
`;

fs.writeFileSync(path.join(root, 'docs/OPENAI_RESPONSES_BENCHMARK.md'), md);
console.log('Wrote docs/OPENAI_RESPONSES_BENCHMARK.md');
