'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getVoterFingerprint } from '@/lib/utils'

interface WordCloudFormProps {
  eventId: string
  onSubmit?: (word: string) => void
  disabled?: boolean
}

export function WordCloudForm({ eventId, onSubmit, disabled }: WordCloudFormProps) {
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    const word = input.trim().toLowerCase().replace(/[^a-z0-9À-ÿ\s'-]/gi, '').slice(0, 30)
    if (!word || word.split(/\s+/).length > 3) {
      setError('Please enter 1–3 words')
      return
    }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const fp = getVoterFingerprint()

    // Prevent duplicate submissions from same fingerprint for this event
    const { count } = await supabase
      .from('word_cloud_entries')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('voter_fingerprint', fp)

    if (count && count >= 3) {
      setError("You've already submitted 3 words for this activity")
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('word_cloud_entries').insert({
      event_id: eventId,
      word: word.trim(),
      voter_fingerprint: fp,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      onSubmit?.(word)
      setInput('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2000)
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Type 1–3 words…"
          maxLength={40}
          disabled={disabled || submitting}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || submitting || !input.trim()}
          className="bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {submitting ? '…' : submitted ? '✓' : 'Add'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {submitted && <p className="text-xs text-green-600">Word added!</p>}
    </div>
  )
}