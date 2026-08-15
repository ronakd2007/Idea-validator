'use client';
import { useRef, useState, type KeyboardEvent } from 'react';

export default function ChatInput({
  onSend,
  onStop,
  sending,
  disabled,
  disabledReason,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  sending: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    onSend(text);
    setValue('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  if (disabled) {
    return (
      <div className="px-3 py-3 border-t border-slate-200 shrink-0">
        <p className="text-xs text-slate-400 text-center py-1.5">{disabledReason || 'The assistant is unavailable right now.'}</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-t border-slate-200 shrink-0">
      <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-blue-400 transition">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); autoResize(); }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask about your report…"
          className="flex-1 resize-none border-0 focus:outline-none text-sm py-1.5 max-h-[120px] placeholder:text-slate-400"
        />
        {sending ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            className="shrink-0 w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center hover:bg-slate-900 transition"
          >
            <span className="w-2.5 h-2.5 bg-white rounded-[2px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            title="Send (Enter)"
            className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↑
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-300 mt-1 px-1">Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
