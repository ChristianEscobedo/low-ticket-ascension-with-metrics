'use client';

import React, { useState, useEffect } from 'react';
import { X, CreditCard, Shield, CheckCircle, AlertCircle, Clock, Lock } from 'lucide-react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useStripeConfig } from '@/hooks/useStripeConfig';

type ColorTheme = 'amber' | 'violet' | 'mothermode';

const COLOR_THEMES: Record<ColorTheme, {
  border: string; shadow: string; timerBg: string;
  priceGradient: string; accent: string; checkIcon: string; valueText: string;
  formBorder: string; focusBorder: string; formBtnGradient: string; formBtnHover: string;
  stripePrimary: string; confirmBorder: string; checkbox: string;
  btnActive: string; btnActiveText: string;
  innerBtnActive: string; innerBtnActiveText: string;
}> = {
  amber: {
    border: 'border-amber-500/40', shadow: 'shadow-[0_0_40px_rgba(251,191,36,0.15)]',
    timerBg: 'bg-gradient-to-r from-amber-600 to-orange-600',
    priceGradient: 'from-amber-400 to-orange-400', accent: 'text-amber-400',
    checkIcon: 'text-amber-400', valueText: 'text-amber-400',
    formBorder: 'border-amber-500/20', focusBorder: 'focus:border-amber-500/50',
    formBtnGradient: 'from-amber-500 to-orange-500', formBtnHover: 'hover:from-amber-400 hover:to-orange-400',
    stripePrimary: '#f59e0b',
    confirmBorder: 'border-amber-500/20', checkbox: 'text-amber-600 focus:ring-amber-500 accent-amber-500',
    btnActive: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]',
    btnActiveText: 'text-black',
    innerBtnActive: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]',
    innerBtnActiveText: 'text-black',
  },
  violet: {
    border: 'border-violet-500/40', shadow: 'shadow-[0_0_40px_rgba(139,92,246,0.15)]',
    timerBg: 'bg-gradient-to-r from-violet-600 to-purple-600',
    priceGradient: 'from-violet-400 to-purple-400', accent: 'text-violet-400',
    checkIcon: 'text-violet-400', valueText: 'text-violet-400',
    formBorder: 'border-violet-500/20', focusBorder: 'focus:border-violet-500/50',
    formBtnGradient: 'from-violet-500 to-purple-500', formBtnHover: 'hover:from-violet-400 hover:to-purple-400',
    stripePrimary: '#8b5cf6',
    confirmBorder: 'border-violet-500/20', checkbox: 'text-violet-600 focus:ring-violet-500 accent-violet-500',
    btnActive: 'bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 hover:from-violet-400 hover:via-purple-400 hover:to-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]',
    btnActiveText: 'text-white',
    innerBtnActive: 'bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 hover:from-violet-400 hover:via-purple-400 hover:to-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]',
    innerBtnActiveText: 'text-white',
  },
  // Editorial Warm. Brass (#A88B5C) accent over the Mode (#532B3C) plum chrome.
  mothermode: {
    border: 'border-[#A88B5C]/45', shadow: 'shadow-[0_0_40px_rgba(168,139,92,0.18)]',
    timerBg: 'bg-gradient-to-r from-[#532B3C] to-[#3D1F2D]',
    priceGradient: 'from-[#C9A86A] to-[#A88B5C]', accent: 'text-[#C9A86A]',
    checkIcon: 'text-[#C9A86A]', valueText: 'text-[#C9A86A]',
    formBorder: 'border-[#A88B5C]/25', focusBorder: 'focus:border-[#A88B5C]/55',
    formBtnGradient: 'from-[#532B3C] to-[#3D1F2D]', formBtnHover: 'hover:from-[#5f3344] hover:to-[#46243a]',
    stripePrimary: '#A88B5C',
    confirmBorder: 'border-[#A88B5C]/25', checkbox: 'text-[#A88B5C] focus:ring-[#A88B5C] accent-[#A88B5C]',
    btnActive: 'bg-gradient-to-r from-[#C9A86A] via-[#A88B5C] to-[#C9A86A] hover:from-[#d4b67d] hover:via-[#b99a6b] hover:to-[#d4b67d] shadow-[0_0_20px_rgba(168,139,92,0.3)] hover:shadow-[0_0_30px_rgba(168,139,92,0.4)]',
    btnActiveText: 'text-[#1A1816]',
    innerBtnActive: 'bg-gradient-to-r from-[#C9A86A] via-[#A88B5C] to-[#C9A86A] hover:from-[#d4b67d] hover:via-[#b99a6b] hover:to-[#d4b67d] shadow-[0_0_20px_rgba(168,139,92,0.3)] hover:shadow-[0_0_30px_rgba(168,139,92,0.4)]',
    innerBtnActiveText: 'text-[#1A1816]',
  },
};

interface OneClickCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productPrice: string;
  productAmount: number;
  onSuccess: () => void;
  features?: { name: string; value?: string }[];
  guaranteeDays?: number;
  originalPrice?: string;
  subtitle?: string;
  /** Product ID passed to Stripe metadata for entitlement granting */
  productId?: string;
  /** Additional metadata passed to the payment intent */
  paymentMetadata?: Record<string, string>;
  /** 'one_time' (default) or 'subscription' */
  billingType?: 'one_time' | 'subscription';
  /** Required when billingType='subscription'. Stripe Price ID with recurring interval. */
  stripePriceId?: string;
  /** Billing interval shown in UI when billingType='subscription' */
  subscriptionInterval?: 'monthly' | 'yearly';
  /** Color theme for the modal. Default: 'amber' */
  colorTheme?: ColorTheme;
}

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
}

// Inner payment form — must be rendered inside <Elements> to use Stripe hooks
const InnerPaymentForm: React.FC<{
  customerData: CustomerData;
  onSuccess: () => void;
  productPrice: string;
  theme: typeof COLOR_THEMES['amber'];
}> = ({ customerData, onSuccess, productPrice, theme }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setMessage('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        receipt_email: customerData.email,
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message || 'Payment failed. Please try again.');
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    } else {
      setMessage('Payment processing. Please wait...');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        id="payment-element"
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              name: `${customerData.firstName} ${customerData.lastName}`,
              email: customerData.email,
            },
          },
        }}
      />

      {message && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3">
          <div className="flex items-center text-red-400">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">{message}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className={`group relative w-full font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center text-lg overflow-hidden ${
          !isLoading && stripe && elements
            ? `${theme.innerBtnActive} ${theme.innerBtnActiveText} transform hover:scale-[1.02]`
            : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
        }`}
      >
        {!isLoading && stripe && elements && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
        )}
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            Processing Your Payment...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 mr-3" />
            Pay {productPrice}
          </>
        )}
      </button>
    </form>
  );
};

export const OneClickCheckoutModal: React.FC<OneClickCheckoutModalProps> = ({
  isOpen,
  onClose,
  productName,
  productPrice,
  productAmount,
  onSuccess,
  features,
  guaranteeDays = 60,
  originalPrice,
  subtitle,
  productId,
  paymentMetadata,
  billingType = 'one_time',
  stripePriceId,
  subscriptionInterval = 'monthly',
  colorTheme = 'amber',
}) => {
  const theme = COLOR_THEMES[colorTheme];
  const { stripePromise } = useStripeConfig();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showFallbackForm, setShowFallbackForm] = useState(false);
  const [fallbackForm, setFallbackForm] = useState({ firstName: '', lastName: '', email: '' });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    minutes: 14,
    seconds: 48
  });

  useEffect(() => {
    if (isOpen) {
      // Get customer data from localStorage (from previous purchase)
      const storedData = localStorage.getItem('customerData');
      if (storedData) {
        setCustomerData(JSON.parse(storedData));
        setShowFallbackForm(false);
      } else {
        // No stored data — show inline form to collect it
        setShowFallbackForm(true);
      }

      // Start countdown timer
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev.seconds > 0) {
            return { ...prev, seconds: prev.seconds - 1 };
          } else if (prev.minutes > 0) {
            return { minutes: prev.minutes - 1, seconds: 59 };
          } else {
            clearInterval(timer);
            return prev;
          }
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen]);

  const handleFallbackSubmit = () => {
    if (!fallbackForm.firstName || !fallbackForm.lastName || !fallbackForm.email) {
      setError('Please fill in all fields');
      return;
    }
    const data: CustomerData = { ...fallbackForm };
    setCustomerData(data);
    localStorage.setItem('customerData', JSON.stringify(data));
    setShowFallbackForm(false);
    setError('');
  };

  const handleOneClickPurchase = async () => {
    if (!customerData) {
      setShowFallbackForm(true);
      return;
    }

    if (clientSecret) {
      // Already have a payment intent — the StripePaymentForm handles confirmation
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      if (billingType === 'subscription') {
        // ── Subscription flow: redirect to Stripe Checkout ──
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'generic_subscription',
            priceId: stripePriceId,
            amount: productAmount,
            interval: subscriptionInterval === 'yearly' ? 'year' : 'month',
            productName,
            email: customerData.email,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            productId: productId || 'prod_generic',
            returnPath: window.location.pathname,
            metadata: {
              product_id: productId || 'prod_generic',
              customer_email: customerData.email,
              ...paymentMetadata,
            },
          }),
        });
        if (!response.ok) throw new Error('Failed to create subscription session');
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || 'Failed to start subscription');
        }
      } else {
        // ── One-time payment flow ──
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: productAmount,
            currency: 'usd',
            customer_data: customerData,
            product_id: productId || 'prod_fusion_system',
            one_click: true,
            metadata: {
              type: 'funnel_upsell',
              product_id: productId || 'prod_fusion_system',
              customer_email: customerData.email,
              ...paymentMetadata,
            },
          }),
        });

        if (!response.ok) throw new Error('Failed to create payment intent');

        const data = await response.json();

        if (data.status === 'succeeded') {
          onSuccess();
          return;
        } else if (data.client_secret) {
          setClientSecret(data.client_secret);
        } else {
          throw new Error(data.error || 'Failed to create payment');
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative z-10 bg-gray-950 border-2 ${theme.border} rounded-2xl max-w-lg w-full mx-4 ${theme.shadow} overflow-hidden`}>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2 z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Timer Header */}
        <div className={`${theme.timerBg} text-center py-3 px-6`}>
          <div className="flex items-center justify-center space-x-2 text-white">
            <Clock className="w-4 h-4" />
            <span className="font-bold text-sm tracking-wide">
              OFFER EXPIRES IN {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">
              {productName}
            </h2>
            <p className="text-gray-400 text-sm">
              {subtitle || (billingType === 'subscription'
                ? `Billed ${subscriptionInterval} · Cancel anytime`
                : 'One-time payment · Instant access · Lifetime updates')}
            </p>
          </div>

          {/* Pricing */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <span className={`text-5xl font-black bg-gradient-to-r ${theme.priceGradient} bg-clip-text text-transparent`}>{productPrice}</span>
              {originalPrice && (
                <span className="text-2xl text-gray-600 line-through">{originalPrice}</span>
              )}
            </div>
            <div className={`${theme.accent} font-bold text-sm`}>
              {billingType === 'subscription'
                ? `${productPrice}/${subscriptionInterval === 'yearly' ? 'yr' : 'mo'} · Cancel anytime`
                : 'One-time payment, lifetime access'}
            </div>
          </div>

          {/* Features List */}
          {features && features.length > 0 && (
            <div className="mb-6">
              <div className="space-y-2.5">
                {features.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className={`w-4 h-4 ${theme.checkIcon} mr-3 flex-shrink-0`} />
                    <span className="text-gray-300 text-sm">{item.name}</span>
                    {item.value && <span className={`ml-auto ${theme.valueText} text-xs font-bold`}>{item.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback Form — when customerData is not in localStorage */}
          {showFallbackForm && (
            <div className={`bg-white/5 border ${theme.formBorder} rounded-xl p-4 mb-5`}>
              <p className="text-white font-bold text-sm mb-3">Enter your details to continue</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={fallbackForm.firstName}
                  onChange={(e) => setFallbackForm(prev => ({ ...prev, firstName: e.target.value }))}
                  className={`bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 outline-none ${theme.focusBorder}`}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={fallbackForm.lastName}
                  onChange={(e) => setFallbackForm(prev => ({ ...prev, lastName: e.target.value }))}
                  className={`bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 outline-none ${theme.focusBorder}`}
                />
              </div>
              <input
                type="email"
                placeholder="Email Address"
                value={fallbackForm.email}
                onChange={(e) => setFallbackForm(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 outline-none ${theme.focusBorder} mb-3`}
              />
              <button
                onClick={handleFallbackSubmit}
                className={`w-full bg-gradient-to-r ${theme.formBtnGradient} ${theme.btnActiveText} font-bold py-2.5 rounded-lg text-sm ${theme.formBtnHover} transition-all`}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Stripe Payment Form — shown after payment intent is created */}
          {clientSecret && stripePromise ? (
            <div className="mb-5">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: theme.stripePrimary,
                      colorBackground: '#0a0a0a',
                      colorText: '#ffffff',
                      colorDanger: '#ef4444',
                      fontFamily: 'system-ui, sans-serif',
                      borderRadius: '12px',
                    },
                  },
                }}
              >
                <InnerPaymentForm
                  customerData={customerData!}
                  onSuccess={onSuccess}
                  productPrice={productPrice}
                  theme={theme}
                />
              </Elements>
            </div>
          ) : (
            <>
              {/* Confirmation Section */}
              <div className={`bg-white/5 border ${theme.confirmBorder} rounded-xl p-4 mb-5`}>
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="confirm-purchase"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className={`mt-1 w-5 h-5 ${theme.checkbox} bg-gray-700 border-gray-600 rounded`}
                  />
                  <label htmlFor="confirm-purchase" className="flex-1 cursor-pointer">
                    <span className="text-white font-bold text-sm">Yes, complete my purchase</span>
                    <p className="text-gray-400 text-xs mt-1">
                      {billingType === 'subscription'
                        ? `I agree to be charged ${productPrice}/${subscriptionInterval === 'yearly' ? 'year' : 'month'} for ${productName}. Cancel anytime.`
                        : `I agree to be charged ${productPrice} for ${productName}. One-time payment with instant access.`}
                    </p>
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 mb-5">
                  <div className="flex items-center text-red-400">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleOneClickPurchase}
                disabled={!isConfirmed || isProcessing}
                className={`group relative w-full font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center text-lg overflow-hidden ${
                  isConfirmed && !isProcessing
                    ? `${theme.btnActive} ${theme.btnActiveText} transform hover:scale-[1.02]`
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                }`}
              >
                {isConfirmed && !isProcessing && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                )}
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Processing Your Order...
                  </>
                ) : isConfirmed ? (
                  <>
                    <Lock className="w-5 h-5 mr-3" />
                    Complete Purchase — {productPrice}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-3" />
                    Check the box above to continue
                  </>
                )}
              </button>
            </>
          )}

          {/* Trust Badges */}
          <div className="mt-5 flex items-center justify-center space-x-6 text-gray-500 text-xs">
            <div className="flex items-center">
              <Lock className="w-3 h-3 mr-1" />
              <span>Secure Checkout</span>
            </div>
            <div className="flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              <span>Our Promise</span>
            </div>
            <div className="flex items-center">
              <CreditCard className="w-3 h-3 mr-1" />
              <span>Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
