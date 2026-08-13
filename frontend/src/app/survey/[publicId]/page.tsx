'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PublicSurvey, publicSurveyFromServer } from '@/lib/surveyTypes';
import QuestionPreview from '@/components/survey/QuestionPreview';

type PageState = 'loading' | 'not_found' | 'closed' | 'limit_reached' | 'submitted' | 'ready' | 'error';

function sessionKey(publicId: string) {
  return `iv_survey_session_${publicId}`;
}
function submittedKey(publicId: string) {
  return `iv_survey_submitted_${publicId}`;
}

export default function PublicSurveyPage() {
  const params = useParams();
  const publicId = params.publicId as string;

  const [state, setState] = useState<PageState>('loading');
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [incentiveName, setIncentiveName] = useState('');
  const [incentiveContact, setIncentiveContact] = useState('');
  const [incentiveEntrySubmitted, setIncentiveEntrySubmitted] = useState(false);
  const [incentiveEntrySubmitting, setIncentiveEntrySubmitting] = useState(false);
  const [incentiveEntryError, setIncentiveEntryError] = useState('');

  useEffect(() => {
    let cancelled = false;

    api.getPublicSurvey(publicId)
      .then(async (res) => {
        if (cancelled) return;
        const s = publicSurveyFromServer(res);
        setSurvey(s);

        if (typeof window !== 'undefined' && localStorage.getItem(submittedKey(publicId)) === 'true') {
          setState('submitted');
          return;
        }
        if (s.status === 'CLOSED') {
          setState('closed');
          return;
        }
        if (s.limitReached) {
          setState('limit_reached');
          return;
        }
        if (s.status !== 'LIVE') {
          setState('closed');
          return;
        }

        try {
          const existing = typeof window !== 'undefined' ? localStorage.getItem(sessionKey(publicId)) : null;
          let token: string = existing || '';
          if (!token) {
            const session = await api.startPublicSurveySession(publicId);
            if (cancelled) return;
            token = session.sessionToken;
            localStorage.setItem(sessionKey(publicId), token);
          }
          setSessionToken(token);

          // Re-fetch with the session token so any A/B question groups resolve
          // to exactly one variant, stable across refreshes for this session.
          const withVariant = await api.getPublicSurvey(publicId, token);
          if (cancelled) return;
          setSurvey(publicSurveyFromServer(withVariant));
          setState('ready');
        } catch (err: any) {
          if (cancelled) return;
          if (/limit/i.test(err.message)) setState('limit_reached');
          else setState('closed');
        }
      })
      .catch(() => {
        if (!cancelled) setState('not_found');
      });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  const isEmpty = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

  // Best-effort drop-off signal: debounced, fire-and-forget, never blocks the form.
  useEffect(() => {
    if (!sessionToken || state !== 'ready' || !survey) return;
    const answeredIndexes = survey.questions.map((q, i) => (isEmpty(answers[q.id]) ? -1 : i));
    const maxIndex = Math.max(-1, ...answeredIndexes);
    if (maxIndex < 0) return;
    const t = setTimeout(() => {
      api.updatePublicSurveyProgress(publicId, sessionToken, maxIndex).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [answers, sessionToken, state, survey, publicId]);

  const setAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const submit = async () => {
    if (!survey || !sessionToken) return;

    const nextErrors: Record<string, string> = {};
    for (const q of survey.questions) {
      if (q.required && isEmpty(answers[q.id])) nextErrors[q.id] = 'This question is required.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstEl = document.getElementById(`q-${Object.keys(nextErrors)[0]}`);
      firstEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // When the founder chose "collect email addresses", it works like Google
    // Forms: a valid email is required before the response can be submitted.
    if (survey.collectEmail) {
      if (!email.trim()) {
        setEmailError('Your email is required to submit this survey.');
        document.getElementById('respondent-email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        setEmailError('Enter a valid email address, e.g. you@example.com.');
        document.getElementById('respondent-email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setEmailError('');
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await api.submitPublicSurveyResponse(publicId, {
        sessionToken,
        answers: survey.questions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? null })),
        respondentEmail: survey.collectEmail ? email.trim() : undefined,
      });
      localStorage.setItem(submittedKey(publicId), 'true');
      localStorage.removeItem(sessionKey(publicId));
      setState('submitted');
    } catch (err: any) {
      if (Array.isArray(err.errors) && err.errors.length > 0) {
        const map: Record<string, string> = {};
        err.errors.forEach((e: { questionId: string; message: string }) => { map[e.questionId] = e.message; });
        setErrors(map);
        setSubmitError('Please check the highlighted questions and try again.');
        const firstEl = document.getElementById(`q-${err.errors[0].questionId}`);
        firstEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (/limit/i.test(err.message)) {
        setState('limit_reached');
      } else if (/no longer accepting/i.test(err.message)) {
        setState('closed');
      } else if (/already submitted/i.test(err.message)) {
        localStorage.setItem(submittedKey(publicId), 'true');
        setState('submitted');
      } else {
        setSubmitError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitIncentiveEntry = async () => {
    if (!incentiveName.trim() || !incentiveContact.trim()) return;
    setIncentiveEntrySubmitting(true);
    setIncentiveEntryError('');
    try {
      await api.submitIncentiveEntry(publicId, incentiveName, incentiveContact);
      setIncentiveEntrySubmitted(true);
    } catch (err: any) {
      setIncentiveEntryError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIncentiveEntrySubmitting(false);
    }
  };

  const estimateMinutes = survey ? Math.max(1, Math.round(survey.questions.length * 0.3)) : 1;

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><p className="text-slate-400 text-sm">Loading survey...</p></div>;
  }

  if (state === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold text-slate-900 mb-2">Survey not found</p>
          <p className="text-sm text-slate-500">This link may be incorrect or the survey may have been removed.</p>
        </div>
      </div>
    );
  }

  if (state === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold text-slate-900 mb-2">{survey?.title}</p>
          <p className="text-sm text-slate-500">This survey is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  if (state === 'limit_reached') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold text-slate-900 mb-2">{survey?.title}</p>
          <p className="text-sm text-slate-500">This survey has reached its response limit.</p>
        </div>
      </div>
    );
  }

  if (state === 'submitted') {
    const showIncentiveForm = survey?.incentive?.collectContact && !incentiveEntrySubmitted;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-6 py-12">
        <div className="text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-4">&#10003;</div>
          <p className="text-xl font-semibold text-slate-900 mb-2">Thank you!</p>
          <p className="text-sm text-slate-500">Your response has been recorded. Thank you for helping validate this idea.</p>

          {showIncentiveForm && (
            <div className="mt-8 bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-left">
              <p className="text-sm font-semibold text-slate-900 mb-1">{survey!.incentive!.title}</p>
              {survey!.incentive!.description && <p className="text-xs text-slate-500 mb-3">{survey!.incentive!.description}</p>}
              <p className="text-[11px] text-slate-400 mb-4">Your survey answers remain anonymous. Contact information below is collected separately and only used for this giveaway.</p>
              <div className="space-y-2.5">
                <input type="text" value={incentiveName} onChange={(e) => setIncentiveName(e.target.value)} placeholder="Your name"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input type="text" value={incentiveContact} onChange={(e) => setIncentiveContact(e.target.value)} placeholder="Email or phone"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              {incentiveEntryError && <p className="text-xs text-red-600 mt-2">{incentiveEntryError}</p>}
              <button
                onClick={submitIncentiveEntry}
                disabled={incentiveEntrySubmitting || !incentiveName.trim() || !incentiveContact.trim()}
                className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {incentiveEntrySubmitting ? 'Submitting...' : 'Enter Giveaway'}
              </button>
            </div>
          )}
          {survey?.incentive?.collectContact && incentiveEntrySubmitted && (
            <p className="mt-6 text-sm text-emerald-600">You&apos;re entered! Good luck.</p>
          )}
        </div>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{survey.title}</h1>
          {survey.description && <p className="text-sm text-slate-600 mb-3">{survey.description}</p>}
          <p className="text-xs text-slate-400">~{estimateMinutes} minute{estimateMinutes !== 1 ? 's' : ''}</p>

          {survey.incentive && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Complete this survey for a chance to win</p>
              <p className="text-sm font-medium text-slate-900">{survey.incentive.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {survey.incentive.numberOfWinners} winner{survey.incentive.numberOfWinners !== 1 ? 's' : ''}
                {survey.incentive.closingDate && ` · Closes ${new Date(survey.incentive.closingDate).toLocaleDateString()}`}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {survey.questions.map((q, i) => (
            <div key={q.id} id={`q-${q.id}`}>
              <QuestionPreview question={q} index={i} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} error={errors[q.id]} />
            </div>
          ))}
        </div>

        {survey.collectEmail && (
          <div id="respondent-email" className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Your email <span className="text-red-500">*</span></label>
            <p className="text-xs text-slate-500 mb-2">This survey collects email addresses — your email is recorded with your response.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
              placeholder="you@example.com"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none ${emailError ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500'}`}
            />
            {emailError && <p className="text-xs text-red-600 mt-1 font-medium">{emailError}</p>}
          </div>
        )}

        {submitError && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mt-4">{submitError}</div>}

        <div className="flex justify-end mt-6 mb-10">
          <button
            onClick={submit}
            disabled={submitting}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-base font-semibold hover:bg-blue-700 transition disabled:opacity-60 w-full sm:w-auto"
          >
            {submitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </div>
      </div>
    </div>
  );
}
