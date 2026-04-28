'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getVoterFingerprint } from '@/lib/utils'
import type { Event, Question, Poll } from '@/types'
import { PLAN_LIMITS } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'
import { ChevronUp, Circle, BarChart2 } from 'lucide-react'

const RATE_LIMITS: Record<string, number> = {
  free: 3,
  pro: 10,
  enterprise: 20,
}

function isSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return true
  const wordsA = new Set(na.split(' ').filter(w => w.length > 3))
  const wordsB = nb.split(' ').filter(w => w.length > 3)
  const overlap = wordsB.filter(w => wordsA.has(w)).length
  return overlap >= 3 && overlap / Math.max(wordsA.size, wordsB.length) > 0.6
}

export default function RoomPage() {
  const { eventCode } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [maxQuestions, setMaxQuestions] = useState<number>(Infinity)
  const [hostPlan, setHostPlan] = useState<string>('free')
  const [content, setContent] = useState('')
  const [askedBy, setAskedBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null)
  const [similarQuestion, setSimilarQuestion] = useState<Question | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(`asktc_votes_${String(eventCode).toUpperCase()}`)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  // Poll state
  const [activePoll, setActivePoll] = useState<Poll | null>(null)
  const [pollVotes, setPollVotes] = useState<number[]>([])
  const [votedPollIds, setVotedPollIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(`asktc_poll_votes_${String(eventCode).toUpperCase()}`)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [submittingPollVote, setSubmittingPollVote] = useState(false)

  const handleRealtimePayload = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      const q = payload.new as Question
      if (['approved', 'on_screen', 'answered'].includes(q.status)) {
        setQuestions((prev) => {
          if (prev.find(item => item.id === q.id)) return prev
          return [q, ...prev]
        })
      }
    }
    if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
      setQuestions((prev) =>
        prev
          .map((q) => (payload.eventType === 'UPDATE' && q.id === payload.new.id ? (payload.new as Question) : q))
          .filter((q) => {
            if (payload.eventType === 'DELETE' && q.id === payload.old.id) return false
            return ['approved', 'on_screen', 'answered'].includes(q.status)
          })
          .sort((a, b) => b.votes - a.votes)
      )
    }
  }, [])

  async function loadPollVoteCounts(poll: Poll) {
    const supabase = createClient()
    const { data } = await supabase.from('poll_votes').select('option_index').eq('poll_id', poll.id)
    const tally = Array(poll.options.length).fill(0)
    data?.forEach((v) => { if (tally[v.option_index] !== undefined) tally[v.option_index]++ })
    setPollVotes(tally)
  }

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel

    async function initRoom() {
      const { data: eventData } = await supabase
        .from('events').select('*')
        .eq('event_code', String(eventCode).toUpperCase())
        .single()

      if (!eventData) { setNotFound(true); return }
      setEvent(eventData)

      const { data: subData } = await supabase
        .from('subscriptions').select('plan')
        .eq('user_id', eventData.host_id).single()
      const plan = subData?.plan ?? 'free'
      setHostPlan(plan)
      setMaxQuestions(PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS].max_questions)

      const { data: questionsData } = await supabase
        .from('questions').select('*')
        .eq('event_id', eventData.id)
        .in('status', ['approved', 'on_screen', 'answered'])
        .order('votes', { ascending: false })
      setQuestions(questionsData || [])

      // Load active poll
      const { data: pollData } = await supabase
        .from('polls').select('*')
        .eq('event_id', eventData.id)
        .eq('status', 'active')
        .maybeSingle()
      if (pollData) { setActivePoll(pollData); loadPollVoteCounts(pollData) }

      channel = supabase
        .channel(`room-${eventData.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'questions',
          filter: `event_id=eq.${eventData.id}`,
        }, handleRealtimePayload)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'events',
          filter: `id=eq.${eventData.id}`,
        }, (payload) => {
          setEvent((prev) => prev ? { ...prev, ...payload.new } : prev)
        })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'polls',
          filter: `event_id=eq.${eventData.id}`,
        }, (payload) => {
          if (payload.eventType === 'UPDATE') {
            const p = payload.new as Poll
            if (p.status === 'active') {
              setActivePoll(p)
              loadPollVoteCounts(p)
            } else if (p.status === 'closed') {
              setActivePoll((prev) => prev?.id === p.id ? null : prev)
            }
          }
        })
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'poll_votes',
        }, () => {
          setActivePoll((prev) => { if (prev) loadPollVoteCounts(prev); return prev })
        })
        .subscribe()

      const presenceChannel = supabase.channel(`presence-${eventData.id}`, {
        config: { presence: { key: `user-${Math.random()}` } },
      })
      presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ role: 'audience' })
      })
      channel = channel // keep ts happy — presence cleanup below
      return presenceChannel
    }

    let presenceChannel: any
    initRoom().then((pc) => { presenceChannel = pc })
    return () => {
      if (channel) supabase.removeChannel(channel)
      if (presenceChannel) supabase.removeChannel(presenceChannel)
    }
  }, [eventCode, handleRealtimePayload])

  useEffect(() => {
    if (content.trim().length < 15) { setSimilarQuestion(null); return }
    const timer = setTimeout(() => {
      const found = questions.find(q => isSimilar(content, q.content))
      setSimilarQuestion(found || null)
    }, 400)
    return () => clearTimeout(timer)
  }, [content, questions])

  async function handleSubmit() {
    if (!content.trim() || !event) return
    setSubmitting(true); setError('')
    const supabase = createClient()
    const fp = getVoterFingerprint()
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const rateLimit = RATE_LIMITS[hostPlan] ?? 3

    const { count: recentCount } = await supabase
      .from('questions').select('*', { count: 'exact', head: true })
      .eq('event_id', event.id).eq('submitter_fingerprint', fp).gte('created_at', windowStart)

    if (recentCount !== null && recentCount >= rateLimit) {
      setError(`You've submitted ${rateLimit} questions in the last 10 minutes. Please wait a bit.`)
      setSubmitting(false); return
    }

    const { count: totalCount } = await supabase
      .from('questions').select('*', { count: 'exact', head: true }).eq('event_id', event.id)

    if (totalCount !== null && totalCount >= maxQuestions) {
      setError(`This event has reached its question limit (${maxQuestions}).`)
      setSubmitting(false); return
    }

    const { data, error } = await supabase.from('questions').insert({
      event_id: event.id, content: content.trim(),
      asked_by: askedBy.trim() || 'Anonymous', source: 'text',
      status: 'pending', submitter_fingerprint: fp,
    }).select().single()

    if (error) { setError(error.message); setSubmitting(false); return }

    setLastQuestionId(data.id); setContent(''); setAskedBy('')
    setSimilarQuestion(null); setSubmitting(false); setSubmitted(true); setShowEmailModal(true)
  }

  async function handleEmailSubmit() {
    if (!email.trim() || !lastQuestionId) { setShowEmailModal(false); return }
    const supabase = createClient()
    await supabase.from('questions').update({ email: email.trim() }).eq('id', lastQuestionId)
    setEmail(''); setShowEmailModal(false)
  }

  async function handleVote(questionId: string) {
    if (votedIds.has(questionId)) return
    const fp = getVoterFingerprint()
    const supabase = createClient()
    const { error } = await supabase.from('votes').insert({ question_id: questionId, voter_fingerprint: fp })
    if (error) return
    await supabase.rpc('increment_votes', { question_id: questionId })
    // Optimistically update the vote count so the UI responds immediately
    setQuestions((prev) =>
      prev.map((q) => q.id === questionId ? { ...q, votes: q.votes + 1 } : q)
    )
    setVotedIds((prev) => {
      const next = new Set([...prev, questionId])
      try { localStorage.setItem(`asktc_votes_${String(eventCode).toUpperCase()}`, JSON.stringify([...next])) } catch { }
      return next
    })
  }

  async function handlePollVote(optionIndex: number) {
    if (!activePoll || votedPollIds.has(activePoll.id)) return
    setSubmittingPollVote(true)
    const fp = getVoterFingerprint()
    const supabase = createClient()
    const { error } = await supabase.from('poll_votes').insert({
      poll_id: activePoll.id, option_index: optionIndex, voter_fingerprint: fp,
    })
    if (!error) {
      setVotedPollIds((prev) => {
        const next = new Set([...prev, activePoll.id])
        try { localStorage.setItem(`asktc_poll_votes_${String(eventCode).toUpperCase()}`, JSON.stringify([...next])) } catch { }
        return next
      })
      setPollVotes((prev) => { const next = [...prev]; next[optionIndex]++; return next })
    }
    setSubmittingPollVote(false)
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event not found</h1>
          <p className="text-sm text-gray-500">Check your event code and try again.</p>
        </div>
      </main>
    )
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  const hasVotedOnPoll = activePoll ? votedPollIds.has(activePoll.id) : false
  const pollTotal = pollVotes.reduce((a, b) => a + b, 0)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">{event.title}</h1>
            <p className="text-xs text-gray-400 font-mono">{event.event_code}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            event.status === 'live' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
          }`}>
            {event.status === 'live' ? (
              <span className="flex items-center gap-1">
                <Circle size={6} className="fill-green-500 text-green-500" /> Live
              </span>
            ) : 'Waiting'}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── ACTIVE POLL ── */}
        {activePoll && (
          <div className="bg-white rounded-2xl border border-indigo-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} className="text-indigo-500" />
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Live Poll</p>
            </div>
            <p className="font-semibold text-gray-900 mb-4">{activePoll.question}</p>

            {!hasVotedOnPoll ? (
              <div className="space-y-2">
                {activePoll.options.map((opt, i) => (
                  <button key={i} onClick={() => handlePollVote(i)} disabled={submittingPollVote}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {activePoll.options.map((opt, i) => {
                  const pct = pollTotal > 0 ? Math.round((pollVotes[i] / pollTotal) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">{opt}</span>
                        <span className="text-gray-500 font-mono text-xs">{pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400 pt-1">{pollTotal} vote{pollTotal !== 1 ? 's' : ''} total</p>
              </div>
            )}
          </div>
        )}

        {event.status !== 'ended' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Ask a question</h2>
            <div className="space-y-3">
              <div className="relative">
                <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 280))}
                  placeholder="Type your question here..." rows={3}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors resize-none"
                />
                <span className={`absolute bottom-2 right-3 text-xs font-mono ${content.length >= 260 ? content.length >= 280 ? 'text-red-500' : 'text-amber-500' : 'text-gray-300'}`}>
                  {content.length}/280
                </span>
              </div>
              {similarQuestion && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Similar question already exists</p>
                  <p className="text-sm text-amber-800 mb-3">"{similarQuestion.content}"</p>
                  <button onClick={() => { handleVote(similarQuestion.id); setSimilarQuestion(null); setContent('') }}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
                    ▲ Upvote this instead
                  </button>
                </div>
              )}
              <input type="text" value={askedBy} onChange={(e) => setAskedBy(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              {submitted && !showEmailModal && <p className="text-sm text-green-600">Question submitted!</p>}
              <button onClick={handleSubmit} disabled={submitting || !content.trim()}
                className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Question'}
              </button>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Questions ({questions.length})</h2>
          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No questions yet. Be the first to ask.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className={`bg-white rounded-2xl border p-5 ${
                  q.status === 'on_screen' ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                }`}>
                  <p className="text-sm text-gray-900 mb-3">{q.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{q.asked_by}</span>
                      {q.status === 'on_screen' && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">On screen</span>
                      )}
                      {q.status === 'answered' && (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Answered</span>
                      )}
                    </div>
                    <button onClick={() => handleVote(q.id)} disabled={votedIds.has(q.id)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                        votedIds.has(q.id) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      <ChevronUp size={14} /> {q.votes}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-1">Get notified</h3>
            <p className="text-sm text-gray-500 mb-4">Drop your email and we'll let you know when your question is answered.</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors mb-3"
            />
            <div className="flex gap-3">
              <button onClick={handleEmailSubmit}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
                Submit
              </button>
              <button onClick={() => setShowEmailModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:border-gray-400 transition-colors">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}