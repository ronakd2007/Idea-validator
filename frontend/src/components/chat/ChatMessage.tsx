'use client';
import { useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import TypingIndicator from './TypingIndicator';

export interface ChatMessageData {
  id?: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  streaming?: boolean;
  error?: string;
}

// Combines the spec's AIMessage/UserMessage into one role-switched component
// — the two share nearly all layout, and a single component keeps the
// streaming/copy/regenerate logic in one place instead of duplicated.
export default function ChatMessage({
  message,
  isLastAssistant,
  onRegenerate,
  regenerating,
}: {
  message: ChatMessageData;
  isLastAssistant: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'USER';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can be unavailable — button simply stays a no-op
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end px-3 py-1.5">
        <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const showTyping = message.streaming && !message.content && !message.error;

  return (
    <div className="px-3 py-1.5">
      <div className="max-w-[92%] bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2 text-slate-800">
        {message.error ? (
          <p className="text-sm text-red-600 py-1">{message.error}</p>
        ) : showTyping ? (
          <TypingIndicator />
        ) : (
          <div>{renderMarkdown(message.content)}</div>
        )}
      </div>
      {!message.streaming && !message.error && message.content && (
        <div className="flex items-center gap-3 mt-1 ml-1">
          <button onClick={copy} className="text-[11px] text-slate-400 hover:text-slate-600 transition">
            {copied ? 'Copied' : 'Copy'}
          </button>
          {isLastAssistant && (
            <button onClick={onRegenerate} disabled={regenerating} className="text-[11px] text-slate-400 hover:text-slate-600 transition disabled:opacity-50">
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
