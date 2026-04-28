'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Event, Subscription } from '@/types'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, BarChart2, Mic, MessageSquare,
  ChevronUp, Users, TrendingUp, Lock, Zap
} from 'lucide-react'

interface EventStat {
  event: Event
  totalQuestions: number
  voiceQuestions: number
  textQuestions: number
  totalVotes: number
  topQuestion: { content: string; votes: number } | null
  answeredCount: number
  pollCount: number
}

export default function AnalyticsDashboardPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [stats, setStats] = useState<EventStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const [{ data: subData }, { data: eventsData }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
      supabase.from('events').select('*').eq('host_id', user.id).order('created_at', { ascending: false }),
    ])

    setSubscription(subData)

    if (!eventsData || eventsData.length === 0) { setLoading(false); return }

    const isPro = subData?.plan === 'pro' || subData?.plan === 'enterprise'
    if (!isPro) { setLoading(false); return }

    const eventStats = await Promise.all(eventsData.map(async (event) => {
      const [{ data: questions }, { data: polls }] = await Promise.all([
        supabase.from('questions').select('*').eq('event_id', event.id),
        supabase.from('polls').select('id').eq('event_id', event.id),
      ])

      const qs = questions || []
      const voice = qs.filter(q => q.source === 'voice').length
      const text = qs.filter(q => q.source === 'text').length
      const totalVotes = qs.reduce((sum: number, q: any) => sum + (q.votes || 0), 0)
      const answered = qs.filter((q: any) => q.status === 'answered').length
      const sorted = [...qs].sort((a: any, b: any) => b.votes - a.votes)
      const top = sorted[0] ? { content: sorted[0].content, votes: sorted[0].votes } : null

      return {
        event,
        totalQuestions: qs.length,
        voiceQuestions: voice,
        textQuestions: text,
        totalVotes,
        topQuestion: top,
        answeredCount: answered,
        pollCount: (polls || []).length,
      }
    }))

    setStats(eventStats)
    if (eventStats.length > 0) setSelectedEventId(eventStats[0].event.id)
    setLoading(false)
  }

  const isPro = subscription?.plan === 'pro' || subscription?.plan === 'enterprise'
  const selected = stats.find(s => s.event.id === selectedEventId) ?? null

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">Analytics</span>
        {isPro && (
          <span className="ml-auto text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium capitalize">
            {subscription?.plan}
          </span>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {!isPro && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
            <Lock size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Pro feature</p>
              <p className="text-sm text-amber-700 mb-3">Analytics are available on Pro and Enterprise plans. See question trends, vote counts, voice vs text breakdown, and more.</p>
              <Link href="/upgrade" className="text-sm bg-amber-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-800 transition-colors inline-flex items-center gap-1.5">
                <Zap size={12} /> Upgrade to Pro
              </Link>
            </div>
          </div>
        )}

        {isPro && stats.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <BarChart2 className="mx-auto mb-4 text-gray-200" size={40} />
            <p className="text-gray-400 text-sm">No events yet. Create an event to start seeing analytics.</p>
          </div>
        )}

        {isPro && stats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            {/* Event list sidebar */}
            <div className="lg:col-span-1 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Events</p>
              {stats.map(s => (
                <button
                  key={s.event.id}
                  onClick={() => setSelectedEventId(s.event.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedEventId === s.event.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <p className="text-sm font-medium truncate">{s.event.title}</p>
                  <p className={`text-xs font-mono mt-0.5 ${selectedEventId === s.event.id ? 'text-gray-400' : 'text-gray-400'}`}>
                    {s.event.event_code} · {s.totalQuestions}q
                  </p>
                </button>
              ))}
            </div>

            {/* Main analytics panel */}
            {selected && (
              <div className="lg:col-span-3 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{selected.event.title}</h1>
                    <p className="text-sm text-gray-400 font-mono mt-0.5">{selected.event.event_code}</p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                    selected.event.status === 'live' ? 'bg-green-50 text-green-600'
                    : selected.event.status === 'ended' ? 'bg-gray-100 text-gray-500'
                    : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    {selected.event.status}
                  </span>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total questions', value: selected.totalQuestions, icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                    { label: 'Total votes', value: selected.totalVotes, icon: ChevronUp, color: 'text-green-500', bg: 'bg-green-50' },
                    { label: 'Answered', value: selected.answeredCount, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Polls created', value: selected.pollCount, icon: BarChart2, color: 'text-purple-500', bg: 'bg-purple-50' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                      <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                        <stat.icon size={15} className={stat.color} />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Voice vs Text */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Mic size={15} className="text-gray-400" />
                    <h2 className="font-semibold text-gray-900">Submission type</h2>
                  </div>
                  {selected.totalQuestions === 0 ? (
                    <p className="text-sm text-gray-400">No questions submitted yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: 'Text questions', value: selected.textQuestions, color: 'bg-indigo-500' },
                        { label: 'Voice questions', value: selected.voiceQuestions, color: 'bg-purple-500' },
                      ].map(row => {
                        const pct = selected.totalQuestions > 0
                          ? Math.round((row.value / selected.totalQuestions) * 100)
                          : 0
                        return (
                          <div key={row.label}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="text-gray-600">{row.label}</span>
                              <span className="font-mono text-gray-500 text-xs">{row.value} · {pct}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${row.color} rounded-full transition-all duration-700`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Answer rate */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <TrendingUp size={15} className="text-gray-400" />
                    <h2 className="font-semibold text-gray-900">Answer rate</h2>
                  </div>
                  {selected.totalQuestions === 0 ? (
                    <p className="text-sm text-gray-400">No questions submitted yet.</p>
                  ) : (
                    <div className="flex items-end gap-6">
                      <div>
                        <p className="text-4xl font-bold text-gray-900">
                          {Math.round((selected.answeredCount / selected.totalQuestions) * 100)}%
                        </p>
                        <p className="text-sm text-gray-400 mt-1">of questions answered</p>
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.round((selected.answeredCount / selected.totalQuestions) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Top question */}
                {selected.topQuestion && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ChevronUp size={15} className="text-gray-400" />
                      <h2 className="font-semibold text-gray-900">Top question</h2>
                    </div>
                    <p className="text-gray-900 text-sm leading-relaxed mb-3">
                      {selected.topQuestion.content}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-medium">
                      <ChevronUp size={11} /> {selected.topQuestion.votes} votes
                    </span>
                  </div>
                )}

                {/* Cross-event summary if multiple events */}
                {stats.length > 1 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <Users size={15} className="text-gray-400" />
                      <h2 className="font-semibold text-gray-900">All events summary</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Total events', value: stats.length },
                        { label: 'Total questions', value: stats.reduce((s, e) => s + e.totalQuestions, 0) },
                        { label: 'Total votes cast', value: stats.reduce((s, e) => s + e.totalVotes, 0) },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}