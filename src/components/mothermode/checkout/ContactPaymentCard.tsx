'use client';

import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { AlertCircle, Lock, ShieldCheck } from 'lucide-react';
import { StripeCheckoutForm } from '@/components/checkout/StripeCheckoutForm';
import { formatPrice } from '@/lib/mothermode/format';

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
}

interface ContactPaymentCardProps {
  customerData: CustomerData;
  onCustomerChange: (data: CustomerData) => void;
  clientSecret: string;
  isPreparing: boolean;
  error: string;
  onContinue: () => void;
  stripePromise: Promise<Stripe | null> | null;
  successUrl: string;
  totalCents: number;
}

const FIELD =
  'w-full rounded-xl border border-ink/15 bg-white px-4 py-3.5 text-ink placeholder-ink/35 outline-none transition-all focus:border-mode focus:ring-2 focus:ring-mode/15';

export const ContactPaymentCard: React.FC<ContactPaymentCardProps> = ({
  customerData,
  onCustomerChange,
  clientSecret,
  isPreparing,
  error,
  onContinue,
  stripePromise,
  successUrl,
  totalCents,
}) => {
  const set = (patch: Partial<CustomerData>) =>
    onCustomerChange({ ...customerData, ...patch });
  const ready =
    customerData.firstName && customerData.lastName && customerData.email;
  const displayPrice = formatPrice(totalCents);

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/70 p-6 shadow-sm md:p-8">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-mode/20 bg-mode/[0.04] px-4 py-1.5 text-sm text-mode">
        <Lock className="h-4 w-4" />
        <span>Secure checkout</span>
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mode text-sm font-semibold text-bone">
              1
            </span>
            <h3 className="font-display text-xl text-ink">Your details</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              value={customerData.firstName}
              onChange={(e) => set({ firstName: e.target.value })}
              className={FIELD}
              placeholder="First name"
            />
            <input
              type="text"
              value={customerData.lastName}
              onChange={(e) => set({ lastName: e.target.value })}
              className={FIELD}
              placeholder="Last name"
            />
          </div>
          <input
            type="email"
            value={customerData.email}
            onChange={(e) => set({ email: e.target.value })}
            className={`${FIELD} mt-4`}
            placeholder="you@example.com"
          />
          <p className="mt-2 text-xs text-ink/50">
            Your access link is sent here the moment you join.
          </p>
        </div>

        <div className="border-t border-ink/10" />

        <div>
          <div className="mb-4 flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                clientSecret ? 'bg-mode text-bone' : 'bg-ink/10 text-ink/50'
              }`}
            >
              2
            </span>
            <h3 className="font-display text-xl text-ink">Payment</h3>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!clientSecret ? (
            <button
              onClick={onContinue}
              disabled={isPreparing || !ready}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-mode px-6 py-4 text-lg font-semibold text-bone transition-colors hover:bg-mode-deep disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/40"
            >
              <Lock className="h-5 w-5" />
              {isPreparing
                ? 'Preparing secure checkout...'
                : `Continue to payment: ${displayPrice}`}
            </button>
          ) : (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#532B3C',
                    colorText: '#1A1816',
                    colorBackground: '#ffffff',
                    fontFamily: 'system-ui, sans-serif',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <StripeCheckoutForm
                customerData={customerData}
                successUrl={successUrl}
                amount={totalCents}
                buttonText={`Complete purchase: ${displayPrice}`}
                accentColor="mode"
              />
            </Elements>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 border-t border-ink/10 pt-6 text-sm text-ink/55">
        <ShieldCheck className="h-4 w-4 text-mode" />
        <span>Encrypted and processed securely by Stripe</span>
      </div>
    </div>
  );
};
