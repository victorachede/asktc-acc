'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Subscription } from '@/types'
import { PLAN_LIMITS, PLAN_PRICES } from '@/types'
import { Check, Loader2, ArrowLeft, Zap, Building2, X } from 'lucide-react'

const PRO_FEATURES = [
  'Unlimited events',
  '200 questions per event',
  '200 audience members',
  'Voice questions',
  'Panelist assignment',
  'No ASKTC watermark',
  'Basic analytics',
]

const ENTERPRISE_FEATURES = [
  'Everything in Pro',
  'Unlimited questions & audience',
  'Custom branding',
  'Multiple moderators',
  'Export PDF / CSV',
  'Advanced analytics',
  'Dedicated support',
]

export default function UpgradePage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise' | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setSubscription(subData)
    setLoading(false)
  }

  function handleSelect(plan: 'pro' | 'enterprise') {
    if (plan === 'enterprise') {
      // Enterprise → contact flow
      window.location.href = 'mailto:hello@asktc.com?subject=Enterprise Plan Enquiry'
      return
    }
    setSelectedPlan(plan)
    setShowConfirm(true)
  }

  function formatPrice(naira: number) {
    return `₦${naira.toLocaleString('en-NG')}`
  }

  const yearlySaving = Math.round(
    ((PLAN_PRICES.pro.monthly * 12 - PLAN_PRICES.pro.yearly) / (PLAN_PRICES.pro.monthly * 12)) * 100
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-300" size={24} />
      </main>
    )
  }

  const currentPlan = subscription?.plan || 'free'

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-up { animation: fadeUp 0.45s cubic-bezier(.25,.46,.45,.94) both; }
        .d1 { animation-delay: 60ms; }
        .d2 { animation-delay: 120ms; }
        .d3 { animation-delay: 180ms; }
        .plan-card { transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s; }
        .plan-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.07); transform: translateY(-2px); }
        .toggle-pill { transition: background 0.18s; }
        .cycle-btn { transition: background 0.15s, color 0.15s; cursor: pointer; border: none; }
        .overlay { animation: fadeIn 0.2s both; }
        .modal { animation: fadeUp 0.25s cubic-bezier(.25,.46,.45,.94) both; }
        @media (max-width: 720px) {
          .plans-grid { grid-template-columns: 1fr !important; }
          .page-pad { padding: 40px 20px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #f4f4f5', height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.14em' }}>ASKTC</span>
          <span style={{ fontSize: 12, background: '#f4f4f5', color: '#52525b', padding: '3px 10px', borderRadius: 99, fontWeight: 500, textTransform: 'capitalize' }}>
            {currentPlan}
          </span>
        </div>
      </nav>

      <div className="page-pad" style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 80px' }}>

        {/* HEADER */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            upgrade your plan
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 600, color: '#0f0f0f', lineHeight: 1.15, marginBottom: 12 }}>
            Run better events.
          </h1>
          <p style={{ fontSize: 15, color: '#71717a', maxWidth: 420, margin: '0 auto' }}>
            More questions, bigger audiences, zero watermark. Pick the plan that fits your events.
          </p>
        </div>

        {/* BILLING TOGGLE */}
        <div className="fade-up d1" style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', background: '#f4f4f5', borderRadius: 10, padding: 4, gap: 4 }}>
            <button
              className="cycle-btn"
              onClick={() => setCycle('monthly')}
              style={{
                padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                background: cycle === 'monthly' ? '#fff' : 'transparent',
                color: cycle === 'monthly' ? '#0f0f0f' : '#71717a',
                boxShadow: cycle === 'monthly' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Monthly
            </button>
            <button
              className="cycle-btn"
              onClick={() => setCycle('yearly')}
              style={{
                padding: '7px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                background: cycle === 'yearly' ? '#fff' : 'transparent',
                color: cycle === 'yearly' ? '#0f0f0f' : '#71717a',
                boxShadow: cycle === 'yearly' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Yearly
              <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>
                -{yearlySaving}%
              </span>
            </button>
          </div>
        </div>

        {/* PLAN CARDS */}
        <div className="plans-grid fade-up d2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* PRO */}
          <div
            className="plan-card"
            style={{ background: '#18181b', borderRadius: 20, padding: 28, border: '1px solid #18181b', position: 'relative', overflow: 'hidden' }}
          >
            {/* most popular badge */}
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.15)', padding: '3px 10px', borderRadius: 99, display: 'inline-block', marginBottom: 16 }}>
              most popular
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Zap size={14} color="#6366f1" />
              <p style={{ fontSize: 11, fontWeight: 600, color: '#71717a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro</p>
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 34, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                {formatPrice(cycle === 'monthly' ? PLAN_PRICES.pro.monthly : Math.round(PLAN_PRICES.pro.yearly / 12))}
              </span>
              <span style={{ fontSize: 13, color: '#71717a', marginLeft: 4 }}>/month</span>
            </div>

            {cycle === 'yearly' && (
              <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>
                billed as {formatPrice(PLAN_PRICES.pro.yearly)}/year
              </p>
            )}

            <div style={{ marginBottom: 24, marginTop: cycle === 'yearly' ? 0 : 20 }}>
              {PRO_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={10} color="#6366f1" strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 13, color: '#d4d4d8' }}>{f}</span>
                </div>
              ))}
            </div>

            {currentPlan === 'pro' ? (
              <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#71717a', fontSize: 13, fontWeight: 500 }}>
                Current plan
              </div>
            ) : (
              <button
                onClick={() => handleSelect('pro')}
                style={{ width: '100%', textAlign: 'center', padding: '11px', borderRadius: 10, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                {currentPlan === 'enterprise' ? 'Downgrade to Pro' : 'Upgrade to Pro'}
              </button>
            )}
          </div>

          {/* ENTERPRISE */}
          <div
            className="plan-card"
            style={{ background: '#fff', borderRadius: 20, padding: 28, border: '1px solid #e4e4e7' }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#52525b', background: '#f4f4f5', padding: '3px 10px', borderRadius: 99, display: 'inline-block', marginBottom: 16 }}>
              enterprise
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Building2 size={14} color="#52525b" />
              <p style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Enterprise</p>
            </div>

            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 34, fontWeight: 700, color: '#0f0f0f', letterSpacing: '-0.02em' }}>
                {formatPrice(cycle === 'monthly' ? PLAN_PRICES.enterprise.monthly : Math.round(PLAN_PRICES.enterprise.yearly / 12))}
              </span>
              <span style={{ fontSize: 13, color: '#a1a1aa', marginLeft: 4 }}>/month</span>
            </div>

            {cycle === 'yearly' && (
              <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 20 }}>
                billed as {formatPrice(PLAN_PRICES.enterprise.yearly)}/year
              </p>
            )}

            <div style={{ marginBottom: 24, marginTop: cycle === 'yearly' ? 0 : 20 }}>
              {ENTERPRISE_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={10} color="#52525b" strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: 13, color: '#52525b' }}>{f}</span>
                </div>
              ))}
            </div>

            {currentPlan === 'enterprise' ? (
              <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, background: '#f4f4f5', color: '#a1a1aa', fontSize: 13, fontWeight: 500 }}>
                Current plan
              </div>
            ) : (
              <button
                onClick={() => handleSelect('enterprise')}
                style={{ width: '100%', textAlign: 'center', padding: '11px', borderRadius: 10, background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Contact us
              </button>
            )}
          </div>
        </div>

        {/* FREE PLAN REMINDER */}
        {currentPlan === 'free' && (
          <div className="fade-up d3" style={{ marginTop: 24, background: '#fff', borderRadius: 14, border: '1px solid #f4f4f5', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#0f0f0f', marginBottom: 2 }}>You're on the Free plan</p>
              <p style={{ fontSize: 12, color: '#a1a1aa' }}>1 event · 50 questions · 30 audience · ASKTC watermark</p>
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#52525b', background: '#f4f4f5', padding: '4px 10px', borderRadius: 99 }}>
              FREE
            </span>
          </div>
        )}

        {/* COMPARISON TABLE */}
        <div className="fade-up d3" style={{ marginTop: 56 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0f0f0f', marginBottom: 20 }}>Compare plans</h2>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            {[
              { label: 'Events', free: '1', pro: 'Unlimited', ent: 'Unlimited' },
              { label: 'Questions / event', free: '50', pro: '200', ent: 'Unlimited' },
              { label: 'Audience size', free: '30', pro: '200', ent: 'Unlimited' },
              { label: 'Voice questions', free: false, pro: true, ent: true },
              { label: 'Panelist assignment', free: false, pro: true, ent: true },
              { label: 'ASKTC watermark', free: true, pro: false, ent: false },
              { label: 'Analytics', free: false, pro: true, ent: true },
              { label: 'Custom branding', free: false, pro: false, ent: true },
              { label: 'Multiple moderators', free: false, pro: false, ent: true },
              { label: 'Export PDF / CSV', free: false, pro: false, ent: true },
            ].map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '13px 20px',
                  borderBottom: i < 9 ? '1px solid #f4f4f5' : 'none',
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: '#52525b' }}>{row.label}</span>
                {[row.free, row.pro, row.ent].map((val, j) => (
                  <div key={j} style={{ textAlign: 'center' }}>
                    {typeof val === 'boolean' ? (
                      val
                        ? <Check size={14} color="#22c55e" strokeWidth={2.5} style={{ margin: '0 auto' }} />
                        : <X size={14} color="#d4d4d8" strokeWidth={2} style={{ margin: '0 auto' }} />
                    ) : (
                      <span style={{ fontSize: 12, color: '#0f0f0f', fontFamily: j === 0 ? 'inherit' : "'DM Mono', monospace" }}>{val}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {/* header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '1px solid #e4e4e7', background: '#fafafa', position: 'sticky', top: 56 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature</span>
              {['Free', 'Pro', 'Enterprise'].map(p => (
                <span key={p} style={{ fontSize: 11, fontWeight: 600, color: p === 'Pro' ? '#6366f1' : '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && selectedPlan && (
        <div
          className="overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false) }}
        >
          <div
            className="modal"
            style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0f0f0f' }}>Confirm upgrade</h2>
              <button onClick={() => setShowConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 0 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f0f0f', textTransform: 'capitalize' }}>
                  {selectedPlan} plan
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0f0f0f' }}>
                  {formatPrice(cycle === 'monthly' ? PLAN_PRICES[selectedPlan].monthly : Math.round(PLAN_PRICES[selectedPlan].yearly / 12))}
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#a1a1aa' }}>/mo</span>
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#a1a1aa' }}>
                billed {cycle === 'yearly' ? `annually · ${formatPrice(PLAN_PRICES[selectedPlan].yearly)}/year` : 'monthly'}
              </span>
            </div>

            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 24, lineHeight: 1.6 }}>
              Payment gateway coming soon. We'll notify you by email when it's ready to complete your upgrade.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e4e4e7', background: '#fff', fontSize: 13, fontWeight: 500, color: '#52525b', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                style={{ flex: 2, padding: '10px', borderRadius: 10, background: '#18181b', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: 0.5 }}
                disabled
              >
                Pay {formatPrice(cycle === 'monthly' ? PLAN_PRICES[selectedPlan].monthly : PLAN_PRICES[selectedPlan].yearly)}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}