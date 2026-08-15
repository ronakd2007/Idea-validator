export interface PromptCategory {
  label: string;
  prompts: string[];
}

// Idea reports get Understand/Improve/Build/Challenge; survey reports swap
// Improve+Build for the survey-specific category — "should my MVP include X"
// doesn't make sense on a standalone survey with no linked idea.
export const IDEA_PROMPT_CATEGORIES: PromptCategory[] = [
  { label: 'Understand', prompts: ['Summarize my report', 'Explain my validation score', 'What are the key insights?'] },
  { label: 'Improve', prompts: ['What should I improve?', 'What assumptions remain unvalidated?', 'What are the biggest weaknesses?', 'How can I increase confidence?'] },
  { label: 'Build', prompts: ['Should I build this?', 'What should my MVP include?', 'What features should I remove?', 'What should I validate next?'] },
  { label: 'Challenge', prompts: ['Challenge my idea', 'Find flaws', 'Play devil\'s advocate', 'What am I overlooking?'] },
];

export const SURVEY_PROMPT_CATEGORIES: PromptCategory[] = [
  { label: 'Understand', prompts: ['Summarize this survey', 'What are the key insights?', 'How confident should I be in these results?'] },
  { label: 'Survey', prompts: ['What do respondents like?', 'Why are people not interested?', 'Which audience should I target?', 'What trends do you see?'] },
  { label: 'Challenge', prompts: ['Challenge my idea', 'Find flaws', 'Play devil\'s advocate', 'What am I overlooking?'] },
];
