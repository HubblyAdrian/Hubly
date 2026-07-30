import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateAttachment, CreateMessage, CreateSession } from '../types';
import { getCreateEngine } from '../services/createEngine';
import { ChatPanel } from '../components/ChatPanel';
import { WebsiteCanvas } from '../components/WebsiteCanvas';
import { createId } from '../utils/id';

const SUGGESTIONS = [
  'Build a storefront',
  'Build a booking website',
  'Build a service business',
  'Sell products online',
  'Upload inspiration',
  'Import my website',
] as const;

export function CreatePage() {
  const engine = useMemo(() => getCreateEngine(), []);
  const [session, setSession] = useState<CreateSession>(() => engine.getSession());
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<CreateAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return engine.subscribe((event) => {
      if (event.type === 'session') setSession(event.session);
      if (event.type === 'streaming') setStreaming(event.active);
      if (event.type === 'error') setError(event.error);
    });
  }, [engine]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = (params.get('q') || '').trim();
      if (!q) return;
      const hasUser = engine.getSession().conversation.some((m) => m.role === 'user');
      if (!hasUser) setDraft(q);
    } catch {
      /* ignore */
    }
  }, [engine]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    setError(null);
    setDraft('');
    const pending = attachments;
    setAttachments([]);
    await engine.sendMessage(text, pending);
  }, [attachments, draft, engine]);

  const onStop = useCallback(() => {
    engine.stopGeneration();
  }, [engine]);

  const onRegenerate = useCallback(
    (messageId: string) => {
      setError(null);
      void engine.regenerate(messageId);
    },
    [engine],
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const next: CreateAttachment[] = list.map((file) => ({
      id: createId('att'),
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...next].slice(0, 8));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const showSuggestions = useMemo(() => {
    const msgs = session.conversation.filter((m: CreateMessage) => m.role === 'user');
    return msgs.length === 0 && !streaming;
  }, [session.conversation, streaming]);

  return (
    <div className="hc-shell">
      <header className="hc-top">
        <a className="hc-brand" href="/create" aria-label="Hubly Create">
          <span className="hc-wm-hub">hub</span>
          <span className="hc-wm-ly">ly</span>
        </a>
        <span className="hc-top-label">Create</span>
      </header>

      <main className="hc-main">
        <section className="hc-chat-col" aria-label="Conversation">
          <ChatPanel
            messages={session.conversation}
            streaming={streaming}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => void onSend()}
            onStop={onStop}
            onRegenerate={onRegenerate}
            suggestions={showSuggestions ? [...SUGGESTIONS] : []}
            onSuggestion={(s) => {
              setError(null);
              void engine.sendMessage(s);
            }}
            attachments={attachments}
            onRemoveAttachment={removeAttachment}
            onPickFiles={() => fileInputRef.current?.click()}
            onFilesDropped={addFiles}
            error={error}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hc-hidden-file"
            accept="image/*,.pdf,.txt,.md,.doc,.docx"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </section>

        <section className="hc-canvas-col" aria-label="Website canvas">
          <WebsiteCanvas websiteState={session.websiteState} />
        </section>
      </main>
    </div>
  );
}
