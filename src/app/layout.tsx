import { Metadata } from 'next';
import { headers } from 'next/headers';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { Toaster } from '@/components/ui/Toasts/toaster';
import { PropsWithChildren, Suspense } from 'react';
import { getURL } from '@/utils/helpers';
import '@/styles/main.css';

// Routes that render their own self-contained chrome (sticky CTA bar, brand
// header, custom footer) and should NOT show the boilerplate Navbar/Footer.
// Match by prefix so nested routes (checkout, upsell, success, vsl, ...) are
// covered automatically.
const CHROMELESS_PREFIXES = ['/millionaire-mindshift', '/signin', '/admin'];

const isChromelessRoute = (pathname: string) =>
  CHROMELESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const title = 'Next.js Subscription Starter';
const description = 'Brought to you by Vercel, Stripe, and Supabase.';

export const metadata: Metadata = {
  metadataBase: new URL(getURL()),
  title: title,
  description: description,
  openGraph: {
    title: title,
    description: description
  }
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const pathname = headers().get('x-pathname') ?? '';
  const chromeless = isChromelessRoute(pathname);

  return (
    <html lang="en">
      <body className="bg-black">
        {!chromeless && <Navbar />}
        <main
          id="skip"
          className="min-h-[calc(100dvh-4rem)] md:min-h[calc(100dvh-5rem)]"
        >
          {children}
        </main>
        {!chromeless && <Footer />}
        <Suspense>
          <Toaster />
        </Suspense>
      </body>
    </html>
  );
}
