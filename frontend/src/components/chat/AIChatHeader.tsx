'use client';

export default function AIChatHeader({
  onCollapse,
  onNewChat,
  onDelete,
  onClose,
  readOnly,
  hasMessages,
}: {
  onCollapse?: () => void;
  onNewChat: () => void;
  onDelete: () => void;
  onClose?: () => void;
  readOnly: boolean;
  hasMessages: boolean;
}) {
  return (
    <div className="px-4 py-3.5 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <span className="text-blue-600">✨</span> AI Validation Assistant
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug">I&apos;ve already analyzed your report. Ask me anything.</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!readOnly && hasMessages && (
          <button
            type="button"
            onClick={onNewChat}
            title="Start a new chat"
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition text-sm"
          >
            +
          </button>
        )}
        {!readOnly && hasMessages && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete conversation"
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition text-sm"
          >
            🗑
          </button>
        )}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse"
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition text-sm"
          >
            »
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition text-sm"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
