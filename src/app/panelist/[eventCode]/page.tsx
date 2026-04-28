'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Event, Question, Panelist } from '@/types'
import { Circle, Timer, Mic } from 'lucide-react'

export default function PanelistPage() {
  const { eventCode } = useParams()
  const searchParams = useSearchParams()
  const panelistId = searchParams.get('panelist')
  const [event, setEvent] = useState<Event | null>(null)
  const [panelist, setPanelist] = useState<Panelist | null>(null)
  const [assignedQuestion, setAssignedQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cleanup: (() => void) | undefined
    loadPanelist().then((fn) => { cleanup = fn })
    return () => { cleanup?.() }
  }, [])

  async function loadPanelist(): Promise<(() => void) | undefined> {
    if (!panelistId) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', String(eventCode).toUpperCase())
      .single()

    if (!eventData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setEvent(eventData)

    const { data: panelistData } = await supabase
      .from('panelists')
      .select('*')
      .eq('id', panelistId)
      .single()

    if (!panelistData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setPanelist(panelistData)

    const { data: questionData } = await supabase
      .from('questions')
      .select('*')
      .eq('assigned_panelist_id', panelistId)
      .eq('status', 'on_screen')
      .maybeSingle()

    setAssignedQuestion(questionData || null)
    setLoading(false)

    const channel = supabase.channel(`panelist-${panelistId}`)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'questions',
      filter: `assigned_panelist_id=eq.${panelistId}`,
    }, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const q = payload.new as Question
        if (q.status === 'on_screen') {
          setAssignedQuestion(q)
        } else {
          setAssignedQuestion(null)
        }
      }
    }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Not found</h1>
          <p className="text-sm text-gray-500">
            Invalid panelist link. Ask the moderator for your link.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{event?.title}</p>
            <h1 className="font-bold text-gray-900">{panelist?.name}</h1>
            {panelist?.title && (
              <p className="text-xs text-gray-500">{panelist.title}</p>
            )}
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            event?.status === 'live'
              ? 'bg-green-50 text-green-600'
              : 'bg-yellow-50 text-yellow-600'
          }`}>
            {event?.status === 'live' ? (
              <span className="flex items-center gap-1">
                <Circle size={6} className="fill-green-500 text-green-500" /> Live
              </span>
            ) : 'Waiting'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {assignedQuestion ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-10 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  Your Question
                </span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 leading-relaxed mb-6">
                {assignedQuestion.content}
              </p>
              <div className="flex items-center gap-3 pt-6 border-t border-gray-100">
                <span className="text-sm text-gray-400">Asked by</span>
                <span className="text-sm font-medium text-gray-700">
                  {assignedQuestion.asked_by}
                </span>
                {assignedQuestion.source === 'voice' && (
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Mic size={10} /> voice
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Timer size={28} className="text-gray-300" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Waiting for your question
              </h2>
              <p className="text-sm text-gray-400">
                The moderator will assign a question to you shortly.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}