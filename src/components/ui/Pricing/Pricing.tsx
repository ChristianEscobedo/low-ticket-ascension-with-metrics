'use client';

import Button from '@/components/ui/Button';
import LogoCloud from '@/components/ui/LogoCloud';
import type { Tables } from '@/types_db';
import { getStripe } from '@/utils/stripe/client';
import { checkoutWithStripe } from '@/utils/stripe/server';
import { getErrorRedirect } from '@/utils/helpers';
import { User } from '@supabase/supabase-js';
import cn from 'classnames';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';

type Subscription = Tables<'subscriptions'>;
type Product = Tables<'products'>;
type Price = Tables<'prices'>;
interface ProductWithPrices extends Product {
  prices: Price[];
}
interface PriceWithProduct extends Price {
  products: Product | null;
}
interface SubscriptionWithProduct extends Subscription {
  prices: PriceWithProduct | null;
}

interface ProductCourseSummary {
  id: string;
  title: string;
  short_description: string | null;
  thumbnail_url: string | null;
}

interface Props {
  user: User | null | undefined;
  products: ProductWithPrices[];
  subscription: SubscriptionWithProduct | null;
  courseSummariesByProduct?: Record<string, ProductCourseSummary[]>;
  accessibleCourseIds?: string[];
}

type BillingInterval = 'lifetime' | 'year' | 'month';

export default function Pricing({
  user,
  products,
  subscription,
  courseSummariesByProduct,
  accessibleCourseIds
}: Props) {
  const accessibleSet = new Set(accessibleCourseIds ?? []);
  const intervals = Array.from(
    new Set(
      products.flatMap((product) =>
        product?.prices?.map((price) => price?.interval)
      )
    )
  );
  const router = useRouter();
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>('month');
  const [priceIdLoading, setPriceIdLoading] = useState<string>();
  const currentPath = usePathname();

  const handleStripeCheckout = async (price: Price) => {
    setPriceIdLoading(price.id);

    if (!user) {
      setPriceIdLoading(undefined);
      return router.push('/signin/signup');
    }

    const { errorRedirect, sessionId, sessionUrl } = await checkoutWithStripe(
      price,
      currentPath
    );

    if (errorRedirect) {
      setPriceIdLoading(undefined);
      return router.push(errorRedirect);
    }

    if (!sessionId) {
      setPriceIdLoading(undefined);
      return router.push(
        getErrorRedirect(
          currentPath,
          'An unknown error occurred.',
          'Please try again later or contact a system administrator.'
        )
      );
    }

    // Newer @stripe/stripe-js removed redirectToCheckout; use the session URL.
    if (sessionUrl) {
      window.location.href = sessionUrl;
    }

    setPriceIdLoading(undefined);
  };

  if (!products.length) {
    return (
      <section className="relative bg-black overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-amber-200/[0.04] blur-3xl rounded-full pointer-events-none" />
        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8 relative">
          <p className="text-2xl font-light text-white/70 sm:text-center max-w-2xl mx-auto">
            No subscription pricing plans found. Create them in your{' '}
            <a
              className="text-amber-300 hover:text-amber-200 underline underline-offset-4"
              href="https://dashboard.stripe.com/products"
              rel="noopener noreferrer"
              target="_blank"
            >
              Stripe Dashboard
            </a>
            .
          </p>
        </div>
        <LogoCloud />
      </section>
    );
  } else {
    return (
      <section className="relative bg-black overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-amber-200/[0.04] blur-3xl rounded-full pointer-events-none" />
        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8 relative">
          <div className="sm:flex sm:flex-col sm:align-center">
            <p className="text-xs text-amber-300 font-bold uppercase tracking-[0.25em] sm:text-center mb-3">
              Pricing
            </p>
            <h1 className="text-4xl font-extrabold sm:text-center sm:text-6xl bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Choose your plan
            </h1>
            <p className="max-w-2xl m-auto mt-5 text-lg text-white/60 sm:text-center sm:text-xl font-light">
              Start free, then upgrade when you&rsquo;re ready. Every plan unlocks the
              full course library and ships with the same support.
            </p>
            <div className="relative self-center mt-8 rounded-xl p-1 flex border border-amber-200/20 bg-white/[0.03] backdrop-blur-sm">
              {intervals.includes('month') && (
                <button
                  onClick={() => setBillingInterval('month')}
                  type="button"
                  className={`${
                    billingInterval === 'month'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                      : 'text-white/60 hover:text-white'
                  } relative rounded-lg px-6 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:z-10 sm:px-8`}
                >
                  Monthly billing
                </button>
              )}
              {intervals.includes('year') && (
                <button
                  onClick={() => setBillingInterval('year')}
                  type="button"
                  className={`${
                    billingInterval === 'year'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                      : 'text-white/60 hover:text-white'
                  } relative rounded-lg px-6 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:z-10 sm:px-8`}
                >
                  Yearly billing
                </button>
              )}
            </div>
          </div>
          <div className="mt-12 space-y-0 sm:mt-16 flex flex-wrap justify-center gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
            {products.map((product) => {
              const price = product?.prices?.find(
                (price) => price.interval === billingInterval
              );
              if (!price) return null;
              const isCurrent =
                !!subscription &&
                product.name === subscription?.prices?.products?.name;
              const bundledCourses =
                courseSummariesByProduct?.[product.id] ?? [];
              const ownedCount = bundledCourses.filter((c) =>
                accessibleSet.has(c.id)
              ).length;
              const priceString = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: price.currency!,
                minimumFractionDigits: 0
              }).format((price?.unit_amount || 0) / 100);
              return (
                <div
                  key={product.id}
                  className={cn(
                    'relative flex flex-col rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-sm transition-all',
                    isCurrent
                      ? 'border-2 border-amber-500/50 shadow-[0_0_40px_rgba(251,191,36,0.15)]'
                      : 'border border-amber-200/20 hover:border-amber-200/40',
                    'flex-1 basis-1/3 max-w-xs'
                  )}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                      Current plan
                    </span>
                  )}
                  <div className="p-6">
                    <h2 className="text-2xl font-semibold leading-6 text-white">
                      {product.name}
                    </h2>
                    <p className="mt-4 text-sm text-white/60 font-light leading-relaxed min-h-[3rem]">
                      {product.description}
                    </p>
                    <p className="mt-8">
                      <span className="text-5xl font-black bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                        {priceString}
                      </span>
                      <span className="text-base font-medium text-white/50 ml-1">
                        /{billingInterval}
                      </span>
                    </p>
                    {bundledCourses.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-white/[0.06] space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
                          Includes {bundledCourses.length}{' '}
                          {bundledCourses.length === 1 ? 'course' : 'courses'}
                        </p>
                        <ul className="space-y-1.5">
                          {bundledCourses.slice(0, 4).map((c) => {
                            const owned = accessibleSet.has(c.id);
                            return (
                              <li
                                key={c.id}
                                className="flex items-start gap-2 text-sm text-white/70"
                              >
                                <span
                                  className={cn(
                                    'mt-1 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                                    owned ? 'bg-amber-400' : 'bg-white/30'
                                  )}
                                />
                                <span className="leading-snug">{c.title}</span>
                              </li>
                            );
                          })}
                          {bundledCourses.length > 4 && (
                            <li className="text-xs text-white/40 pl-3.5">
                              + {bundledCourses.length - 4} more
                            </li>
                          )}
                        </ul>
                        {user && ownedCount > 0 && (
                          <p className="text-xs text-amber-200/80 font-medium pt-1">
                            You already have access to {ownedCount} of{' '}
                            {bundledCourses.length}
                          </p>
                        )}
                      </div>
                    )}
                    <Button
                      variant="slim"
                      type="button"
                      loading={priceIdLoading === price.id}
                      onClick={() => handleStripeCheckout(price)}
                      className={cn(
                        'block w-full py-2.5 mt-8 text-sm font-bold text-center rounded-lg transition-colors',
                        isCurrent
                          ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-amber-200/30'
                          : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.2)]'
                      )}
                    >
                      {isCurrent ? 'Manage' : 'Subscribe'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <LogoCloud />
        </div>
      </section>
    );
  }
}
