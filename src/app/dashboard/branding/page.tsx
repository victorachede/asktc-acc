'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Subscription, EventBranding } from '@/types'
import { ArrowLeft, Upload, X, Check, Loader2, Lock, Palette } from 'lucide-react'
import Link from 'next/link'

const PRESET_COLORS = [
  '#111827', '#1d4ed8', '#7c3aed', '#db2777',
  '#dc2626', '#d97706', '#16a34a', '#0891b2',
]

export default function BrandingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [branding, setBranding] = useState<EventBranding | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // form state
  const [orgName, setOrgName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#111827')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const [{ data: subData }, { data: brandingData }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('user_id', user.id).single(),
      supabase.from('event_branding').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    setSubscription(subData)
    if (brandingData) {
      setBranding(brandingData)
      setOrgName(brandingData.org_name || '')
      setPrimaryColor(brandingData.primary_color || '#111827')
      setLogoUrl(brandingData.logo_url)
      setLogoPreview(brandingData.logo_url)
    }
    setLoading(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return }
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }

    setError('')
    setUploading(true)

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const ext = file.name.split('.').pop()
    const path = `branding/${user.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Upload failed. Make sure a "branding" storage bucket exists in Supabase.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('branding').getPublicUrl(path)
    setLogoUrl(publicUrl)
    setUploading(false)
  }

  function removeLogo() {
    setLogoUrl(null)
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      user_id: user.id,
      org_name: orgName.trim() || null,
      primary_color: primaryColor,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('event_branding')
      .upsert(payload, { onConflict: 'user_id' })

    if (upsertError) {
      setError(upsertError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </main>
    )
  }

  const isEnterprise = subscription?.plan === 'enterprise'

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">Custom Branding</span>
        {isEnterprise && (
          <span className="ml-auto text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">Enterprise</span>
        )}
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">

        {!isEnterprise && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <Lock size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Enterprise feature</p>
              <p className="text-sm text-amber-700 mb-3">Custom branding is available on the Enterprise plan. Replace the ASKTC logo with your own across rooms, projector, and moderator views.</p>
              <Link href="/upgrade" className="text-sm bg-amber-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-800 transition-colors">
                Upgrade to Enterprise
              </Link>
            </div>
          </div>
        )}

        <div className={`space-y-6 ${!isEnterprise ? 'opacity-40 pointer-events-none select-none' : ''}`}>

          {/* Logo upload */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-gray-900">Logo</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">Displayed in the room header, projector bar, and moderator view. PNG or SVG recommended.</p>

            {logoPreview ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-16 border border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain p-2" />
                </div>
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-1">Logo uploaded</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {uploading ? 'Uploading...' : 'Replace'}
                    </button>
                    <span className="text-gray-300">·</span>
                    <button onClick={removeLogo} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                      <X size={10} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                {uploading ? (
                  <Loader2 size={20} className="text-gray-400 animate-spin" />
                ) : (
                  <Upload size={20} className="text-gray-400" />
                )}
                <span className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Click to upload logo'}</span>
                <span className="text-xs text-gray-400">PNG, SVG, JPG · Max 2MB</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          {/* Org name */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Organisation name</h2>
            <p className="text-sm text-gray-500 mb-4">Shown as a fallback if no logo is uploaded, and in the projector footer.</p>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Corp"
              maxLength={60}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
            />
          </div>

          {/* Primary colour */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Palette size={15} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">Brand colour</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">Used for buttons, active states, and accent elements throughout your event room.</p>

            <div className="flex items-center gap-3 mb-4">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setPrimaryColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: primaryColor === c ? c : 'transparent',
                    boxShadow: primaryColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
                style={{ background: primaryColor }}
              />
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
                title="Custom colour"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v)
                }}
                maxLength={7}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-gray-400"
              />
              <span className="text-xs text-gray-400">hex value</span>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Preview</h2>
            <div className="rounded-xl overflow-hidden border border-gray-100">
              {/* Simulated room header */}
              <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="logo" className="h-7 object-contain" />
                  ) : (
                    <span className="font-bold text-sm" style={{ color: primaryColor }}>
                      {orgName || 'Your Organisation'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium">Live</span>
                </div>
              </div>
              {/* Simulated content */}
              <div className="bg-gray-50 p-5 space-y-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500 mb-3">Ask a question</p>
                  <div className="h-9 bg-gray-100 rounded-lg mb-3" />
                  <div
                    className="h-9 rounded-lg text-white text-xs font-medium flex items-center justify-center"
                    style={{ background: primaryColor }}
                  >
                    Submit Question
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="h-3 w-40 bg-gray-100 rounded" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                  <div
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: `${primaryColor}18`, color: primaryColor }}
                  >
                    ▲ 12
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: primaryColor }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check size={14} /> Saved!</>
            ) : (
              'Save branding'
            )}
          </button>
        </div>
      </div>
    </main>
  )
}