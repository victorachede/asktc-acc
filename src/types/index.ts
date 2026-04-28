export type Plan = 'free' | 'pro' | 'enterprise'
export type EventStatus = 'waiting' | 'live' | 'ended'
export type QuestionStatus = 'pending' | 'approved' | 'on_screen' | 'answered' | 'rejected'
export type QuestionSource = 'text' | 'voice'
export type PaymentStatus = 'pending' | 'success' | 'failed'
export type BillingCycle = 'monthly' | 'yearly'
export type PollStatus = 'draft' | 'active' | 'closed'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: Plan
  billing_cycle: BillingCycle | null
  status: 'active' | 'expired' | 'cancelled'
  current_period_start: string | null
  current_period_end: string | null
}

export interface Event {
  id: string
  title: string
  description: string | null
  event_code: string
  host_id: string
  status: EventStatus
  force_anonymous: boolean
  active_word_cloud: boolean
  created_at: string
}

export interface WordCloudEntry {
  id: string
  event_id: string
  word: string
  voter_fingerprint: string
  created_at: string
}

export interface QuizScore {
  id: string
  poll_id: string
  voter_fingerprint: string
  score: number
  answered_at: string
}

export interface Reaction {
  emoji: string
  x: number
  id: string
}

export interface Panelist {
  id: string
  event_id: string
  name: string
  title: string | null
  created_at: string
}

export interface Question {
  id: string
  event_id: string
  content: string
  asked_by: string
  email: string | null
  votes: number
  status: QuestionStatus
  assigned_panelist_id: string | null
  source: QuestionSource
  starred: boolean
  created_at: string
}

export interface Vote {
  id: string
  question_id: string
  voter_fingerprint: string
  created_at: string
}

export interface Poll {
  id: string
  event_id: string
  question: string
  options: string[]
  status: PollStatus
  is_quiz: boolean
  correct_option: number | null
  created_at: string
}

export interface PollVote {
  id: string
  poll_id: string
  option_index: number
  voter_fingerprint: string
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  amount: number
  plan: Plan
  billing_cycle: BillingCycle | null
  status: PaymentStatus
  flutterwave_reference: string | null
  created_at: string
}

export const PLAN_LIMITS = {
  free: {
    max_events: 1,
    max_questions: 50,
    max_audience: 30,
    voice_questions: false,
    panelists: false,
    watermark: true,
    analytics: false,
    custom_branding: false,
    multi_moderator: false,
    export: false,
  },
  pro: {
    max_events: Infinity,
    max_questions: 200,
    max_audience: 200,
    voice_questions: true,
    panelists: true,
    watermark: false,
    analytics: true,
    custom_branding: false,
    multi_moderator: false,
    export: false,
  },
  enterprise: {
    max_events: Infinity,
    max_questions: Infinity,
    max_audience: Infinity,
    voice_questions: true,
    panelists: true,
    watermark: false,
    analytics: true,
    custom_branding: true,
    multi_moderator: true,
    export: true,
  },
}

export const PLAN_PRICES = {
  pro: { monthly: 9, yearly: 72 },
  enterprise: { monthly: 29, yearly: 232 },
}