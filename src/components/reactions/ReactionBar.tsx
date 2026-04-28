'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const EMOJIS = ['👍', '🔥', '😂', '❤️', '👏', '🤔']

interface FloatingEmoji {
  id: string
  emoji: string
  x: number
}

interface ReactionBarProps {
  eventId: string
  /** Channel name — should be unique per event */
  channelName: string
}

export function ReactionBar({ eventId, channelName }: ReactionBarProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([])
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const lastSentRef = useRef<number>(0)

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(channelName)
    channelRef.current = ch

    ch.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      spawnEmoji(payload.emoji, payload.x)
    }).subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [channelName])

  const spawnEmoji = useCallback((emoji: string, x: number) => {
    const id = `${Date.now()}-${Math.random()}`
    setFloating(prev => [...prev, { id, emoji, x }])
    setTimeout(() => setFloating(prev => prev.filter(f => f.id !== id)), 2800)
  }, [])

  async function sendReaction(emoji: string) {
    const now = Date.now()
    if (now - lastSentRef.current < 500) return // throttle: 2/sec
    lastSentRef.current = now
    const x = 10 + Math.random() * 80
    channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, x } })
    spawnEmoji(emoji, x)
  }

  return (
    <>
      {/* Floating emojis layer — absolutely positioned over the page */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floating.map(f => (
          <span
            key={f.id}
            className="absolute text-2xl select-none"
            style={{
              left: `${f.x}%`,
              bottom: '80px',
              animation: 'floatUp 2.8s ease-out forwards',
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          70%  { transform: translateY(-220px) scale(1.2); opacity: 0.9; }
          100% { transform: translateY(-320px) scale(0.8); opacity: 0; }
        }
      `}</style>

      {/* Reaction bar */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-2 shadow-lg">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-xl hover:scale-125 active:scale-110 transition-transform select-none px-1"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  )
}