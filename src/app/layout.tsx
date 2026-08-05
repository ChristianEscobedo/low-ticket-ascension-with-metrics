import { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter, Fraunces } from 'next/font/google';
import Footer from '@/components/ui/Footer';
import Navbar from '@/components/ui/Navbar';
import { Toaster } from '@/components/ui/Toasts/toaster';
import { PropsWithChildren, Suspense } from 'react';
import { getURL } from '@/utils/helpers';
import '@/styles/main.css';

// MotherMode typography: Inter for body/UI, an editorial serif for display.
// Tiempos Headline is the licensed brand face; Fraunces is the open-source
// stand-in wired here. Swap the display font when the license is in place.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700']
});

// Routes that render their own self-contained chrome (sticky CTA bar, brand
// header, custom footer) and should NOT show the boilerplate Navbar/Footer.
// Match by prefix so nested routes (checkout, upsell, success, vsl, ...) are
// covered automatically.
const CHROMELESS_PREFIXES = [
  '/',
  '/mothermode',
  '/millionaire-mindshift',
  '/optin',
  '/funnel',
  '/signin',
  '/admin',
  '/share'
];

// Chromeless is NOT the same thing as light. /admin (and the shared run views)
// are dark app surfaces; every other chromeless route is the cream "bone" brand
// canvas. Painting the body bone under /admin is what left full-bleed tools
// like /admin/reel-studio sitting on a light background wherever the app shell
// doesn't cover the viewport (overscroll, short pages, the pre-hydration
// paint). The body is the canvas, so it has to agree with the surface.
const DARK_PREFIXES = ['/admin', '/share'];

const matchesPrefix = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const isChromelessRoute = (pathname: string) =>
  matchesPrefix(pathname, CHROMELESS_PREFIXES);

const isDarkRoute = (pathname: string) => matchesPrefix(pathname, DARK_PREFIXES);

const title = 'MotherMode';
const description = 'The OS for modern motherhood.';

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
  const dark = isDarkRoute(pathname);

  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className={chromeless ? (dark ? 'bg-ink' : 'bg-bone') : 'bg-black'}>
        {!chromeless && <Navbar />}
        <main
          id="skip"
          className={
            chromeless
              ? 'min-h-dvh'
              : 'min-h-[calc(100dvh-4rem)] md:min-h-[calc(100dvh-5rem)]'
          }
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
