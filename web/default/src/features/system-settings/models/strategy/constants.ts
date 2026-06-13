export const DIFFICULTY_LEVELS = ['simple', 'medium', 'hard'] as const

export const DIFFICULTY_LEVEL_LABELS: Record<string, string> = {
  simple: 'Simple',
  medium: 'Medium',
  hard: 'Hard',
}

export const CLASSIFIER_TYPES = ['channel', 'independent'] as const

export const DEFAULT_DIFFICULTY_MODELS = {
  simple: [],
  medium: [],
  hard: [],
}

export const DEFAULT_TIME_ACTIONS = {
  enable_models: [],
  disable_models: [],
  priority_adjust: {},
  weight_adjust: {},
  use_models: [],
}

export const DEFAULT_INTENT_PROMPT = `You are a request intent classifier for a corporate AI system. Your job is to determine whether the user's request is work-related or personal/non-work.

Classification categories:

work (工作):
- code_development: Code writing, debugging, code review, DevOps
- doc_writing: Documents, reports, emails, presentations
- data_analysis: Data analysis, SQL, reports, charts
- customer_service: Customer communication, ticket handling
- meeting_summary: Meeting notes, summaries
- translation: Work-related translation
- research: Technical research, solution comparison
- other_work: Other work-related tasks

non_work (非工作):
- entertainment: Entertainment, jokes, stories, roleplay
- personal_study: Personal learning (not job-related)
- life_chat: Casual conversation, emotional advice
- creative_writing: Creative writing (non-work)
- gaming: Gaming related
- other_non_work: Other non-work tasks

unknown (无法判定):
- ambiguous: Content is ambiguous or cannot be determined

Return only JSON:
{"category": "work|non_work|unknown", "subcategory": "...", "confidence": 0.0-1.0, "reason": "brief reason in Chinese"}`

export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
]
