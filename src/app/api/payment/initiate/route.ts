import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PADDLE_API = 'https://sandbox-api.paddle.com'

const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly: process.env.PADDLE_PRICE_PRO_MONTHLY!,
    yearly: process.env.PADDLE_PRICE_PRO_YEARLY!,
  },
  enterprise: {
    monthly: process.env.PADDLE_PRICE_ENTERPRISE_MONTHLY!,
    yearly: process.env.PADDLE_PRICE_ENTERPRISE_YEARLY!,
  },
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan, cycle } = await req.json()

    console.log('Paddle initiate:', {
      plan,
      cycle,
      priceId: PRICE_IDS[plan]?.[cycle],
      apiKeySet: process.env.PADDLE_API_KEY ? 'yes' : 'MISSING',
    })

    if (!plan || !cycle || !PRICE_IDS[plan]?.[cycle]) {
      return NextResponse.json({ error: 'Invalid plan or cycle' }, { status: 400 })
    }

    const priceId = PRICE_IDS[plan][cycle]

    const response = await fetch(`${PADDLE_API}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        customer: { email: user.email },
        custom_data: {
          user_id: user.id,
          plan,
          cycle,
        },
      }),
    })

const data = await response.json()
console.log('Full Paddle response:', JSON.stringify(data.data, null, 2))
    if (!response.ok) {
      console.error('Paddle error:', JSON.stringify(data, null, 2))
      return NextResponse.json({ error: 'Payment initiation failed', detail: data }, { status: 500 })
    }

    const checkoutUrl = data.data?.checkout?.url
    console.log('Checkout URL:', checkoutUrl)

    if (!checkoutUrl) {
      console.error('No checkout URL in response:', JSON.stringify(data, null, 2))
      return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 })
    }

    return NextResponse.json({ url: checkoutUrl })
  } catch (err) {
    console.error('Initiate error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}