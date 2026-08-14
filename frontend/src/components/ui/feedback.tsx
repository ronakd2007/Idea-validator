'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// One feedback layer for the whole app: toast notifications for outcomes and
// a promise-based confirm dialog for destructive actions — replacing
// window.confirm/alert so feedback looks and behaves consistently everywhere.

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // For irreversible bulk-destructive actions: the confirm button stays
  // disabled until the user types this exact word (e.g. "DELETE").
  typeToConfirm?: string;
}

interface FeedbackApi {
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void };
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useToast() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast must be used inside <FeedbackProvider>');
  return ctx.toast;
}

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useConfirm must be used inside <FeedbackProvider>');
  return ctx.confirm;
}

const TOAST_STYLE: Record<ToastKind, { box: string; icon: string }> = {
  success: { box: 'bg-emerald-600 text-white', icon: '✓' },
  error: { box: 'bg-red-600 text-white', icon: '✕' },
  info: { box: 'bg-slate-800 text-white', icon: 'ℹ' },
};

export default function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setTyped('');
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
    setTyped('');
  };

  const typeGateOpen = !confirmState?.typeToConfirm || typed === confirmState.typeToConfirm;

  // Esc cancels the dialog — same contract as window.confirm.
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState]);

  const api: FeedbackApi = {
    toast: {
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    },
    confirm,
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {/* Toast stack — bottom-center on phones, bottom-right on desktop. */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-[70] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
          {toasts.map((t) => {
            const s = TOAST_STYLE[t.kind];
            return (
              <button
                key={t.id}
                onClick={() => dismiss(t.id)}
                className={`pointer-events-auto flex items-start gap-2.5 max-w-md text-left rounded-lg shadow-lg px-4 py-3 text-sm font-medium ${s.box}`}
              >
                <span aria-hidden className="mt-px">{s.icon}</span>
                <span>{t.message}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 flex items-center justify-center px-4" onClick={() => settle(false)} role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">{confirmState.title}</h3>
            {confirmState.body && <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-line">{confirmState.body}</p>}
            {confirmState.typeToConfirm && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Type <span className="font-bold text-red-600">{confirmState.typeToConfirm}</span> to confirm
                </label>
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => settle(false)}
                className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition"
              >
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => typeGateOpen && settle(true)}
                disabled={!typeGateOpen}
                autoFocus={!confirmState.typeToConfirm}
                className={`text-sm px-4 py-2 rounded-lg font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  confirmState.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmState.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
