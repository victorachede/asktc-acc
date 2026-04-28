'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateEventCode } from '@/lib/utils'
import type { Event, Subscription } from '@/types'
import Link from 'next/link'
import { Loader2, Plus, X, ExternalLink, Trash2, Radio, Zap, Download } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [exportingId, setExportingId] = useState<string | null>(null)

  async function loadDashboard() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const [{ data: eventsData }, { data: subData }] = await Promise.all([
      supabase.from('events').select('*').eq('host_id', user.id).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
    ])

    setEvents(eventsData || [])
    setSubscription(subData)
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function createEvent() {
    if (!title.trim()) return
    setCreating(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (subscription?.plan === 'free' && events.length >= 1) {
      setError('Free plan allows only 1 event. Upgrade to Pro for unlimited events.')
      setCreating(false)
      return
    }

    const event_code = generateEventCode()

    const { data, error } = await supabase
      .from('events')
      .insert({ title: title.trim(), description: description.trim() || null, event_code, host_id: user.id })
      .select()
      .single()

    if (error) { setError(error.message); setCreating(false); return }

    setEvents([data, ...events])
    setTitle('')
    setDescription('')
    setShowForm(false)
    setCreating(false)
  }

  async function deleteEvent(id: string) {
    const supabase = createClient()
    const { data: eventQuestions } = await supabase.from('questions').select('id').eq('event_id', id)
    if (eventQuestions && eventQuestions.length > 0) {
      const questionIds = eventQuestions.map((q) => q.id)
      await supabase.from('votes').delete().in('question_id', questionIds)
      await supabase.from('questions').delete().in('id', questionIds)
    }
    await supabase.from('panelists').delete().eq('event_id', id)
    await supabase.from('events').delete().eq('id', id)
    setEvents(events.filter((e) => e.id !== id))
  }

  async function exportCSV(event: Event) {
    setExportingId(event.id)
    const supabase = createClient()

    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('event_id', event.id)
      .order('votes', { ascending: false })

    if (!questions || questions.length === 0) {
      setExportingId(null)
      return
    }

    const headers = ['Question', 'Asked By', 'Votes', 'Status', 'Source', 'Email', 'Submitted At']
    const rows = questions.map((q) => [
      `"${q.content.replace(/"/g, '""')}"`,
      `"${(q.asked_by || '').replace(/"/g, '""')}"`,
      q.votes,
      q.status,
      q.source,
      q.email || '',
      new Date(q.created_at).toLocaleString(),
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/\s+/g, '_')}_${event.event_code}_questions.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportingId(null)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const isEnterprise = subscription?.plan === 'enterprise'

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-16 flex items-center justify-between sticky top-0 z-10">
        <span className="text-xl font-bold text-gray-900">ASKTC</span>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium capitalize">
            {subscription?.plan || 'free'}
          </span>
          {!isEnterprise && (
            <Link
              href="/upgrade"
              className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium hover:bg-indigo-100 transition-colors"
            >
              <Zap size={10} /> Upgrade
            </Link>
          )}
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Events</h1>
            <p className="text-sm text-gray-500 mt-1">{events.length} event{events.length !== 1 ? 's' : ''} created</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> New Event
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Create Event</h2>
              <button onClick={() => { setShowForm(false); setError('') }}>
                <X size={16} className="text-gray-400 hover:text-gray-900" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Event title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. GCK Benue 2025"
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the event"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                onClick={createEvent}
                disabled={creating || !title.trim()}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No events yet. Create your first one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{event.title}</h3>
                  {event.description && <p className="text-sm text-gray-500 mt-0.5">{event.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {event.event_code}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      event.status === 'live' ? 'bg-green-50 text-green-600'
                      : event.status === 'ended' ? 'bg-gray-100 text-gray-500'
                      : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {event.status === 'live' && <Radio size={10} className="animate-pulse" />}
                      {event.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEnterprise ? (
                    <button
                      onClick={() => exportCSV(event)}
                      disabled={exportingId === event.id}
                      className="flex items-center gap-2 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
                    >
                      <Download size={14} />
                      {exportingId === event.id ? 'Exporting...' : 'Export'}
                    </button>
                  ) : (
                    <Link
                      href="/upgrade"
                      className="flex items-center gap-2 text-sm border border-dashed border-gray-200 text-gray-400 px-4 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                      title="Upgrade to Enterprise to export"
                    >
                      <Download size={14} /> Export
                    </Link>
                  )}
                  <button
                    onClick={() => router.push(`/moderator/${event.event_code}`)}
                    className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <ExternalLink size={14} /> Moderate
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}