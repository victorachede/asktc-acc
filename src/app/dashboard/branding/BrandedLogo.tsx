type EventBranding = {
  logo_url?: string
  org_name?: string
  primary_color?: string
}

interface BrandedHeaderProps {
  branding: EventBranding | null
  fallback?: string
  /** size: 'sm' for room/mod header, 'lg' for projector */
  size?: 'sm' | 'lg'
  /** force light text (for dark projector bg) */
  light?: boolean
}

export function BrandedLogo({ branding, fallback = 'ASKTC', size = 'sm', light = false }: BrandedHeaderProps) {
  const height = size === 'lg' ? 'h-8' : 'h-6'
  const textSize = size === 'lg' ? 'text-xl' : 'text-base'

  if (branding?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding.logo_url}
        alt={branding.org_name || 'Logo'}
        className={`${height} w-auto object-contain`}
        style={{ maxWidth: 160 }}
      />
    )
  }

  const displayName = branding?.org_name || fallback
  const color = light
    ? '#ffffff'
    : (branding?.primary_color || '#111827')

  return (
    <span
      className={`font-bold tracking-tight ${textSize}`}
      style={{ color }}
    >
      {displayName}
    </span>
  )
}

/** Returns the primary color with a safe fallback */
export function usePrimaryColor(branding: EventBranding | null): string {
  return branding?.primary_color || '#111827'
}