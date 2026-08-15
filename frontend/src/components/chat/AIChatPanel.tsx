'use client';
import { useEffect, useRef, useState } from 'react';
import { api, streamChatMessage, type ChatReportKind } from '@/lib/api';
import { useToast, useConfirm } from '@/components/ui/feedback';
import { IDEA_PROMPT_CATEGORIES, SURVEY_PROMPT_CATEGORIES } from '@/lib/chatPrompts';
import AIChatHeader from './AIChatHeader';
import ChatMessage, { type ChatMessageData } from './ChatMessage';
import EmptyConversation from './EmptyConversation';
import ChatInput from './ChatInput';

const COLLAPSE_KEY = 'iv_ai_chat_collapsed';

interface AIChatPanelProps {
  targetType: 'idea' | 'survey';
  targetId: string;
  readOnly?: boolean;
}

// Right-side collapsible panel on desktop; a floating button opening a
// full-screen modal on phones/tablets. Both branches share one message state
// so switching viewport size never desyncs the conversation.
export default function AIChatPanel({ targetType, targetId, readOnly = false }: AIChatPanelProps) {
  const kind: ChatReportKind = targetType === 'idea' ? 'ideas' : 'surveys';
  const categories = targetType === 'idea' ? IDEA_PROMPT_CATEGORIES : SURVEY_PROMPT_CATEGORIES;
  const toast = useToast();
  const confirm = useConfirm();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === 'true');
  }, []);

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    if (typeof window !== 'undefined') localStorage.setItem(COLLAPSE_KEY, String(next));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetcher = kind === 'ideas' ? api.getIdeaChat : api.getSurveyChat;
    fetcher(targetId)
      .then((res: any) => {
        if (cancelled) return;
        setMessages((res.messages || []).map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, targetId]);

  const autoScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    // Only follow new content if the reader was already near the bottom —
    // scrolling up to re-read earlier answers should not get yanked back down.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      el.scrollTop = el.scrollHeight;
    }
  };

  const scrollBothSoon = () => {
    requestAnimationFrame(() => {
      autoScroll(desktopScrollRef);
      autoScroll(mobileScrollRef);
    });
  };

  const runStream = (
    body: { content: string } | { regenerate: true },
    onFinishedSetter: (v: boolean) => void
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    onFinishedSetter(true);

    streamChatMessage(
      kind,
      targetId,
      body,
      {
        onDelta: (text) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'ASSISTANT') next[next.length - 1] = { ...last, content: last.content + text };
            return next;
          });
          scrollBothSoon();
        },
        onDone: (messageId) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'ASSISTANT') next[next.length - 1] = { ...last, streaming: false, id: messageId || undefined };
            return next;
          });
        },
        onError: (message) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'ASSISTANT') next[next.length - 1] = { ...last, streaming: false, error: message };
            return next;
          });
        },
      },
      controller.signal
    ).finally(() => {
      onFinishedSetter(false);
      abortRef.current = null;
    });
  };

  const send = (text: string) => {
    if (sending || regenerating || readOnly) return;
    setMessages((prev) => [...prev, { role: 'USER', content: text }, { role: 'ASSISTANT', content: '', streaming: true }]);
    scrollBothSoon();
    runStream({ content: text }, setSending);
  };

  const regenerate = () => {
    if (sending || regenerating || readOnly) return;
    setMessages((prev) => {
      const next = [...prev];
      if (next[next.length - 1]?.role === 'ASSISTANT') next.pop();
      return [...next, { role: 'ASSISTANT', content: '', streaming: true }];
    });
    scrollBothSoon();
    runStream({ regenerate: true }, setRegenerating);
  };

  const stop = () => abortRef.current?.abort();

  const startNewChat = async () => {
    const ok = await confirm({
      title: 'Start a new chat?',
      body: 'This clears the current conversation. It cannot be undone.',
      confirmLabel: 'Start New Chat',
    });
    if (!ok) return;
    try {
      await (kind === 'ideas' ? api.newIdeaChat(targetId) : api.newSurveyChat(targetId));
      setMessages([]);
    } catch (err: any) {
      toast.error(err.message || 'Could not start a new chat.');
    }
  };

  const deleteChat = async () => {
    const ok = await confirm({
      title: 'Delete this conversation?',
      body: 'The entire chat history for this report is permanently deleted.',
      confirmLabel: 'Delete Conversation',
      danger: true,
    });
    if (!ok) return;
    try {
      await (kind === 'ideas' ? api.deleteIdeaChat(targetId) : api.deleteSurveyChat(targetId));
      setMessages([]);
      toast.success('Conversation deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Could not delete the conversation.');
    }
  };

  const busy = sending || regenerating;

  const body = (scrollRef: React.RefObject<HTMLDivElement | null>) => (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="px-4 py-5 space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : messages.length === 0 ? (
          <EmptyConversation categories={categories} onPick={send} disabled={readOnly} />
        ) : (
          <div className="py-2">
            {messages.map((m, i) => (
              <ChatMessage
                key={m.id ?? i}
                message={m}
                isLastAssistant={!busy && m.role === 'ASSISTANT' && i === messages.length - 1}
                onRegenerate={regenerate}
                regenerating={regenerating}
              />
            ))}
          </div>
        )}
      </div>
      <ChatInput
        onSend={send}
        onStop={stop}
        sending={sending}
        disabled={readOnly}
        disabledReason="Chatting is disabled while viewing as another user."
      />
    </>
  );

  return (
    <>
      {/* Desktop: sticky right-side panel, collapses to a slim strip */}
      <div
        className={`hidden lg:flex lg:flex-col shrink-0 border-l border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen viewas-sidebar-offset transition-[width] duration-150 ${
          collapsed ? 'w-12' : 'w-[340px]'
        }`}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => toggleCollapsed(false)}
            title="Open AI Validation Assistant"
            className="flex-1 flex flex-col items-center justify-start pt-4 gap-2 text-slate-400 hover:text-blue-600 transition"
          >
            <span className="text-lg">✨</span>
            <span className="text-[10px] font-medium [writing-mode:vertical-rl]">AI Assistant</span>
          </button>
        ) : (
          <>
            <AIChatHeader onCollapse={() => toggleCollapsed(true)} onNewChat={startNewChat} onDelete={deleteChat} readOnly={readOnly} hasMessages={messages.length > 0} />
            {body(desktopScrollRef)}
          </>
        )}
      </div>

      {/* Mobile/tablet: floating trigger + full-screen modal */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-5 right-4 z-40 flex items-center gap-2 bg-blue-600 text-white pl-3.5 pr-4 py-3 rounded-full shadow-lg shadow-blue-600/30 text-sm font-semibold"
      >
        <span>✨</span> Ask AI
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[90] bg-white flex flex-col viewas-sticky-offset">
          <AIChatHeader onNewChat={startNewChat} onDelete={deleteChat} onClose={() => setMobileOpen(false)} readOnly={readOnly} hasMessages={messages.length > 0} />
          {body(mobileScrollRef)}
        </div>
      )}
    </>
  );
}
