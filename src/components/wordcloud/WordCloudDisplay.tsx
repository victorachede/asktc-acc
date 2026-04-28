'use client'

import { useMemo } from 'react'

interface WordCloudDisplayProps {
  words: Record<string, number>
  /** 'room' = colored on white, 'projector' = white on dark */
  theme?: 'room' | 'projector'
}

const COLORS_LIGHT = ['#111827', '#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed']
const COLORS_DARK  = ['#ffffff', '#a5b4fc', '#67e8f9', '#86efac', '#fcd34d', '#f9a8d4', '#c4b5fd']

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function WordCloudDisplay({ words, theme = 'room' }: WordCloudDisplayProps) {
  const colors = theme === 'projector' ? COLORS_DARK : COLORS_LIGHT

  const entries = useMemo(() => {
    const all = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 40)
    if (all.length === 0) return []
    const max = all[0][1]
    return shuffle(all.map(([word, count]) => ({
      word,
      count,
      size: Math.round(14 + (count / max) * 42),
      color: colors[Math.floor(Math.random() * colors.length)],
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(words), theme])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className={`text-sm ${theme === 'projector' ? 'text-gray-500' : 'text-gray-400'}`}>
          No words yet. Be the first!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center py-4 px-2">
      {entries.map(({ word, size, color }, i) => (
        <span
          key={`${word}-${i}`}
          className="transition-all duration-700 font-semibold leading-tight select-none"
          style={{ fontSize: size, color }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}