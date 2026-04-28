'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Event, Question, Panelist } from '@/types'
import {
  Monitor, Play, Square, Mic, MicOff, CheckCircle2,
  XCircle, Tv, UserPlus, Link, Trash2,
  ArrowRight, Loader2, Lock, Check, Search, Send
} from 'lucide-react'

type VoiceState = 'idle' | 'listening' | 'review'

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
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [editableTranscript, setEditableTranscript] = useState('')
  const [askedByVoice, setAskedByVoice] = useState('')
  const [submittingVoice, setSubmittingVoice] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    loadModerator()
  }, [])

  useEffect(() => {
    if (!event?.id) return
    const supabase = createClient()
    const channel = supabase.channel(`moderator-${event.id}`)
    channel
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'questions',
        filter: `event_id=eq.${event.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') setQuestions((prev) => [payload.new as Question, ...prev])
        if (payload.eventType === 'UPDATE') setQuestions((prev) => prev.map((q) => q.id === payload.new.id ? payload.new as Question : q))
        if (payload.eventType === 'DELETE') setQuestions((prev) => prev.filter((q) => q.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event?.id])

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.abort() }
  }, [])

  async function loadModerator() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: eventData } = await supabase
        .from('events').select('*')
        .eq('event_code', String(eventCode).toUpperCase())
        .single()

      if (!eventData || eventData.host_id !== user.id) {
        setNotAuthorized(true); setLoading(false); return
      }

      setEvent(eventData)
      const [{ data: questionsData }, { data: panelistsData }] = await Promise.all([
        supabase.from('questions').select('*').eq('event_id', eventData.id).order('created_at', { ascending: false }),
        supabase.from('panelists').select('*').eq('event_id', eventData.id).order('created_at', { ascending: true }),
      ])
      setQuestions(questionsData || [])
      setPanelists(panelistsData || [])
      setLoading(false)
    } catch (err: any) {
      if (err.message?.includes('lock')) return
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: Question['status']) {
    const supabase = createClient()
    if (status === 'on_screen') {
      await supabase.from('questions').update({ status: 'approved' }).eq('event_id', event!.id).eq('status', 'on_screen')
    }
    await supabase.from('questions').update({ status }).eq('id', id)
  }

  async function assignPanelist(questionId: string, panelistId: string | null) {
    const supabase = createClient()
    await supabase.from('questions').update({ assigned_panelist_id: panelistId }).eq('id', questionId)
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
      .insert({ event_id: event.id, name: newPanelistName.trim(), title: newPanelistTitle.trim() || null })
      .select().single()
    if (data) { setPanelists((prev) => [...prev, data]); setNewPanelistName(''); setNewPanelistTitle(''); setShowPanelistForm(false) }
    setAddingPanelist(false)
  }

  async function removePanelist(id: string) {
    const supabase = createClient()
    await supabase.from('panelists').delete().eq('id', id)
    setPanelists((prev) => prev.filter((p) => p.id !== id))
  }

  async function bulkUpdateStatus(status: Question['status']) {
    const supabase = createClient()
    await Promise.all([...selectedIds].map((id) => supabase.from('questions').update({ status }).eq('id', id)))
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ─── VOICE ────────────────────────────────────────────────────────────────

  function startVoiceQuestion() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice recognition not supported. Use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = 'en'
    recognition.continuous = true        // keep listening until manually stopped
    recognition.interimResults = true    // show words as they come in
    recognition.maxAlternatives = 3      // pick best alternative

    let accumulated = ''

    recognition.onstart = () => {
      setVoiceState('listening')
      setInterimTranscript('')
      setFinalTranscript('')
    }

    recognition.onresult = (e: any) => {
      let interim = ''
      let newFinal = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        // Pick best alternative (highest confidence)
        const best = [...Array(result.length)]
          .map((_, j) => result[j])
          .sort((a, b) => b.confidence - a.confidence)[0]

        if (result.isFinal) {
          newFinal += best.transcript + ' '
        } else {
          interim += best.transcript
        }
      }

      if (newFinal) {
        accumulated += newFinal
        setFinalTranscript(accumulated)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (e: any) => {
      // network errors are recoverable — ignore if we have something
      if (e.error === 'no-speech') return
      stopListening()
    }

    recognition.onend = () => {
      // If still in listening state, it cut off — move to review with what we have
      setVoiceState((prev) => {
        if (prev === 'listening') {
          const text = accumulated.trim()
          if (text) {
            setEditableTranscript(text)
            return 'review'
          }
          return 'idle'
        }
        return prev
      })
    }

    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setVoiceState((prev) => {
      const text = finalTranscript.trim() || interimTranscript.trim()
      if (text) {
        setEditableTranscript(text)
        return 'review'
      }
      return 'idle'
    })
    setInterimTranscript('')
  }

  function cancelVoice() {
    recognitionRef.current?.abort()
    setVoiceState('idle')
    setInterimTranscript('')
    setFinalTranscript('')
    setEditableTranscript('')
    setAskedByVoice('')
  }

  async function submitVoiceQuestion() {
    if (!editableTranscript.trim() || !event) return
    setSubmittingVoice(true)
    const supabase = createClient()
    await supabase.from('questions').insert({
      event_id: event.id,
      content: editableTranscript.trim(),
      asked_by: askedByVoice.trim() || 'Voice Question',
      source: 'voice',
      status: 'approved',
    })
    setVoiceState('idle')
    setEditableTranscript('')
    setFinalTranscript('')
    setAskedByVoice('')
    setSubmittingVoice(false)
  }

  // ──────────────────────────────────────────────────────────────────────────

  const filteredQuestions = questions
    .filter((q) => {
      if (activeTab === 'pending') return q.status === 'pending'
      if (activeTab === 'approved') return ['approved', 'on_screen'].includes(q.status)
      return true
    })
    .filter((q) =>
      !searchQuery.trim() ||
      q.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.asked_by.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const pendingCount = questions.filter((q) => q.status === 'pending').length
  const onScreenQuestion = questions.find((q) => q.status === 'on_screen')
  const nextQuestion = questions
    .filter((q) => q.status === 'approved' && q.id !== onScreenQuestion?.id)
    .sort((a, b) => b.votes - a.votes)[0] ?? null

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
          <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">{event?.event_code}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open(`/projector/${eventCode}`, '_blank')}
            className="flex items-center gap-2 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors"
          >
            <Monitor size={14} /> Open Projector
          </button>
          {event?.status === 'waiting' && (
            <button onClick={() => updateEventStatus('live')} className="flex items-center gap-2 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              <Play size={14} /> Go Live
            </button>
          )}
          {event?.status === 'live' && (
            <button onClick={() => updateEventStatus('ended')} className="flex items-center gap-2 text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
              <Square size={14} /> End Event
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
                    <button onClick={() => updateStatus(nextQuestion.id, 'on_screen')} className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors">
                      Next Question <ArrowRight size={12} />
                    </button>
                  )}
                  <button onClick={() => updateStatus(onScreenQuestion.id, 'answered')} className="flex items-center gap-1 text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                    <CheckCircle2 size={12} /> Mark Answered
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

          {/* ── VOICE QUESTION CARD ── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {voiceState === 'idle' && (
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Voice Question</p>
                  <p className="text-xs text-gray-400 mt-0.5">Capture audience audio — review before posting</p>
                </div>
                <button
                  onClick={startVoiceQuestion}
                  className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Mic size={14} /> Start Recording
                </button>
              </div>
            )}

            {voiceState === 'listening' && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <p className="text-sm font-semibold text-gray-900">Recording...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={stopListening}
                      className="flex items-center gap-2 text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <MicOff size={14} /> Stop
                    </button>
                    <button onClick={cancelVoice} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 min-h-[64px]">
                  <p className="text-sm text-gray-900 leading-relaxed">
                    {finalTranscript}
                    {interimTranscript && (
                      <span className="text-gray-400 italic">{interimTranscript}</span>
                    )}
                    {!finalTranscript && !interimTranscript && (
                      <span className="text-gray-400">Speak now...</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {voiceState === 'review' && (
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-900">Review & Edit</p>
                  <button onClick={cancelVoice} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Discard
                  </button>
                </div>
                <textarea
                  value={editableTranscript}
                  onChange={(e) => setEditableTranscript(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors resize-none mb-3"
                  placeholder="Edit the transcript if needed..."
                />
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={askedByVoice}
                    onChange={(e) => setAskedByVoice(e.target.value)}
                    placeholder="Asked by (optional)"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                  />
                  <button
                    onClick={startVoiceQuestion}
                    className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2.5 rounded-xl hover:border-gray-400 transition-colors shrink-0"
                    title="Re-record"
                  >
                    <Mic size={13} /> Re-record
                  </button>
                  <button
                    onClick={submitVoiceQuestion}
                    disabled={submittingVoice || !editableTranscript.trim()}
                    className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send size={13} /> {submittingVoice ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-gray-400 transition-colors bg-white"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {(['pending', 'approved', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedIds(new Set()) }}
                className={`text-sm px-4 py-1.5 rounded-lg transition-colors capitalize ${
                  activeTab === tab ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}{tab === 'pending' && pendingCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2.5 rounded-xl">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <button onClick={() => bulkUpdateStatus('approved')} className="text-xs bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg font-medium transition-colors">Approve all</button>
              <button onClick={() => bulkUpdateStatus('rejected')} className="text-xs bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg font-medium transition-colors">Reject all</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-white transition-colors">Clear</button>
            </div>
          )}

          {/* Question list */}
          <div className="space-y-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">No questions found.</p>
              </div>
            ) : (
              filteredQuestions.map((q) => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-1 accent-indigo-600 w-4 h-4 shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="text-sm text-gray-900 flex-1">{q.content}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {q.source === 'voice' && (
                            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                              <Mic size={10} /> voice
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
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button onClick={() => updateStatus(q.id, 'rejected')} className="flex items-center gap-1 text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-100">
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}
                          {q.status === 'approved' && (
                            <button onClick={() => updateStatus(q.id, 'on_screen')} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                              <Tv size={12} /> Send to Screen
                            </button>
                          )}
                          {q.status === 'on_screen' && (
                            <button onClick={() => updateStatus(q.id, 'answered')} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                              <CheckCircle2 size={12} /> Mark Answered
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Panelists</h2>
              <button
                onClick={() => setShowPanelistForm(!showPanelistForm)}
                className="flex items-center gap-1 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700"
              >
                <UserPlus size={12} /> Add
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
              {panelists.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No panelists yet.</p>}
              {panelists.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    {p.title && <p className="text-xs text-gray-400">{p.title}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/panelist/${eventCode}?panelist=${p.id}`)
                        setCopiedId(p.id)
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${copiedId === p.id ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {copiedId === p.id ? <Check size={10} /> : <Link size={10} />}
                      {copiedId === p.id ? 'Copied!' : 'Link'}
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