'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Event, Question, Panelist } from '@/types'
import { 
  Monitor, 
  Play, 
  Square, 
  Mic, 
  CheckCircle2, 
  XCircle, 
  Tv, 
  UserPlus, 
  Link, 
  Trash2, 
  ArrowRight,
  Loader2,
  Lock
} from 'lucide-react'

export default function ModeratorPage() {
  const { eventCode } = useParams()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [panelists, setPanelists] = useState<Panelist[]>([])
  const [loading, setLoading] = useState(true)
  const [notAuthorized, setNotAuthorized] = useState(false)
  const [newPanelistName, setNewPanelistName] = useState('')
  const [newPanelistTitle, setNewPanelistTitle] = useState('')
  const [addingPanelist, setAddingPanelist] = useState(false)
  const [showPanelistForm, setShowPanelistForm] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending')

  useEffect(() => {
    loadModerator()
  }, [])

  useEffect(() => {
    if (!event?.id) return

    const supabase = createClient()
    const channel = supabase.channel(`moderator-${event.id}`)

    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'questions',
        filter: `event_id=eq.${event.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setQuestions((prev) => [payload.new as Question, ...prev])
        }
        if (payload.eventType === 'UPDATE') {
          setQuestions((prev) =>
            prev.map((q) => q.id === payload.new.id ? payload.new as Question : q)
          )
        }
        if (payload.eventType === 'DELETE') {
          setQuestions((prev) => prev.filter((q) => q.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [event?.id])

  async function loadModerator() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', String(eventCode).toUpperCase())
        .single()

      if (!eventData || eventData.host_id !== user.id) {
        setNotAuthorized(true)
        setLoading(false)
        return
      }

      setEvent(eventData)

      const [{ data: questionsData }, { data: panelistsData }] = await Promise.all([
        supabase
          .from('questions')
          .select('*')
          .eq('event_id', eventData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('panelists')
          .select('*')
          .eq('event_id', eventData.id)
          .order('created_at', { ascending: true }),
      ])

      setQuestions(questionsData || [])
      setPanelists(panelistsData || [])
      setLoading(false)
    } catch (err: any) {
      // Handle the "stolen lock" error by retrying or ignoring if it's a known race condition
      if (err.message?.includes('lock')) return 
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: Question['status']) {
    const supabase = createClient()
    if (status === 'on_screen') {
      await supabase
        .from('questions')
        .update({ status: 'approved' })
        .eq('event_id', event!.id)
        .eq('status', 'on_screen')
    }
    await supabase.from('questions').update({ status }).eq('id', id)
  }

  async function assignPanelist(questionId: string, panelistId: string | null) {
    const supabase = createClient()
    await supabase
      .from('questions')
      .update({ assigned_panelist_id: panelistId })
      .eq('id', questionId)
  }

  async function updateEventStatus(status: Event['status']) {
    const supabase = createClient()
    await supabase.from('events').update({ status }).eq('id', event!.id)
    setEvent((prev) => prev ? { ...prev, status } : prev)
  }

  async function addPanelist() {
    if (!newPanelistName.trim() || !event) return
    setAddingPanelist(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('panelists')
      .insert({
        event_id: event.id,
        name: newPanelistName.trim(),
        title: newPanelistTitle.trim() || null,
      })
      .select()
      .single()

    if (data) {
      setPanelists((prev) => [...prev, data])
      setNewPanelistName('')
      setNewPanelistTitle('')
      setShowPanelistForm(false)
    }
    setAddingPanelist(false)
  }

  async function removePanelist(id: string) {
    const supabase = createClient()
    await supabase.from('panelists').delete().eq('id', id)
    setPanelists((prev) => prev.filter((p) => p.id !== id))
  }

  function startVoiceQuestion() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser. Use Chrome.')
      return
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-NG'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = async (e: any) => {
      const transcript = e.results[0][0].transcript
      if (!transcript || !event) return

      const supabase = createClient()
      await supabase.from('questions').insert({
        event_id: event.id,
        content: transcript,
        asked_by: 'Voice Question',
        source: 'voice',
        status: 'pending'
      })
    }

    recognition.onerror = () => setIsListening(false)
    recognition.start()
  }

  const filteredQuestions = questions.filter((q) => {
    if (activeTab === 'pending') return q.status === 'pending'
    if (activeTab === 'approved') return ['approved', 'on_screen'].includes(q.status)
    return true
  })

  const pendingCount = questions.filter((q) => q.status === 'pending').length
  const onScreenQuestion = questions.find((q) => q.status === 'on_screen')
  const nextQuestion = questions.find(
    (q) => q.status === 'approved' && q.id !== onScreenQuestion?.id
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </main>
    )
  }

  if (notAuthorized) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <Lock className="mx-auto mb-4 text-red-500" size={32} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Not authorized</h1>
          <p className="text-sm text-gray-500">You don't have access to this event.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-16 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{event?.title}</span>
          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">
            {event?.event_code}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/projector/${eventCode}`, '_blank')}
            className="flex items-center gap-2 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors"
          >
            <Monitor size={14} />
            Open Projector
          </button>
          {event?.status === 'waiting' && (
            <button
              onClick={() => updateEventStatus('live')}
              className="flex items-center gap-2 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play size={14} />
              Go Live
            </button>
          )}
          {event?.status === 'live' && (
            <button
              onClick={() => updateEventStatus('ended')}
              className="flex items-center gap-2 text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              <Square size={14} />
              End Event
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {onScreenQuestion && (
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <p className="text-xs font-medium opacity-70 mb-2">ON SCREEN NOW</p>
              <p className="text-lg font-semibold mb-3">{onScreenQuestion.content}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-70">{onScreenQuestion.asked_by}</span>
                <div className="flex gap-2">
                  {nextQuestion && (
                    <button
                      onClick={() => updateStatus(nextQuestion.id, 'on_screen')}
                      className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Next Question
                      <ArrowRight size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(onScreenQuestion.id, 'answered')}
                    className="flex items-center gap-1 text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                  >
                    <CheckCircle2 size={12} />
                    Mark Answered
                  </button>
                </div>
              </div>
            </div>
          )}

          {nextQuestion && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-400 mb-2">NEXT UP</p>
              <p className="text-sm text-gray-900">{nextQuestion.content}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Voice Question</p>
              <p className="text-xs text-gray-400 mt-0.5">Capture audience audio instantly</p>
            </div>
            <button
              onClick={startVoiceQuestion}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              <Mic size={14} />
              {isListening ? 'Listening...' : 'Start Voice'}
            </button>
          </div>

          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {(['pending', 'approved', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm px-4 py-1.5 rounded-lg transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 font-medium shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab} {tab === 'pending' && pendingCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">No questions found.</p>
              </div>
            ) : (
              filteredQuestions.map((q) => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="text-sm text-gray-900 flex-1">{q.content}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {q.source === 'voice' && (
                        <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                          <Mic size={10} />
                          voice
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">▲ {q.votes}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">{q.asked_by}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={q.assigned_panelist_id || ''}
                        onChange={(e) => assignPanelist(q.id, e.target.value || null)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-transparent"
                      >
                        <option value="">Assign panelist</option>
                        {panelists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>

                      {q.status === 'pending' && (
                        <>
                          <button onClick={() => updateStatus(q.id, 'approved')} className="flex items-center gap-1 text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100">
                            <CheckCircle2 size={12} />
                            Approve
                          </button>
                          <button onClick={() => updateStatus(q.id, 'rejected')} className="flex items-center gap-1 text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-100">
                            <XCircle size={12} />
                            Reject
                          </button>
                        </>
                      )}

                      {q.status === 'approved' && (
                        <button onClick={() => updateStatus(q.id, 'on_screen')} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                          <Tv size={12} />
                          Send to Screen
                        </button>
                      )}

                      {q.status === 'on_screen' && (
                        <button onClick={() => updateStatus(q.id, 'answered')} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                          <CheckCircle2 size={12} />
                          Mark Answered
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Panelists</h2>
              <button 
                onClick={() => setShowPanelistForm(!showPanelistForm)} 
                className="flex items-center gap-1 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700"
              >
                <UserPlus size={12} />
                Add
              </button>
            </div>

            {showPanelistForm && (
              <div className="space-y-2 mb-4">
                <input type="text" value={newPanelistName} onChange={(e) => setNewPanelistName(e.target.value)} placeholder="Full name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                <input type="text" value={newPanelistTitle} onChange={(e) => setNewPanelistTitle(e.target.value)} placeholder="Title / role (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                <button onClick={addPanelist} disabled={addingPanelist} className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {addingPanelist ? 'Adding...' : 'Add Panelist'}
                </button>
              </div>
            )}

            <div className="space-y-2">
              {panelists.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    {p.title && <p className="text-xs text-gray-400">{p.title}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/panelist/${eventCode}?panelist=${p.id}`);
                      alert(`Link copied for ${p.name}`);
                    }} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                      <Link size={10} />
                      Link
                    </button>
                    <button onClick={() => removePanelist(p.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Stats</h2>
            <div className="space-y-3">
              {[
                { label: 'Total questions', value: questions.length },
                { label: 'Pending', value: pendingCount },
                { label: 'Voice submissions', value: questions.filter(q => q.source === 'voice').length },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{s.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}