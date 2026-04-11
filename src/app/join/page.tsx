'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function JoinPage() {
  const router = useRouter()
  const [eventCode, setEventCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    if (!eventCode.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', eventCode.trim().toUpperCase())
      .single()

    if (error || !data) {
      setError('Event not found. Check the code and try again.')
      setLoading(false)
      return
    }

    if (data.status === 'ended') {
      setError('This event has ended.')
      setLoading(false)
      return
    }

    router.push(`/room/${eventCode.trim().toUpperCase()}`)
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link href="/" className="text-xl font-bold text-gray-900">ASKTC</Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Join an event</h1>
        <p className="text-sm text-gray-500 mb-8">
          Enter the event code given to you by the organiser.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Event code
            </label>
            <input
              type="text"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. ABC123"
              maxLength={6}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono tracking-widest outline-none focus:border-gray-400 transition-colors uppercase"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading || eventCode.length < 6}
            className="w-full bg-gray-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join Event'}
          </button>
        </div>
      </div>
    </main>
  )
}