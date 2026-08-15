'use client';
import type { PromptCategory } from '@/lib/chatPrompts';

export default function SuggestedPrompts({ categories, onPick, disabled }: { categories: PromptCategory[]; onPick: (prompt: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.label}>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{cat.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {cat.prompts.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onPick(p)}
                className="text-xs text-left bg-white border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
