'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getVoterFingerprint } from '@/lib/utils'
import type { Event, Question } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'

export default function RoomPage() {
  const { eventCode } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [content, setContent] = useState('')
  const [askedBy, setAskedBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  // Memoized payload handler to keep useEffect clean
  const handleRealtimePayload = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      const q = payload.new as Question
      if (['approved', 'on_screen', 'answered'].includes(q.status)) {
        setQuestions((prev) => {
          // Prevent duplicates if insert event fires for a question already in state
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

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel

    async function initRoom() {
      // 1. Fetch Event Details
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', String(eventCode).toUpperCase())
        .single()

      if (!eventData) {
        setNotFound(true)
        return
      }
      setEvent(eventData)

      // 2. Fetch Initial Questions
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('event_id', eventData.id)
        .in('status', ['approved', 'on_screen', 'answered'])
        .order('votes', { ascending: false })

      setQuestions(questionsData || [])

      // 3. Setup Realtime Channel
      // We subscribe AFTER fetching initial data to ensure the UI is populated
      channel = supabase
        .channel(`room-${eventData.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'questions',
            filter: `event_id=eq.${eventData.id}`,
          },
          handleRealtimePayload
        )
        .subscribe()
    }

    initRoom()

    // Cleanup: Unsubscribe when component unmounts or eventCode changes
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [eventCode, handleRealtimePayload])

  async function handleSubmit() {
    if (!content.trim() || !event) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()

    const { data, error } = await supabase
      .from('questions')
      .insert({
        event_id: event.id,
        content: content.trim(),
        asked_by: askedBy.trim() || 'Anonymous',
        source: 'text',
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    setLastQuestionId(data.id)
    setContent('')
    setAskedBy('')
    setSubmitting(false)
    setSubmitted(true)
    setShowEmailModal(true)
  }

  async function handleEmailSubmit() {
    if (!email.trim() || !lastQuestionId) {
      setShowEmailModal(false)
      return
    }

    const supabase = createClient()
    await supabase
      .from('questions')
      .update({ email: email.trim() })
      .eq('id', lastQuestionId)

    setEmail('')
    setShowEmailModal(false)
  }

  async function handleVote(questionId: string) {
    if (votedIds.has(questionId)) return
    const fp = getVoterFingerprint()
    const supabase = createClient()

    // Optimistic UI update could go here, but since we have Realtime, 
    // we let the DB update flow back through the subscription
    const { error } = await supabase
      .from('votes')
      .insert({ question_id: questionId, voter_fingerprint: fp })

    if (error) return

    await supabase.rpc('increment_votes', { question_id: questionId })
    setVotedIds((prev) => new Set([...prev, questionId]))
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
            {event.status === 'live' ? '● Live' : 'Waiting'}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {event.status !== 'ended' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Ask a question</h2>
            <div className="space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your question here..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors resize-none"
              />
              <input
                type="text"
                value={askedBy}
                onChange={(e) => setAskedBy(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              {submitted && !showEmailModal && (
                <p className="text-sm text-green-600">
                  Question submitted! The moderator will review it.
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !content.trim()}
                className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Question'}
              </button>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold text-gray-900 mb-4">
            Questions ({questions.length})
          </h2>
          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No questions yet. Be the first to ask.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl border p-5 ${
                    q.status === 'on_screen' ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <p className="text-sm text-gray-900 mb-3">{q.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{q.asked_by}</span>
                      {q.status === 'on_screen' && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                          On screen
                        </span>
                      )}
                      {q.status === 'answered' && (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
                          Answered
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleVote(q.id)}
                      disabled={votedIds.has(q.id)}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                        votedIds.has(q.id)
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ▲ {q.votes}
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
            <p className="text-sm text-gray-500 mb-4">
              Drop your email and we'll let you know when your question is answered.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={handleEmailSubmit}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Submit
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:border-gray-400 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}