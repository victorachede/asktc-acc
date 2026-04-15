import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { customAlphabet } from 'nanoid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateEventCode = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  6
)

export function getVoterFingerprint(): string {
  let fp = localStorage.getItem('asktc_fp')
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem('asktc_fp', fp)
  }
  return fp
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}