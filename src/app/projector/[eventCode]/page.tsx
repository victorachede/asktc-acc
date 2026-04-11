'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mic, MessageSquare, Radio } from 'lucide-react'
import type { Event, Question } from '@/types'

export default function ProjectorPage() {
  const { eventCode } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const currentQuestionRef = useRef<Question | null>(null)

  useEffect(() => {
    loadProjector()
  }, [])

  async function loadProjector() {
    const supabase = createClient()

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', String(eventCode).toUpperCase())
      .single()

    if (!eventData) {
      setLoading(false)
      return
    }

    setEvent(eventData)

    const { data: questionData } = await supabase
      .from('questions')
      .select('*')
      .eq('event_id', eventData.id)
      .eq('status', 'on_screen')
      .maybeSingle()

    setCurrentQuestion(questionData || null)
    currentQuestionRef.current = questionData || null
    setLoading(false)

    const channel = supabase.channel(`projector-${eventData.id}`)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'questions',
      filter: `event_id=eq.${eventData.id}`,
    }, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const q = payload.new as Question
        if (q.status === 'on_screen') {
          setCurrentQuestion(q)
          currentQuestionRef.current = q
        } else if (currentQuestionRef.current?.id === q.id) {
          setCurrentQuestion(null)
          currentQuestionRef.current = null
        }
      }
    }).subscribe()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-10 py-6">
        <span className="text-white font-bold text-lg tracking-tight">ASKTC</span>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{event?.title}</span>
          {event?.status === 'live' && (
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
              <Radio size={10} className="animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* MAIN DISPLAY */}
      <div className="flex-1 flex items-center justify-center px-16">
        {currentQuestion ? (
          <div className="w-full max-w-5xl">
            <p className="text-xs font-medium text-blue-400 uppercase tracking-widest mb-8">
              Question
            </p>
            <p className="text-4xl sm:text-5xl font-semibold text-white leading-tight mb-10">
              {currentQuestion.content}
            </p>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-gray-400 text-sm">
                {currentQuestion.asked_by}
              </span>
              {currentQuestion.source === 'voice' && (
                <span className="flex items-center gap-1.5 text-xs bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full">
                  <Mic size={10} />
                  Voice
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={28} className="text-gray-500" />
            </div>
            <p className="text-2xl font-semibold text-white mb-3">
              {event?.title}
            </p>
            <p className="text-gray-500 text-lg">
              Waiting for questions...
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <span className="text-gray-600 text-sm">Join at</span>
              <span className="bg-white/10 text-white text-sm font-mono px-4 py-2 rounded-lg">
                {typeof window !== 'undefined' ? window.location.host : ''}/join
              </span>
              <span className="text-gray-600 text-sm">with code</span>
              <span className="bg-white/10 text-white text-sm font-mono px-4 py-2 rounded-lg tracking-widest">
                {event?.event_code}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* WATERMARK */}
      <div className="px-10 py-6 flex items-center justify-end">
        <span className="text-gray-700 text-xs">Powered by ASKTC</span>
      </div>
    </main>
  )
}