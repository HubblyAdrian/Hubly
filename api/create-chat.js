/**
 * Hubly Create — OpenAI Responses API streaming proxy.
 * Production-only: fails honestly when OPENAI_API_KEY is missing.
 * React never calls OpenAI directly.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const SYSTEM_INSTRUCTIONS = [
  'You are Hubly — an AI business builder and software engineer.',
  'You help people describe the business they want to build through conversation.',
  'Be warm, calm, concise, and expert. Sound like a senior product engineer, not a chatbot wizard.',
  'Ask clarifying questions when needed. Do not mention templates, themes, or blueprints.',
  'Do not claim you have already generated a live website or storefront unless the product has done so.',
  'In this foundation phase, focus on understanding their business, goals, customers, and offer.',
].join(' ');

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string') {
      try {
        resolve(JSON.parse(req.body || '{}'));
      } catch (e) {
        reject(e);
      }
      return;
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function writeEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({
      error: 'Provider not configured',
      code: 'not_configured',
      message: 'Provider not configured — set OPENAI_API_KEY for Hubly Create.',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const previousResponseId = body.previousResponseId
    ? String(body.previousResponseId)
    : null;
  const model =
    String(process.env.HUBLY_CREATE_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1').trim() ||
    'gpt-4.1';

  const input = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    }))
    .filter((m) => m.content.trim().length > 0);

  if (!input.length) {
    return res.status(400).json({ error: 'messages required' });
  }

  const payload = {
    model,
    instructions: SYSTEM_INSTRUCTIONS,
    input,
    stream: true,
    store: true,
  };
  if (previousResponseId) {
    payload.previous_response_id = previousResponseId;
  }

  let upstream;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return res.status(502).json({
      error: 'openai_unreachable',
      message: e instanceof Error ? e.message : 'OpenAI request failed',
    });
  }

  if (!upstream.ok || !upstream.body) {
    let detail = '';
    try {
      detail = await upstream.text();
    } catch (_) {
      /* ignore */
    }
    return res.status(upstream.status || 502).json({
      error: 'openai_error',
      message: detail.slice(0, 500) || 'OpenAI Responses API error',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let responseId = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          writeEvent(res, { type: 'done', response_id: responseId });
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        let event;
        try {
          event = JSON.parse(data);
        } catch (_) {
          continue;
        }
        const type = String(event.type || '');
        if (event.response && event.response.id) {
          responseId = event.response.id;
          writeEvent(res, { type: 'response_id', response_id: responseId });
        }
        if (type === 'response.created' && event.response && event.response.id) {
          responseId = event.response.id;
          writeEvent(res, { type: 'response_id', response_id: responseId });
        }
        if (
          type === 'response.output_text.delta' ||
          type === 'response.text.delta'
        ) {
          const delta = event.delta != null ? String(event.delta) : '';
          if (delta) writeEvent(res, { type: 'delta', delta });
        }
        if (type === 'response.completed' || type === 'response.done') {
          if (event.response && event.response.id) responseId = event.response.id;
          writeEvent(res, { type: 'done', response_id: responseId });
        }
        if (type === 'error' || type === 'response.failed') {
          writeEvent(res, {
            type: 'error',
            error:
              (event.error && (event.error.message || event.error)) ||
              'OpenAI stream failed',
          });
        }
      }
    }
    writeEvent(res, { type: 'done', response_id: responseId });
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (e) {
    writeEvent(res, {
      type: 'error',
      error: e instanceof Error ? e.message : 'Stream interrupted',
    });
    return res.end();
  }
};
