// src/app/api/payment/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifyPaddleWebhook(rawBody: string, signature: string, secret: string): boolean {
  const [tspart, h1part] = signature.split(';')
  const ts = tspart.replace('ts=', '')
  const h1 = h1part.replace('h1=', '')
  const signed = `${ts}:${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('paddle-signature') || ''

  try {
    const valid = verifyPaddleWebhook(rawBody, signature, process.env.PADDLE_WEBHOOK_SECRET!)
    if (!valid) {
      console.error('Invalid Paddle webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch (err) {
    console.error('Signature verification failed:', err)
    return NextResponse.json({ error: 'Signature error' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  console.log('Paddle webhook event:', event.event_type)

  if (event.event_type === 'transaction.completed') {
    const txn = event.data
    const customData = txn.custom_data
    const userId = customData?.user_id
    const plan = customData?.plan
    const cycle = customData?.cycle

    if (!userId || !plan || !cycle) {
      console.error('Missing custom_data in transaction:', customData)
      return NextResponse.json({ error: 'Missing custom data' }, { status: 400 })
    }

    const now = new Date()
    const periodEnd = new Date(now)
    if (cycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan,
        billing_cycle: cycle,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // log payment
    await supabase.from('payments').insert({
      user_id: userId,
      amount: Math.round(txn.details.totals.total),
      plan,
      billing_cycle: cycle,
      status: 'success',
    })

    console.log(`Plan updated: user ${userId} → ${plan} (${cycle})`)
  }

  if (event.event_type === 'subscription.canceled') {
    const sub = event.data
    const userId = sub.custom_data?.user_id

    if (userId) {
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', plan: 'free', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }
  }

  return NextResponse.json({ ok: true })
}