import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CreateMessage } from '../types';

interface MessageBubbleProps {
  message: CreateMessage;
  isLastAssistant: boolean;
  onRegenerate: (messageId: string) => void;
}

export function MessageBubble({ message, isLastAssistant, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <article className={`hc-msg ${isUser ? 'is-user' : 'is-assistant'}`}>
      {!isUser ? (
        <div className="hc-msg-avatar" aria-hidden="true">
          <span className="hc-wm-hub">h</span>
        </div>
      ) : null}
      <div className="hc-msg-body">
        <div className="hc-msg-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ' '}</ReactMarkdown>
          )}
        </div>
        {message.attachments?.length ? (
          <ul className="hc-msg-atts">
            {message.attachments.map((a) => (
              <li key={a.id}>{a.name}</li>
            ))}
          </ul>
        ) : null}
        {!isUser && message.status !== 'streaming' && message.content ? (
          <div className="hc-msg-actions">
            <button type="button" className="hc-icon-btn" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            {isLastAssistant ? (
              <button
                type="button"
                className="hc-icon-btn"
                onClick={() => onRegenerate(message.id)}
              >
                Regenerate
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
