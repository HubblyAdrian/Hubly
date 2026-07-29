import type { StreamChatHandlers, StreamChatRequest } from '../types';

/**
 * Client OpenAI gateway for Hubly Create.
 * React never talks to OpenAI directly — only this service → /api/create-chat.
 */
export async function streamCreateChat(
  request: StreamChatRequest,
  handlers: StreamChatHandlers,
): Promise<void> {
  const res = await fetch('/api/create-chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: handlers.signal,
  });

  if (!res.ok) {
    let message = 'Hubly could not reach the AI service.';
    try {
      const data = (await res.json()) as { error?: string; message?: string; code?: string };
      message = data.message || data.error || message;
      if (data.code === 'not_configured') {
        message = 'Provider not configured — set OPENAI_API_KEY for Hubly Create.';
      }
    } catch {
      /* ignore */
    }
    handlers.onError?.(message);
    throw new Error(message);
  }

  if (!res.body) {
    const message = 'Streaming is not available in this environment.';
    handlers.onError?.(message);
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') {
        handlers.onDone?.();
        return;
      }
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response_id?: string;
          error?: string;
        };
        if (event.type === 'delta' && event.delta) {
          handlers.onDelta(event.delta);
        } else if (event.type === 'response_id' && event.response_id) {
          handlers.onResponseId?.(event.response_id);
        } else if (event.type === 'error') {
          handlers.onError?.(event.error || 'Stream error');
        } else if (event.type === 'done') {
          handlers.onDone?.();
          return;
        }
      } catch {
        /* skip malformed chunk */
      }
    }
  }

  handlers.onDone?.();
}
