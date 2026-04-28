'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Question, Poll } from '@/types'
import { BarChart2, ChevronUp, Mic, MessageSquare, TrendingUp } from 'lucide-react'

interface Props {
  eventId: string
  questions: Question[]
  polls: Poll[]
}

interface PollStat {
  poll: Poll
  votes: number[]
  total: number
}

export function EventAnalyticsTab({ eventId, questions, polls }: Props) {
  const [pollStats, setPollStats] = useState<PollStat[]>([])
  const [loadingPolls, setLoadingPolls] = useState(true)

  useEffect(() => {
    if (polls.length === 0) { setLoadingPolls(false); return }
    loadPollStats()
  }, [polls.length])

  async function loadPollStats() {
    const supabase = createClient()
    const results = await Promise.all(polls.map(async (poll) => {
      const { data } = await supabase.from('poll_votes').select('option_index').eq('poll_id', poll.id)
      const tally = Array(poll.options.length).fill(0)
      data?.forEach((v) => { if (tally[v.option_index] !== undefined) tally[v.option_index]++ })
      return { poll, votes: tally, total: tally.reduce((a, b) => a + b, 0) }
    }))
    setPollStats(results)
    setLoadingPolls(false)
  }

  const totalQuestions = questions.length
  const voiceCount = questions.filter(q => q.source === 'voice').length
  const textCount = questions.filter(q => q.source === 'text').length
  const totalVotes = questions.reduce((sum, q) => sum + (q.votes || 0), 0)
  const answeredCount = questions.filter(q => q.status === 'answered').length
  const pendingCount = questions.filter(q => q.status === 'pending').length
  const answerRate = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  const topQuestions = [...questions]
    .filter(q => ['approved', 'on_screen', 'answered'].includes(q.status))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5)

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Questions', value: totalQuestions, icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Total votes', value: totalVotes, icon: ChevronUp, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Answered', value: answeredCount, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Pending', value: pendingCount, icon: BarChart2, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-7 h-7 ${stat.bg} rounded-lg flex items-center justify-center mb-2`}>
              <stat.icon size={13} className={stat.color} />
            </div>
            <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Answer rate */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Answer rate</p>
          <span className="text-sm font-bold text-gray-900">{answerRate}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-700"
            style={{ width: `${answerRate}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{answeredCount} of {totalQuestions} questions answered</p>
      </div>

      {/* Voice vs text */}
      {totalQuestions > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Mic size={13} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Submission type</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Text', value: textCount, color: 'bg-indigo-500' },
              { label: 'Voice', value: voiceCount, color: 'bg-purple-500' },
            ].map(row => {
              const pct = totalQuestions > 0 ? Math.round((row.value / totalQuestions) * 100) : 0
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-mono text-gray-400">{row.value} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top questions */}
      {topQuestions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Top questions</p>
          <div className="space-y-2">
            {topQuestions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs font-mono text-gray-300 mt-0.5 w-4 shrink-0">#{i + 1}</span>
                <p className="text-xs text-gray-700 flex-1 leading-relaxed">{q.content}</p>
                <span className="text-xs font-mono text-indigo-500 shrink-0">▲{q.votes}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Poll results */}
      {!loadingPolls && pollStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-1.5 mb-4">
            <BarChart2 size={13} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Poll results</p>
          </div>
          <div className="space-y-5">
            {pollStats.map(({ poll, votes, total }) => (
              <div key={poll.id}>
                <p className="text-xs font-medium text-gray-700 mb-2">{poll.question}</p>
                <div className="space-y-1.5">
                  {poll.options.map((opt, i) => {
                    const pct = total > 0 ? Math.round((votes[i] / total) * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-gray-600 truncate flex-1 mr-2">{opt}</span>
                          <span className="font-mono text-gray-400 shrink-0">{votes[i]} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{total} vote{total !== 1 ? 's' : ''} · {poll.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalQuestions === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <BarChart2 className="mx-auto mb-3 text-gray-200" size={28} />
          <p className="text-sm text-gray-400">No data yet. Analytics will appear as questions come in.</p>
        </div>
      )}

    </div>
  )
}