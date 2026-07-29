import { useEffect, useRef, useState } from 'react';
import type { CreateAttachment, CreateMessage } from '../types';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';
import { SuggestionChips } from './SuggestionChips';

interface ChatPanelProps {
  messages: CreateMessage[];
  streaming: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onRegenerate: (messageId: string) => void;
  suggestions: string[];
  onSuggestion: (text: string) => void;
  attachments: CreateAttachment[];
  onRemoveAttachment: (id: string) => void;
  onPickFiles: () => void;
  onFilesDropped: (files: FileList | File[]) => void;
  error: string | null;
}

export function ChatPanel(props: ChatPanelProps) {
  const {
    messages,
    streaming,
    draft,
    onDraftChange,
    onSend,
    onStop,
    onRegenerate,
    suggestions,
    onSuggestion,
    attachments,
    onRemoveAttachment,
    onPickFiles,
    onFilesDropped,
    error,
  } = props;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  return (
    <div
      className={`hc-chat${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) onFilesDropped(e.dataTransfer.files);
      }}
    >
      <div className="hc-chat-scroll" ref={scrollerRef}>
        <MessageList
          messages={messages}
          streaming={streaming}
          onRegenerate={onRegenerate}
        />
      </div>

      {error ? <div className="hc-error" role="alert">{error}</div> : null}

      {suggestions.length > 0 ? (
        <SuggestionChips suggestions={suggestions} onSelect={onSuggestion} />
      ) : null}

      <ChatComposer
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        onStop={onStop}
        streaming={streaming}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        onPickFiles={onPickFiles}
      />
    </div>
  );
}
