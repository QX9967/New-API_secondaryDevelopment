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

export const DEFAULT_INTENT_PROMPT = `Classify the user's request intent.
Return only JSON, no thinking, no explanation, no markdown:
{"category":"work|non_work|unknown","subcategory":"code_development|doc_writing|data_analysis|customer_service|meeting_summary|translation|research|other_work|entertainment|personal_study|life_chat|creative_writing|gaming|other_non_work|ambiguous","confidence":0-1,"reason":"中文简短原因"}
User request:
{{user_message}}`

export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
]
