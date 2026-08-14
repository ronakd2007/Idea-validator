export type QuestionType =
  | 'SHORT_ANSWER'
  | 'PARAGRAPH'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOXES'
  | 'DROPDOWN'
  | 'YES_NO'
  | 'RATING'
  | 'LINEAR_SCALE'
  | 'IMAGE_CHOICE';

export interface QuestionOptionDraft {
  id: string;
  label: string;
  imageUrl?: string | null;
}

export interface IncentiveDraft {
  title: string;
  description: string;
  numberOfWinners: number;
  eligibility: string;
  closingDate: string | null; // yyyy-mm-dd for <input type="date">
  collectContact: boolean;
}

export interface SurveyVersion {
  id: string;
  versionNumber: number;
  status: string;
  createdAt: string;
  publicId: string | null;
  responseCount: number;
}

export interface RatingSettings {
  max: number;
}

export interface LinearScaleSettings {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}

export interface QuestionDraft {
  id: string;
  type: QuestionType;
  questionText: string;
  description: string;
  required: boolean;
  options: QuestionOptionDraft[];
  settings: Partial<RatingSettings & LinearScaleSettings>;
  // Phase 3 — analytics-only, never rendered as a label to respondents.
  isControlQuestion?: boolean;
  consistencyPairQuestionId?: string | null;
  abGroupKey?: string | null;
  abVariant?: 'A' | 'B' | null;
  // Phase 4 — optional media stimulus shown above the question.
  mediaUrl?: string | null;
  mediaType?: 'IMAGE' | 'VIDEO' | null;
}

export interface SurveyDraft {
  id: string;
  ideaId: string | null;
  ideaTitle?: string;
  title: string;
  description: string;
  status: string;
  publicId?: string | null;
  responseLimit?: number | null;
  collectEmail: boolean;
  focusMode: boolean;
  questions: QuestionDraft[];
  rootSurveyId?: string | null;
  versionNumber: number;
  incentive: IncentiveDraft | null;
}

// The shape returned by the public (unauthenticated) survey endpoint — deliberately
// narrower than SurveyDraft, since it must never carry founderId/ideaId/internal survey id.
export interface PublicSurvey {
  title: string;
  description: string;
  status: string;
  collectEmail: boolean;
  focusMode: boolean;
  limitReached: boolean;
  questions: QuestionDraft[];
  incentive: (IncentiveDraft & { collectContact: boolean }) | null;
}

export const QUESTION_TYPES: { value: QuestionType; label: string; hasOptions: boolean }[] = [
  { value: 'SHORT_ANSWER', label: 'Short Answer', hasOptions: false },
  { value: 'PARAGRAPH', label: 'Paragraph', hasOptions: false },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice', hasOptions: true },
  { value: 'CHECKBOXES', label: 'Checkboxes', hasOptions: true },
  { value: 'DROPDOWN', label: 'Dropdown', hasOptions: true },
  { value: 'YES_NO', label: 'Yes / No', hasOptions: false },
  { value: 'RATING', label: 'Rating', hasOptions: false },
  { value: 'LINEAR_SCALE', label: 'Linear Scale', hasOptions: false },
  { value: 'IMAGE_CHOICE', label: 'Image Choice', hasOptions: true },
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = QUESTION_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<QuestionType, string>
);

export function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createQuestion(type: QuestionType): QuestionDraft {
  const base: QuestionDraft = {
    id: newId(),
    type,
    questionText: '',
    description: '',
    required: false,
    options: [],
    settings: {},
  };

  if (type === 'MULTIPLE_CHOICE' || type === 'CHECKBOXES' || type === 'DROPDOWN') {
    base.options = [
      { id: newId(), label: 'Option 1' },
      { id: newId(), label: 'Option 2' },
    ];
  }
  if (type === 'IMAGE_CHOICE') {
    base.options = [
      { id: newId(), label: 'Option A', imageUrl: '' },
      { id: newId(), label: 'Option B', imageUrl: '' },
    ];
  }
  if (type === 'RATING') {
    base.settings = { max: 5 };
  }
  if (type === 'LINEAR_SCALE') {
    base.settings = { min: 1, max: 10, minLabel: '', maxLabel: '' };
  }

  return base;
}

export function duplicateQuestion(q: QuestionDraft): QuestionDraft {
  return {
    ...q,
    id: newId(),
    options: q.options.map((o) => ({ ...o, id: newId() })),
    settings: { ...q.settings },
    // A control pairing or A/B group is specific to the original question — a
    // duplicate should not silently join or mirror those relationships.
    isControlQuestion: false,
    consistencyPairQuestionId: null,
    abGroupKey: null,
    abVariant: null,
  };
}

// Adapts the AI Builder's response (POST /ai/generate-survey) into the same
// draft shape the builder already edits — reuses createQuestion() for defaults
// so an AI-generated question is structurally identical to a manually added one.
export function fromAiGenerated(ai: { title: string; description: string; questions: any[] }): { title: string; description: string; questions: QuestionDraft[] } {
  return {
    title: ai.title || '',
    description: ai.description || '',
    questions: (ai.questions || []).map((q: any) => {
      const draft = createQuestion(q.type as QuestionType);
      draft.questionText = q.questionText || '';
      draft.required = q.required !== false;
      if (q.options?.length) {
        draft.options = q.options.map((label: string) => ({ id: newId(), label }));
      }
      if (q.settings) draft.settings = { ...draft.settings, ...q.settings };
      return draft;
    }),
  };
}

// Server rows use `label`/`order`-bearing objects and JSON-string `settings`;
// this normalizes a fetched survey into the local draft shape the builder edits.
export function surveyFromServer(s: any): SurveyDraft {
  return {
    id: s.id,
    ideaId: s.ideaId,
    ideaTitle: s.idea?.title,
    title: s.title || '',
    description: s.description || '',
    status: s.status || 'DRAFT',
    publicId: s.publicId ?? null,
    responseLimit: s.responseLimit ?? null,
    collectEmail: !!s.collectEmail,
    focusMode: !!s.focusMode,
    rootSurveyId: s.rootSurveyId ?? null,
    versionNumber: s.versionNumber ?? 1,
    incentive: s.incentive ? incentiveFromServer(s.incentive) : null,
    questions: (s.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText || '',
      description: q.description || '',
      required: !!q.required,
      options: (q.options || []).map((o: any) => ({ id: o.id, label: o.label, imageUrl: o.imageUrl ?? null })),
      settings: (() => {
        try {
          return JSON.parse(q.settings || '{}');
        } catch {
          return {};
        }
      })(),
      isControlQuestion: !!q.isControlQuestion,
      consistencyPairQuestionId: q.consistencyPairQuestionId ?? null,
      abGroupKey: q.abGroupKey ?? null,
      abVariant: q.abVariant ?? null,
      mediaUrl: q.mediaUrl ?? null,
      mediaType: q.mediaType ?? null,
    })),
  };
}

function incentiveFromServer(inc: any): IncentiveDraft {
  return {
    title: inc.title || '',
    description: inc.description || '',
    numberOfWinners: inc.numberOfWinners ?? 1,
    eligibility: inc.eligibility || '',
    closingDate: inc.closingDate ? String(inc.closingDate).slice(0, 10) : null,
    collectContact: inc.collectContact !== false,
  };
}

// The public endpoint already returns settings pre-parsed and options as {id,label} —
// this just types it as PublicSurvey, no reshaping needed.
export function publicSurveyFromServer(s: any): PublicSurvey {
  return {
    title: s.title || '',
    description: s.description || '',
    status: s.status || 'LIVE',
    collectEmail: !!s.collectEmail,
    focusMode: !!s.focusMode,
    limitReached: !!s.limitReached,
    incentive: s.incentive ? { ...incentiveFromServer(s.incentive), collectContact: !!s.incentive.collectContact } : null,
    questions: (s.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText || '',
      description: q.description || '',
      required: !!q.required,
      options: q.options || [],
      settings: q.settings || {},
      mediaUrl: q.mediaUrl ?? null,
      mediaType: q.mediaType ?? null,
    })),
  };
}
