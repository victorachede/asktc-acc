import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('paddle-signature') || ''

    // Verify webhook signature
    const [tsEntry, h1Entry] = signature.split(';')
    const ts = tsEntry?.split('=')?.[1]
    const h1 = h1Entry?.split('=')?.[1]

    if (!ts || !h1) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const signedPayload = `${ts}:${rawBody}`
    const expectedHash = crypto
      .createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET!)
      .update(signedPayload)
      .digest('hex')

    if (expectedHash !== h1) {
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    const eventType = event.event_type

    // Only handle successful subscription activations
    if (eventType !== 'subscription.activated' && eventType !== 'transaction.completed') {
      return NextResponse.json({ received: true })
    }

    const customData = event.data?.custom_data
    const userId = customData?.user_id
    const plan = customData?.plan
    const cycle = customData?.cycle

    if (!userId || !plan || !cycle) {
      return NextResponse.json({ error: 'Missing custom data' }, { status: 400 })
    }

    const supabase = await createClient()

    // Update subscription
    await supabase
      .from('subscriptions')
      .update({
        plan,
        billing_cycle: cycle,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + (cycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    // Log payment
    await supabase.from('payments').insert({
      user_id: userId,
      amount: event.data?.details?.totals?.total || 0,
      plan,
      billing_cycle: cycle,
      status: 'success',
      paystack_reference: event.data?.id || null,
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}