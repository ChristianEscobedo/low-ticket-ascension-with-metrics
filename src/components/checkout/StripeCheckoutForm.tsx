'use client';

import React, { useState } from 'react';
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { AlertCircle, CheckCircle, CreditCard } from 'lucide-react';

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
}

type AccentColor = 'green' | 'amber' | 'violet' | 'mode';

interface StripeCheckoutFormProps {
  customerData: CustomerData;
  successUrl?: string;
  buttonText?: string;
  amount?: number; // Amount in cents for display
  accentColor?: AccentColor; // Themes the submit button + security-notice check; defaults to green for back-compat
}

// Full class strings (no interpolation) so Tailwind's JIT picks them up.
const ACCENT_STYLES: Record<AccentColor, { button: string; icon: string }> = {
  green: {
    button:
      'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 hover:shadow-green-500/25 text-white',
    icon: 'text-green-400',
  },
  amber: {
    button:
      'bg-gradient-to-r from-amber-300 to-amber-500 hover:from-amber-200 hover:to-amber-400 hover:shadow-amber-400/30 text-black',
    icon: 'text-amber-300',
  },
  violet: {
    button:
      'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 hover:shadow-violet-500/25 text-white',
    icon: 'text-violet-400',
  },
  mode: {
    button: 'bg-mode hover:bg-mode-deep hover:shadow-mode/25 text-bone',
    icon: 'text-mode',
  },
};

export const StripeCheckoutForm: React.FC<StripeCheckoutFormProps> = ({
  customerData,
  successUrl,
  buttonText,
  amount,
  accentColor = 'green',
}) => {
  const accent = ACCENT_STYLES[accentColor];
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  // ExpressCheckoutElement self-hides when no wallets are available; we mirror
  // that signal so we can swap "Or pay with card" copy in/out without flashing
  // a stray separator on devices that have no Apple/Google Pay/Link.
  const [hasExpressMethods, setHasExpressMethods] = useState(false);

  // Format amount for display
  const displayAmount = amount ? `$${(amount / 100).toFixed(2)}` : '$27.00';
  const displayButtonText = buttonText || `Complete Purchase - ${displayAmount}`;

  // Build the absolute return_url once — Stripe requires it for both the
  // PaymentElement submit path and the ExpressCheckoutElement onConfirm path.
  const buildReturnUrl = () => {
    const fallbackUrl = `${window.location.origin}/checkout/success`;
    return successUrl
      ? (successUrl.startsWith('http') ? successUrl : `${window.location.origin}${successUrl}`)
      : fallbackUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      return;
    }

    setIsLoading(true);
    setMessage('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: buildReturnUrl(),
        receipt_email: customerData.email,
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For some payment methods like iDEAL, your customer will
    // be redirected to an intermediate site first to authorize the payment, then
    // redirected to the `return_url`.
    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        setMessage(error.message || 'An unexpected error occurred.');
        setMessageType('error');
      } else {
        setMessage('An unexpected error occurred.');
        setMessageType('error');
      }
    }

    setIsLoading(false);
  };

  // Wallet one-tap path — Apple Pay / Google Pay / Link. The Express element
  // collects the wallet token and we hand off to confirmPayment which will
  // redirect to return_url on success (same terminal state as the card form).
  const handleExpressConfirm = async () => {
    if (!stripe || !elements) return;
    setIsLoading(true);
    setMessage('');
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: buildReturnUrl(),
        receipt_email: customerData.email,
      },
    });
    if (error) {
      setMessage(error.message || 'Wallet payment was cancelled or failed.');
      setMessageType('error');
    }
    setIsLoading(false);
  };

  const paymentElementOptions = {
    layout: "tabs" as const,
    defaultValues: {
      billingDetails: {
        name: `${customerData.firstName} ${customerData.lastName}`,
        email: customerData.email,
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Express Checkout — Apple Pay / Google Pay / Link one-tap. The element
          self-hides when no wallets are available; onReady reports which (if
          any) showed up so we can render the "or pay with card" divider only
          when a wallet button is actually visible. */}
      <div>
        <ExpressCheckoutElement
          onReady={({ availablePaymentMethods }) => {
            const any = Boolean(
              availablePaymentMethods && Object.values(availablePaymentMethods).some(Boolean),
            );
            setHasExpressMethods(any);
          }}
          onConfirm={handleExpressConfirm}
        />
        {hasExpressMethods && (
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-gray-500">Or pay with card</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        )}
      </div>

      {/* Payment Element */}
      <div>
        <PaymentElement
          id="payment-element"
          options={paymentElementOptions}
        />
      </div>

      {/* Error/Success Message */}
      {message && (
        <div className={`flex items-center p-4 rounded-xl ${
          messageType === 'error' 
            ? 'bg-red-900/30 border border-red-500/30 text-red-300' 
            : 'bg-green-900/30 border border-green-500/30 text-green-300'
        }`}>
          {messageType === 'error' ? (
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          )}
          <span className="text-sm">{message}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        disabled={isLoading || !stripe || !elements}
        type="submit"
        className={`w-full ${accent.button} disabled:from-gray-600 disabled:to-gray-700 disabled:text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-xl flex items-center justify-center`}
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            Processing Payment...
          </div>
        ) : (
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 mr-3" />
            {displayButtonText}
          </div>
        )}
      </button>

      {/* Security Notice */}
      <div className="text-center">
        <div className="flex items-center justify-center text-sm text-gray-400 mb-2">
          <CheckCircle className={`w-4 h-4 mr-2 ${accent.icon}`} />
          <span>Secured by Stripe - Industry-leading encryption</span>
        </div>
        <p className="text-xs text-gray-500">
          Your payment information is processed securely. We do not store credit card details.
        </p>
      </div>
    </form>
  );
};
