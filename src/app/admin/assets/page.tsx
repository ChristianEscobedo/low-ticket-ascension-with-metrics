import { OFFERS, getOffer } from '@/lib/mothermode/offers';
import {
  mothermodeOS,
  osAnnualUpgrade,
  redesignVault,
  motherModeCoaching
} from '@/lib/mothermode/ascension';
import { DELIVERABLE_CATALOG } from '@/lib/mothermode/deliverables/index';
import AssetHub, { type AssetGroup } from './AssetHub';

export const dynamic = 'force-dynamic';

// The flagship $7 offer also serves as the site home at /.
const FLAGSHIP_SLUG = 'brain-dump-system';

// The flagship content hub lives at /mothermode/content; every other offer has
// its own per-slug view of the shared library.
const contentHref = (slug: string) =>
  slug === FLAGSHIP_SLUG
    ? '/mothermode/content'
    : `/mothermode/content/${slug}`;

export default function AssetHubPage() {
  const salesPages = OFFERS.map((o) => ({
    label: o.name,
    href: `/mothermode/${o.slug}`,
    content: contentHref(o.slug),
    note:
      o.slug === FLAGSHIP_SLUG ? 'Flagship' : o.ready ? undefined : 'Draft'
  }));

  const groups: AssetGroup[] = [
    {
      title: 'Sales pages',
      description:
        'The front-end offer pages. The flagship also serves as the site home at /.',
      items: [
        {
          label: 'Home (flagship sales page)',
          href: '/',
          content: '/mothermode/content',
          note: 'Home'
        },
        ...salesPages
      ]
    },
    {
      title: 'Assets',
      description:
        'The internal content hub for each offer: organic posts and paid ads, copy-ready. One page per offer.',
      items: OFFERS.map((o) => ({
        label: o.name,
        href: contentHref(o.slug),
        note:
          o.slug === FLAGSHIP_SLUG ? 'Flagship' : o.ready ? undefined : 'Draft'
      }))
    },
    {
      title: 'Upsells',
      description: 'The post-purchase ascension sequence, in order.',
      items: [
        {
          label: 'MotherMode OS (monthly)',
          href: '/mothermode/upsell',
          note: `OTO1 · ${mothermodeOS.priceLabel}`
        },
        {
          label: 'OS annual upgrade',
          href: '/mothermode/upsell-2',
          note: `OTO2 · ${osAnnualUpgrade.priceLabel}`
        },
        {
          label: 'The Redesign Vault',
          href: '/mothermode/upsell-3',
          note: `OTO3 · ${redesignVault.priceLabel}`
        },
        {
          label: 'MotherMode Coaching',
          href: '/mothermode/upsell-4',
          note: `OTO4 · ${motherModeCoaching.priceLabel}`
        }
      ]
    },
    {
      title: 'Sequence',
      description: 'The follow-up email sequence for each upsell. To be written.',
      items: [
        { label: 'MotherMode OS (monthly) email', note: 'OTO1', planned: true },
        { label: 'OS annual upgrade email', note: 'OTO2', planned: true },
        { label: 'The Redesign Vault email', note: 'OTO3', planned: true },
        { label: 'MotherMode Coaching email', note: 'OTO4', planned: true }
      ]
    },
    {
      title: 'Funnel pages',
      description:
        'Checkout, content, and post-purchase pages buyers move through.',
      items: [
        { label: 'Content hub', href: '/mothermode/content' },
        { label: 'Checkout', href: '/mothermode/checkout' },
        { label: 'Success / thank you', href: '/mothermode/success' }
      ]
    },
    {
      title: 'App & admin',
      description: 'The member-facing app and this dashboard.',
      items: [
        { label: 'Admin dashboard', href: '/admin' },
        { label: 'Courses', href: '/courses' },
        { label: 'Account', href: '/account' },
        { label: 'Sign in', href: '/signin' }
      ]
    },
    {
      title: 'Deliverables',
      description:
        'Every long-form resource document a buyer receives after checkout, grouped by offer. Open the live page, or jump into /admin/deliverables to edit its copy.',
      items: DELIVERABLE_CATALOG.map((doc) => ({
        label: `${getOffer(doc.slug)?.name ?? doc.slug} — ${doc.title}`,
        href: `/mothermode/resource/${doc.slug}/${doc.key}`,
        content: `/admin/deliverables?slug=${doc.slug}`,
        note: doc.slug === FLAGSHIP_SLUG ? 'Flagship' : undefined
      }))
    },
    {
      title: 'Organic Content',
      description: 'Weekly organic content plan. To be organized.',
      items: Array.from({ length: 12 }, (_, i) => ({
        label: `Week ${i + 1}`,
        planned: true
      }))
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Reference
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Asset hub
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Every important link in one place: sales pages, upsells, content, and
          the app. Open a page in a new tab or copy its full URL to share.
        </p>
      </div>
      <AssetHub groups={groups} />
    </div>
  );
}
