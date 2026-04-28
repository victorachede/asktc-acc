import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { EventBranding } from '@/types'

export function useBranding(hostId: string | null | undefined) {
  const [branding, setBranding] = useState<EventBranding | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hostId) { setLoading(false); return }
    const supabase = createClient()
    supabase
      .from('event_branding')
      .select('*')
      .eq('user_id', hostId)
      .maybeSingle()
      .then(({ data }) => {
        setBranding(data)
        setLoading(false)
      })
  }, [hostId])

  return { branding, loading }
}