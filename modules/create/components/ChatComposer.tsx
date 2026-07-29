import { useRef } from 'react';
import type { CreateAttachment } from '../types';

interface ChatComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  attachments: CreateAttachment[];
  onRemoveAttachment: (id: string) => void;
  onPickFiles: () => void;
}

export function ChatComposer(props: ChatComposerProps) {
  const {
    draft,
    onDraftChange,
    onSend,
    onStop,
    streaming,
    attachments,
    onRemoveAttachment,
    onPickFiles,
  } = props;
  const taRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="hc-composer">
      {attachments.length > 0 ? (
        <ul className="hc-composer-atts">
          {attachments.map((a) => (
            <li key={a.id}>
              <span>{a.name}</span>
              <button type="button" onClick={() => onRemoveAttachment(a.id)} aria-label="Remove">
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="hc-composer-row">
        <button
          type="button"
          className="hc-attach"
          onClick={onPickFiles}
          aria-label="Upload file"
          title="Upload"
        >
          +
        </button>
        <textarea
          ref={taRef}
          className="hc-input"
          rows={1}
          placeholder="Message Hubly…"
          value={draft}
          onChange={(e) => {
            onDraftChange(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!streaming) onSend();
            }
          }}
        />
        {streaming ? (
          <button type="button" className="hc-send is-stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="hc-send"
            onClick={onSend}
            disabled={!draft.trim() && attachments.length === 0}
          >
            Send
          </button>
        )}
      </div>
      <p className="hc-composer-hint">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
