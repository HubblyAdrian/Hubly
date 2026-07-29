import type { CreateMessage } from '../types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: CreateMessage[];
  streaming: boolean;
  onRegenerate: (messageId: string) => void;
}

export function MessageList({ messages, streaming, onRegenerate }: MessageListProps) {
  const last = messages[messages.length - 1];
  const showTyping =
    streaming && last?.role === 'assistant' && last.status === 'streaming' && !last.content;

  return (
    <div className="hc-messages" role="log" aria-live="polite">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLastAssistant={
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            message.status !== 'streaming'
          }
          onRegenerate={onRegenerate}
        />
      ))}
      {showTyping ? <TypingIndicator /> : null}
    </div>
  );
}
