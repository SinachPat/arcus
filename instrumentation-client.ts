import posthog from 'posthog-js'
import posthog from 'use client'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2026-01-30'
})

export default function CheckoutPage() {
    function handlePurchase() {
        posthog.capture('purchase_completed', { amount: 99 })
    }

    return <button onClick={handlePurchase}>Complete purchase</button>
}