import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ASKTC — Live Q&A for Modern Events',
  description:
    'Let your audience ask, vote, and engage — while you stay in full control. Built for conferences, churches, universities, and corporate events.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}