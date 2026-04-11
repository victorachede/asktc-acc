import Link from 'next/link'
import {
  Mic, Vote, SlidersHorizontal, Monitor, Users, Zap,
  ChevronUp, Check, ArrowRight,
} from 'lucide-react'

// ── DATA ───────────────────────────────────────────────
const questions = [
  {
    text: 'How are Nigerian startups navigating the current FX crisis while still trying to scale internationally?',
    votes: 42, author: 'chidi.n',
    tags: [{ label: 'on screen', style: { background: '#eef2ff', color: '#6366f1' } }, { label: '→ amaka obi', style: { background: '#f0fdf4', color: '#16a34a' } }],
    active: true, actions: false,
  },
  {
    text: "What's the biggest mistake founders make when pitching to international VCs from an emerging market?",
    votes: 31, author: 'ngozi.a',
    tags: [{ label: 'pending', style: { background: '#f4f4f5', color: '#52525b' } }],
    active: false, actions: true,
  },
  {
    text: 'Is remote-first still viable for African startups or does in-person culture win?',
    votes: 18, author: 'emeka.o',
    tags: [{ label: 'pending', style: { background: '#f4f4f5', color: '#52525b' } }],
    active: false, actions: true,
  },
]

const features = [
  { icon: Mic, name: 'Voice questions', desc: 'Audience members speak their questions at the venue — transcribed instantly and routed to the moderator queue.' },
  { icon: Vote, name: 'Live voting', desc: 'Upvotes automatically surface the best questions. No moderator guesswork, no repetitive low-quality submissions.' },
  { icon: SlidersHorizontal, name: 'Moderator control', desc: 'Approve, reject, or assign questions to panelists — all from one screen, in real time, with no lag.' },
  { icon: Monitor, name: 'Projector screen', desc: 'A dedicated clean URL for your venue display. One question at a time. No clutter, no distraction.' },
  { icon: Users, name: 'Panelist assignment', desc: "Questions go directly to whoever should answer them. Each panelist sees only what's assigned to them." },
  { icon: Zap, name: 'Real-time everything', desc: 'Powered by Supabase Realtime. Questions, votes, and status changes happen instantly across every screen.' },
]

const steps = [
  { num: '01', title: 'Create your event', desc: 'Sign up, name your event, and get a shareable join link and a moderator dashboard in under 60 seconds. No setup, no config.' },
  { num: '02', title: 'Audience joins instantly', desc: 'Attendees scan a QR code or visit your link — no app download, no account needed. They submit and upvote questions immediately.' },
  { num: '03', title: 'You run the show', desc: 'Moderate from your phone or laptop. Approve the best questions, assign them to panelists, and push them to the projector screen.' },
]

const plans = [
  {
    name: 'FREE', price: '₦0', period: 'forever · no card needed',
    featured: false, cta: 'Get started free', href: '/auth/signup',
    features: ['1 event', '50 questions per event', '30 audience members', 'Basic Q&A flow', 'ASKTC watermark'],
  },
  {
    name: 'PRO', price: '₦15,000', period: '/month · or ₦120,000/year',
    featured: true, badge: 'most popular', cta: 'Start Pro', href: '/auth/signup',
    features: ['Unlimited events', '200 questions per event', '200 audience members', 'Voice questions', 'Panelist assignment', 'No watermark', 'Basic analytics'],
  },
  {
    name: 'ENTERPRISE', price: '₦45,000', period: '/month · or ₦360,000/year',
    featured: false, cta: 'Contact us', href: '/contact',
    features: ['Everything in Pro', 'Unlimited questions & audience', 'Custom branding', 'Multiple moderators', 'Export PDF / CSV', 'Advanced analytics', 'Dedicated support'],
  },
]

const avatars = [
  { initials: 'TK', bg: '#6366f1' }, { initials: 'AI', bg: '#ec4899' },
  { initials: 'OB', bg: '#f59e0b' }, { initials: 'JD', bg: '#14b8a6' },
  { initials: '+4', bg: '#64748b' },
]

// ── PAGE ────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main style={{ fontFamily: "'DM Sans', sans-serif", background: '#fff', color: '#0f0f0f', overflowX: 'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { -webkit-font-smoothing: antialiased; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.2); }
          50%       { box-shadow: 0 0 0 6px rgba(34,197,94,0.06); }
        }
        .fade-up { animation: fadeUp 0.55s cubic-bezier(.25,.46,.45,.94) both; }
        .d1{animation-delay:80ms} .d2{animation-delay:160ms} .d3{animation-delay:240ms}
        .d4{animation-delay:320ms} .d5{animation-delay:400ms}
        .badge-dot { animation: pulseDot 2s infinite; }

        .q-action:hover { border-color: #a1a1aa !important; color: #0f0f0f !important; }

        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .dash-grid { display: grid; grid-template-columns: 220px 1fr; min-height: 360px; }

        @media (max-width: 900px) {
          .grid-3 { grid-template-columns: 1fr; }
          .dash-grid { grid-template-columns: 1fr; }
          .hide-mobile { display: none; }
          .section-padding { padding: 64px 20px !important; }
          .hero-btns { flex-direction: column; width: 100%; align-items: center; }
          .hero-btns a { width: 100%; max-width: 320px; text-align: center; }
          .dash-sidebar { border-right: none !important; border-bottom: 1px solid #e4e4e7 !important; }
        }

        @media (max-width: 480px) {
          h1 { font-size: 38px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f4f4f5' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.14em' }}>ASKTC</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link href="/join" className="hide-mobile" style={{ fontSize: 13, color: '#52525b', padding: '6px 12px', borderRadius: 6, textDecoration: 'none' }}>Join event</Link>
            <Link href="/auth/login" style={{ fontSize: 13, color: '#52525b', padding: '6px 12px', borderRadius: 6, border: '1px solid #e4e4e7', textDecoration: 'none' }}>Login</Link>
            <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 500, color: '#fff', background: '#18181b', padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="section-padding" style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 32px 0', textAlign: 'center' }}>
        <div className="fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #e4e4e7', borderRadius: 99, padding: '5px 14px', marginBottom: 32, fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#52525b' }}>
          <span className="badge-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
          live · q&amp;a for modern events
        </div>

        <h1 className="fade-up d1" style={{ fontSize: 'clamp(36px, 5.5vw, 60px)', fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1.08, maxWidth: 680, margin: '0 auto 20px' }}>
          The Q&A layer your event{' '}
          <em style={{ color: '#6366f1', fontStyle: 'italic', fontWeight: 300 }}>has been missing</em>
        </h1>

        <p className="fade-up d2" style={{ fontSize: 16, fontWeight: 300, color: '#52525b', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 36px' }}>
          Let your audience ask, vote, and engage — while you stay in full control. Built for conferences, churches, and corporate events.
        </p>

        <div className="fade-up d3 hero-btns" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
          <Link href="/auth/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: '#fff', background: '#18181b', padding: '12px 24px', borderRadius: 10, textDecoration: 'none' }}>
            Create your first event <ArrowRight size={14} />
          </Link>
          <Link href="/join" style={{ fontSize: 14, color: '#52525b', padding: '12px 24px', borderRadius: 10, border: '1px solid #e4e4e7', textDecoration: 'none' }}>
            Join an event →
          </Link>
        </div>

        <div className="fade-up d4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 64 }}>
          <div style={{ display: 'flex' }}>
            {avatars.map((av, i) => (
              <div key={av.initials} style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #fff', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500, color: '#fff', marginLeft: i === 0 ? 0 : -7, fontFamily: "'DM Mono', monospace" }}>{av.initials}</div>
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#a1a1aa', fontFamily: "'DM Mono', monospace" }}>Trusted by 400+ organizers</span>
        </div>

        {/* Dashboard Preview */}
        <div className="fade-up d5" style={{ border: '1px solid #e4e4e7', borderRadius: 20, overflow: 'hidden', background: '#fafafa', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', borderBottom: '1px solid #e4e4e7', background: '#fff' }}>
            <div style={{ display: 'flex', gap: 4 }}>{['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}</div>
            <div style={{ flex: 1, background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 6, padding: '4px 12px', fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#a1a1aa', textAlign: 'center' }}>asktc.co/moderator/tech-summit</div>
          </div>
          <div className="dash-grid">
            <div className="dash-sidebar" style={{ background: '#fff', borderRight: '1px solid #e4e4e7', padding: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ background: '#fafafa', border: '1px solid #f4f4f5', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Lagos Tech Summit</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#a1a1aa', marginTop: 2 }}>● live</div>
              </div>
              <div className="hide-mobile">
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 500, color: '#a1a1aa', padding: '0 8px' }}>OVERVIEW</div>
                {[['Questions','34'],['Live voters','127'],['Answered','8']].map(([l,v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px' }}>
                    <span style={{ fontSize: 12, color: '#52525b' }}>{l}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {questions.map((q) => (
                <div key={q.author} style={{ background: '#fff', border: q.active ? '1.5px solid #6366f1' : '1px solid #e4e4e7', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                    <p style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>{q.text}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <ChevronUp size={14} color="#6366f1" />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500 }}>{q.votes}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#a1a1aa' }}>{q.author}</span>
                    {q.tags.map(t => (
                      <span key={t.label} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, padding: '2px 8px', borderRadius: 99, ...t.style }}>{t.label}</span>
                    ))}
                  </div>
                  {q.actions && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      {['Approve','Assign','Dismiss'].map((a, i) => (
                        <button key={a} className="q-action" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e4e4e7', background: i === 0 ? '#18181b' : '#fff', color: i === 0 ? '#fff' : '#52525b', cursor: 'pointer' }}>{a}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section-padding" style={{ background: '#fafafa', borderTop: '1px solid #f4f4f5', padding: '88px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 300, textAlign: 'center', marginBottom: 48, letterSpacing: '-0.02em' }}>Everything you need</h2>
          <div className="grid-3">
            {features.map(f => (
              <div key={f.name} style={{ background: '#fff', padding: 28, border: '1px solid #e4e4e7', borderRadius: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <f.icon size={16} color="#6366f1" strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{f.name}</p>
                <p style={{ fontSize: 13, color: '#52525b', lineHeight: 1.6, fontWeight: 300 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STEPS ── */}
      <section className="section-padding" style={{ padding: '88px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 300, textAlign: 'center', marginBottom: 48 }}>Three simple steps</h2>
          <div className="grid-3">
            {steps.map(s => (
              <div key={s.num} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6366f1' }}>{s.num}</span>
                <p style={{ fontSize: 16, fontWeight: 500 }}>{s.title}</p>
                <p style={{ fontSize: 13, color: '#52525b', lineHeight: 1.6, fontWeight: 300 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="section-padding" style={{ background: '#fafafa', borderTop: '1px solid #f4f4f5', padding: '88px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="grid-3">
            {plans.map(p => (
              <div key={p.name} style={{ background: p.featured ? '#18181b' : '#fff', border: '1px solid #e4e4e7', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column' }}>
                {p.badge && (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start', marginBottom: 14 }}>{p.badge}</span>
                )}
                <p style={{ fontSize: 10, fontWeight: 600, color: p.featured ? '#71717a' : '#a1a1aa', marginBottom: 4 }}>{p.name}</p>
                <p style={{ fontSize: 32, fontWeight: 300, color: p.featured ? '#fff' : '#0f0f0f' }}>{p.price}</p>
                <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 20 }}>{p.period}</p>
                <ul style={{ listStyle: 'none', gap: 8, display: 'flex', flexDirection: 'column', marginBottom: 24, flex: 1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ fontSize: 13, color: p.featured ? '#a1a1aa' : '#52525b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={13} color="#6366f1" strokeWidth={2} style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} style={{ textAlign: 'center', padding: '10px', borderRadius: 10, background: p.featured ? '#fff' : '#18181b', color: p.featured ? '#000' : '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #f4f4f5', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>ASKTC</span>
          <p style={{ fontSize: 11, color: '#a1a1aa', fontFamily: "'DM Mono', monospace" }}>© 2026 ASKTC · built by black sheep co.</p>
        </div>
      </footer>

    </main>
  )
}