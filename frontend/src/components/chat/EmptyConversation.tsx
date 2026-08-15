'use client';
import SuggestedPrompts from './SuggestedPrompts';
import type { PromptCategory } from '@/lib/chatPrompts';

export default function EmptyConversation({ categories, onPick, disabled }: { categories: PromptCategory[]; onPick: (prompt: string) => void; disabled?: boolean }) {
  return (
    <div className="px-4 py-5">
      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-base mb-3">✨</div>
      <p className="text-sm text-slate-700 leading-relaxed mb-1">I&apos;ve analyzed your validation report.</p>
      <p className="text-sm text-slate-500 leading-relaxed mb-4">Ask me about:</p>
      <ul className="text-xs text-slate-500 space-y-1 mb-5 list-disc pl-4">
        <li>Your validation score</li>
        <li>Customer feedback</li>
        <li>Survey insights</li>
        <li>Expert reviews</li>
        <li>Risks</li>
        <li>Next steps</li>
        <li>MVP recommendations</li>
      </ul>
      <SuggestedPrompts categories={categories} onPick={onPick} disabled={disabled} />
    </div>
  );
}
