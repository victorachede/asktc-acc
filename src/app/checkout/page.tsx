'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    Paddle: any
  }
}

function CheckoutInner() {
  const searchParams = useSearchParams()
  const txn = searchParams.get('_ptxn')

  console.log('CheckoutInner rendering, txn:', txn)

  useEffect(() => {
    console.log('txn from URL:', txn)
    console.log('client token:', process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)

    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload = () => {
      console.log('Paddle loaded, txn:', txn)
      window.Paddle.Environment.set('sandbox')
      window.Paddle.Setup({
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      })
      console.log('Paddle setup done')
      if (txn) {
        console.log('Opening checkout for:', txn)
        window.Paddle.Checkout.open({
          transactionId: txn,
          settings: {
            successUrl: `https://asktc-acc.vercel.app/dashboard?upgraded=true`,
          },
        })
      }
    }
    script.onerror = () => console.log('Paddle script failed to load')
    document.head.appendChild(script)
  }, [txn])

  return <div style={{ minHeight: '100vh', background: '#fff' }} />
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  )
}