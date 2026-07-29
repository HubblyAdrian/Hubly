import type {
  CreateAttachment,
  CreateEngineListener,
  CreateMessage,
  CreateSession,
  WebsiteState,
} from '../types';
import { touchSession } from '../state/createSession';
import { loadSession, saveSession } from '../state/sessionStore';
import { createId } from '../utils/id';
import { streamCreateChat } from './openaiCreateClient';

/**
 * CreateEngine owns every piece of Hubly Create logic.
 * React components call the engine — they never contain Builder logic.
 */
export class CreateEngine {
  private session: CreateSession;
  private listeners = new Set<CreateEngineListener>();
  private abortController: AbortController | null = null;
  private streaming = false;

  constructor(session?: CreateSession) {
    this.session = session ?? loadSession();
  }

  static bootstrap(): CreateEngine {
    return new CreateEngine(loadSession());
  }

  getSession(): CreateSession {
    return this.session;
  }

  subscribe(listener: CreateEngineListener): () => void {
    this.listeners.add(listener);
    listener({ type: 'session', session: this.session });
    listener({ type: 'streaming', active: this.streaming });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: Parameters<CreateEngineListener>[0]): void {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('CreateEngine listener', err);
      }
    });
  }

  private commit(next: CreateSession): void {
    this.session = touchSession(next);
    saveSession(this.session);
    this.emit({ type: 'session', session: this.session });
  }

  /** Extension point for Prompt 2+ — nothing else owns WebsiteState. */
  updateWebsiteState(patch: Partial<WebsiteState>): void {
    this.commit({
      ...this.session,
      websiteState: {
        ...this.session.websiteState,
        ...patch,
        brand: { ...this.session.websiteState.brand, ...(patch.brand ?? {}) },
        theme: { ...this.session.websiteState.theme, ...(patch.theme ?? {}) },
        navigation: {
          ...this.session.websiteState.navigation,
          ...(patch.navigation ?? {}),
        },
        settings: {
          ...this.session.websiteState.settings,
          ...(patch.settings ?? {}),
        },
      },
    });
  }

  stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (!this.streaming) return;
    this.streaming = false;
    this.emit({ type: 'streaming', active: false });
    const last = this.session.conversation[this.session.conversation.length - 1];
    if (last && last.role === 'assistant' && last.status === 'streaming') {
      const stopped: CreateMessage = { ...last, status: 'stopped' };
      this.commit({
        ...this.session,
        conversation: [...this.session.conversation.slice(0, -1), stopped],
      });
      this.emit({ type: 'message', message: stopped });
    }
  }

  async sendMessage(text: string, attachments: CreateAttachment[] = []): Promise<void> {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    if (this.streaming) this.stopGeneration();

    const userMessage: CreateMessage = {
      id: createId('msg'),
      role: 'user',
      content: content || (attachments.length ? '(Attached files)' : ''),
      createdAt: new Date().toISOString(),
      status: 'complete',
      attachments: attachments.length ? attachments : undefined,
    };

    const assistantId = createId('msg');
    const assistantMessage: CreateMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };

    this.commit({
      ...this.session,
      conversation: [...this.session.conversation, userMessage, assistantMessage],
    });
    this.emit({ type: 'message', message: userMessage });
    this.emit({ type: 'message', message: assistantMessage });

    await this.streamAssistant(assistantId);
  }

  async regenerate(messageId: string): Promise<void> {
    const idx = this.session.conversation.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    const target = this.session.conversation[idx];
    if (!target || target.role !== 'assistant') return;

    // Truncate from this assistant message onward, keep prior history including user turn.
    const prior = this.session.conversation.slice(0, idx);
    const replacement: CreateMessage = {
      id: createId('msg'),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };
    this.commit({
      ...this.session,
      conversation: [...prior, replacement],
      lastResponseId: null,
    });
    this.emit({ type: 'message', message: replacement });
    await this.streamAssistant(replacement.id);
  }

  private async streamAssistant(assistantId: string): Promise<void> {
    this.streaming = true;
    this.emit({ type: 'streaming', active: true });
    this.abortController = new AbortController();

    const history = this.session.conversation
      .filter((m) => m.id !== assistantId && m.status !== 'error')
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    let assembled = '';
    let responseId: string | null = null;

    try {
      await streamCreateChat(
        {
          messages: history,
          previousResponseId: this.session.lastResponseId,
          sessionId: this.session.sessionId,
        },
        {
          signal: this.abortController.signal,
          onDelta: (delta) => {
            assembled += delta;
            this.patchAssistant(assistantId, {
              content: assembled,
              status: 'streaming',
            });
            this.emit({ type: 'delta', messageId: assistantId, content: assembled });
          },
          onResponseId: (id) => {
            responseId = id;
          },
          onError: (message) => {
            this.emit({ type: 'error', error: message });
          },
        },
      );

      this.patchAssistant(assistantId, {
        content: assembled || 'Something went wrong. Try again.',
        status: assembled ? 'complete' : 'error',
        responseId: responseId ?? undefined,
      });
      if (responseId) {
        this.commit({
          ...this.session,
          lastResponseId: responseId,
        });
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) {
        /* stopGeneration already finalized */
      } else {
        const message = err instanceof Error ? err.message : 'Request failed';
        this.patchAssistant(assistantId, {
          content: assembled || message,
          status: 'error',
        });
        this.emit({ type: 'error', error: message });
      }
    } finally {
      this.streaming = false;
      this.abortController = null;
      this.emit({ type: 'streaming', active: false });
    }
  }

  private patchAssistant(id: string, patch: Partial<CreateMessage>): void {
    const conversation = this.session.conversation.map((m) =>
      m.id === id ? { ...m, ...patch } : m,
    );
    this.commit({ ...this.session, conversation });
    const updated = conversation.find((m) => m.id === id);
    if (updated) this.emit({ type: 'message', message: updated });
  }
}

let singleton: CreateEngine | null = null;

export function getCreateEngine(): CreateEngine {
  if (!singleton) singleton = CreateEngine.bootstrap();
  return singleton;
}
