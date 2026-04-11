'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Event, Question, Panelist } from '@/types'
import { 
  Monitor, Play, Square, Mic, CheckCircle2, 
  XCircle, UserPlus, Trash2, 
  ArrowRight, Loader2, Lock, Check, Copy, Radio, ChevronRight, X
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
  
  // Alternative Feedback States
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    loadModerator()
  }, [])

  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => setCopiedId(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [copiedId])

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
    } catch (err) {
      setLoading(false)
    }
  }

  const handleCopyLink = (panelistId: string) => {
    const url = `${window.location.origin}/panelist/${eventCode}?panelist=${panelistId}`
    navigator.clipboard.writeText(url)
    setCopiedId(panelistId)
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
    setQuestions(questions.map(q => q.id === id ? { ...q, status } : q))
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
    setDeleteConfirmId(null)
  }

  function startVoiceQuestion() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported in this browser.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-NG'
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = async (e: any) => {
      const transcript = e.results[0][0].transcript
      if (!transcript || !event) return

      const supabase = createClient()
      await supabase.from('questions').insert({
        event_id: event.id,
        content: transcript,
        asked_by: 'Voice Entry',
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
  const nextQuestion = questions.find((q) => q.status === 'approved' && q.id !== onScreenQuestion?.id)

  if (loading) return <main className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-gray-200" size={20} /></main>
  if (notAuthorized) return <main className="min-h-screen bg-white flex items-center justify-center"><div className="text-center"><Lock className="mx-auto mb-4 text-gray-400" size={24} /><h1 className="text-xl font-bold text-gray-900">Access Denied</h1></div></main>

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <nav className="bg-white border-b border-gray-100 px-6 h-16 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="font-black text-gray-900 text-lg hover:opacity-70 transition-opacity">ASKTC</button>
          <span className="text-gray-200">|</span>
          <span className="font-medium text-gray-600 truncate max-w-[150px]">{event?.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.open(`/projector/${eventCode}`, '_blank')} className="hidden md:flex items-center gap-2 text-xs font-bold border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all">
            <Monitor size={14} /> View Projector
          </button>
          {event?.status === 'waiting' ? (
            <button onClick={() => updateEventStatus('live')} className="bg-gray-900 text-white text-xs font-bold px-5 py-2 rounded-xl hover:bg-gray-800 transition-all">Go Live</button>
          ) : (
            <button onClick={() => updateEventStatus('ended')} className="bg-red-50 text-red-600 text-xs font-bold px-5 py-2 rounded-xl hover:bg-red-100 transition-all">End Event</button>
          )}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* QUESTIONS PANEL */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Active Question Display */}
          {onScreenQuestion ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                 <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full animate-pulse">
                   <Radio size={10} /> ON SCREEN
                 </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-6 pr-10 italic">"{onScreenQuestion.content}"</h2>
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">{onScreenQuestion.asked_by[0]}</div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{onScreenQuestion.asked_by}</span>
                 </div>
                 <button onClick={() => updateStatus(onScreenQuestion.id, 'answered')} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:shadow-lg transition-all">
                   <Check size={14} /> Clear Question
                 </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100/50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
               <p className="text-gray-400 font-medium italic">No questions currently on screen.</p>
            </div>
          )}

          {/* Controls Bar */}
          <div className="flex items-center gap-4">
             <button onClick={startVoiceQuestion} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm transition-all ${isListening ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'bg-white border border-gray-200 text-gray-900 hover:border-gray-400'}`}>
                <Mic size={18} /> {isListening ? 'Listening to Host...' : 'Capture Voice Question'}
             </button>
             {nextQuestion && (
               <button onClick={() => updateStatus(nextQuestion.id, 'on_screen')} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2">
                 Push Next Question <ArrowRight size={18} />
               </button>
             )}
          </div>

          {/* Filtering Tabs */}
          <div className="flex items-center gap-2 bg-gray-200/50 p-1 rounded-2xl w-fit">
            {(['pending', 'approved', 'all'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all capitalize ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab} {tab === 'pending' && pendingCount > 0 && `(${pendingCount})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-300 transition-all group">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="text-gray-800 font-semibold leading-relaxed">{q.content}</p>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black text-gray-300">VOTES</span>
                    <span className="text-sm font-black text-gray-900">▲ {q.votes}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{q.asked_by}</span>
                    <select value={q.assigned_panelist_id || ''} onChange={(e) => assignPanelist(q.id, e.target.value || null)} className="text-[10px] font-bold uppercase bg-gray-50 border-none rounded-lg px-3 py-1.5 outline-none cursor-pointer">
                      <option value="">No Assignee</option>
                      {panelists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(q.id, 'approved')} className="bg-green-50 text-green-600 p-2 rounded-xl hover:bg-green-100 transition-colors"><CheckCircle2 size={18} /></button>
                        <button onClick={() => updateStatus(q.id, 'rejected')} className="bg-red-50 text-red-400 p-2 rounded-xl hover:bg-red-100 transition-colors"><XCircle size={18} /></button>
                      </>
                    )}
                    {q.status === 'approved' && (
                      <button onClick={() => updateStatus(q.id, 'on_screen')} className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Go Live</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR: PANELISTS */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 sticky top-24 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-black text-gray-900 uppercase tracking-tighter text-lg">Panelists</h2>
              <button onClick={() => setShowPanelistForm(!showPanelistForm)} className={`p-2 rounded-full transition-all ${showPanelistForm ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {showPanelistForm ? <X size={16} /> : <UserPlus size={16} />}
              </button>
            </div>

            {showPanelistForm && (
              <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-top-4">
                <input type="text" value={newPanelistName} onChange={(e) => setNewPanelistName(e.target.value)} placeholder="Full Name" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 transition-all outline-none" />
                <button onClick={addPanelist} disabled={addingPanelist} className="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-80 disabled:opacity-50">Add Member</button>
              </div>
            )}

            <div className="space-y-6">
              {panelists.map((p) => (
                <div key={p.id} className="relative group">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900">{p.name}</p>
                    
                    {/* Double-Click Delete (Replacement for confirm alert) */}
                    <div className="flex items-center gap-1">
                       {deleteConfirmId === p.id ? (
                         <div className="flex items-center gap-1 animate-in zoom-in duration-200">
                           <button onClick={() => removePanelist(p.id)} className="bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm">CONFIRM</button>
                           <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 hover:text-gray-900"><X size={12} /></button>
                         </div>
                       ) : (
                         <button onClick={() => setDeleteConfirmId(p.id)} className="text-gray-200 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                       )}
                    </div>
                  </div>
                  
                  {/* Copy Button with localized state feedback */}
                  <button 
                    onClick={() => handleCopyLink(p.id)} 
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all border-2 ${
                      copiedId === p.id 
                        ? 'bg-green-50 border-green-200 text-green-700 scale-95' 
                        : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {copiedId === p.id ? 'Ready to share!' : 'Copy Guest Link'}
                    </span>
                    {copiedId === p.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
              {panelists.length === 0 && (
                <div className="text-center py-10 opacity-30">
                  <p className="text-xs font-bold uppercase tracking-widest">No Members</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}