'use client';

import type {
  AccessContent,
  CheckoutContent,
  SalesOptinContent,
  SuccessContent,
  VslPageContent,
} from '@/lib/mothermode/sales/types';

import {
  Area,
  Field,
  NumberField,
  PagePreviewBar,
  RegenerateBar,
  WebhooksField,
  inputClass, selectClass,
  labelClass,
  linesToList,
  listToLines,
  panelClass,
} from './ui';
import ProductPicker from './ProductPicker';

/**
 * The short page tabs: Optin, VSL, Checkout, Success, Access.
 *
 * None of these hold state — every value is read from, and written back to,
 * SalesFunnelEditor. That is what makes it safe for the shell to unmount the
 * inactive ones on tab switch instead of hiding them with CSS.
 */

interface Setter<T> {
  <K extends keyof T>(key: K, value: T[K]): void;
}

interface Common {
  onRegenerate: () => void;
  /** This page is regenerating. */
  busy?: boolean;
  /** Any job is running — blocks a second overlapping POST. */
  disabled?: boolean;
  /** Per-tab preview: public path + funnel publish status. */
  preview?: { path: string; status: string };
}

export function OptinTab({ optin, setField, onRegenerate, busy, disabled, preview }: Common & { optin: SalesOptinContent; setField: Setter<SalesOptinContent> }) {
  return (
    <section className={panelClass + ' space-y-4'}>
      {preview && <PagePreviewBar path={preview.path} status={preview.status} />}
      <RegenerateBar onRegenerate={onRegenerate} busy={busy} disabled={disabled} />
      <Field label="Eyebrow" value={optin.eyebrow} onChange={(v) => setField('eyebrow', v)} />
      <Field label="Badge" value={optin.badgeText} onChange={(v) => setField('badgeText', v)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Headline" value={optin.headline} onChange={(v) => setField('headline', v)} />
        <Field label="Emphasis (italic)" value={optin.headlineEmphasis} onChange={(v) => setField('headlineEmphasis', v)} />
        <Field label="Headline suffix" value={optin.headlineSuffix} onChange={(v) => setField('headlineSuffix', v)} />
      </div>
      <Area label="Subheadline" value={optin.subheadline} onChange={(v) => setField('subheadline', v)} />
      <Area label="Audience line" value={optin.audience} onChange={(v) => setField('audience', v)} />
      <Area label="Benefits (one per line)" value={listToLines(optin.benefits)} onChange={(v) => setField('benefits', linesToList(v))} rows={5} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Magnet title" value={optin.magnetTitle} onChange={(v) => setField('magnetTitle', v)} />
        <Field label="CTA button" value={optin.ctaText} onChange={(v) => setField('ctaText', v)} />
      </div>
      <Area label="Magnet description" value={optin.magnetDescription} onChange={(v) => setField('magnetDescription', v)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cover image URL" value={optin.coverImageUrl} onChange={(v) => setField('coverImageUrl', v)} placeholder="https:///cover.jpg" />
        <Field label="Hero video URL" value={optin.heroVideoUrl} onChange={(v) => setField('heroVideoUrl', v)} placeholder="https://youtube.com/watch?v= or .mp4" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email placeholder" value={optin.emailPlaceholder} onChange={(v) => setField('emailPlaceholder', v)} />
        <Field label="Name placeholder" value={optin.namePlaceholder} onChange={(v) => setField('namePlaceholder', v)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-bone/70">
        <input type="checkbox" checked={optin.collectName} onChange={(e) => setField('collectName', e.target.checked)} /> Collect first name
      </label>
      <Field label="Privacy note" value={optin.privacyNote} onChange={(v) => setField('privacyNote', v)} />
    </section>
  );
}

export function VslTab({ vsl, setField, onRegenerate, busy, disabled, preview }: Common & { vsl: VslPageContent; setField: Setter<VslPageContent> }) {
  return (
    <section className={panelClass + ' space-y-4'}>
      {preview && <PagePreviewBar path={preview.path} status={preview.status} />}
      <RegenerateBar onRegenerate={onRegenerate} busy={busy} disabled={disabled} />
      <Field label="Eyebrow" value={vsl.eyebrow} onChange={(v) => setField('eyebrow', v)} />
      <Field label="Headline" value={vsl.headline} onChange={(v) => setField('headline', v)} />
      <Area label="Subheadline" value={vsl.subheadline} onChange={(v) => setField('subheadline', v)} />
      <Field label="Video URL" value={vsl.videoUrl} onChange={(v) => setField('videoUrl', v)} placeholder="https://youtube.com/watch?v= or .mp4" />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="CTA reveal (seconds)" value={vsl.ctaRevealSeconds} onChange={(v) => setField('ctaRevealSeconds', v)} />
        <Field label="CTA text" value={vsl.ctaText} onChange={(v) => setField('ctaText', v)} />
      </div>
      <Field label="CTA href" value={vsl.ctaHref} onChange={(v) => setField('ctaHref', v)} placeholder="/funnel/slug/checkout" />
      <Area label="Bullets (one per line)" value={listToLines(vsl.bullets)} onChange={(v) => setField('bullets', linesToList(v))} rows={4} />
      <label className="flex items-center gap-2 text-sm text-bone/70">
        <input type="checkbox" checked={vsl.stickyPlayer} onChange={(e) => setField('stickyPlayer', e.target.checked)} /> Sticky player
      </label>
      <label className="flex items-center gap-2 text-sm text-bone/70">
        <input type="checkbox" checked={vsl.autoplay} onChange={(e) => setField('autoplay', e.target.checked)} /> Autoplay
      </label>
    </section>
  );
}

export function CheckoutTab({ checkout, setField, onRegenerate, busy, disabled, preview, funnelSlug }: Common & { checkout: CheckoutContent; setField: Setter<CheckoutContent>; funnelSlug?: string }) {
  return (
    <section className={panelClass + ' space-y-4'}>
      {preview && <PagePreviewBar path={preview.path} status={preview.status} />}
      <RegenerateBar onRegenerate={onRegenerate} busy={busy} disabled={disabled} />
      {funnelSlug && (
        <ProductPicker
          funnelSlug={funnelSlug}
          step="checkout"
          currentProductId={checkout.productId || undefined}
          onPick={(p) => {
            setField('productId', p.productId);
            setField('productName', p.productName);
            if (p.priceCents > 0) setField('priceCents', p.priceCents);
            if (p.stripePriceId) setField('stripePriceId', p.stripePriceId);
            setField('paymentType', p.paymentType);
            if (p.priceCents > 0) setField('priceLabel', `$${(p.priceCents / 100).toFixed(p.priceCents % 100 === 0 ? 0 : 2)}`);
          }}
        />
      )}
      <Field label="Eyebrow" value={checkout.eyebrow} onChange={(v) => setField('eyebrow', v)} />
      <Field label="Headline" value={checkout.headline} onChange={(v) => setField('headline', v)} />
      <Area label="Subheadline" value={checkout.subheadline} onChange={(v) => setField('subheadline', v)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Price label" value={checkout.priceLabel} onChange={(v) => setField('priceLabel', v)} placeholder="$27" />
        <NumberField label="Price (cents)" value={checkout.priceCents} onChange={(v) => setField('priceCents', v)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stripe Price ID" value={checkout.stripePriceId} onChange={(v) => setField('stripePriceId', v)} placeholder="price_" />
        <Field label="Product name" value={checkout.productName} onChange={(v) => setField('productName', v)} />
      </div>
      <Field label="Product ID" value={checkout.productId} onChange={(v) => setField('productId', v)} />
      <Field label="Product image URL" value={checkout.productImageUrl} onChange={(v) => setField('productImageUrl', v)} placeholder="Mockup / thumbnail above order card" />
      <Area label="Bullets (one per line)" value={listToLines(checkout.bullets)} onChange={(v) => setField('bullets', linesToList(v))} rows={5} />
      <Field label="Timer label" value={checkout.timerLabel || ''} onChange={(v) => setField('timerLabel', v)} />
      <Field label="Header brand" value={checkout.brandLabel || ''} onChange={(v) => setField('brandLabel', v)} />
      <Field label="CTA text" value={checkout.ctaText} onChange={(v) => setField('ctaText', v)} />
      <Area label="Guarantee text" value={checkout.guaranteeText} onChange={(v) => setField('guaranteeText', v)} rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className={labelClass}>Payment type</label>
          <select className={selectClass} value={checkout.paymentType} onChange={(e) => setField('paymentType', e.target.value)}>
            <option value="one_time">one_time</option>
            <option value="subscription">subscription</option>
          </select>
        </div>
        <NumberField label="Trial days" value={checkout.trialDays} onChange={(v) => setField('trialDays', v)} />
      </div>
      <WebhooksField value={checkout.webhooks} onChange={(v) => setField('webhooks', v)} hint="POSTed the purchase data on a checkout sale — the main app, GHL, Zapier" />
    </section>
  );
}

export function SuccessTab({ success, setField, onRegenerate, busy, disabled, preview }: Common & { success: SuccessContent; setField: Setter<SuccessContent> }) {
  return (
    <section className={panelClass + ' space-y-4'}>
      {preview && <PagePreviewBar path={preview.path} status={preview.status} />}
      <RegenerateBar onRegenerate={onRegenerate} busy={busy} disabled={disabled} />
      <Field label="Headline" value={success.headline} onChange={(v) => setField('headline', v)} />
      <Area label="Subheadline" value={success.subheadline} onChange={(v) => setField('subheadline', v)} />
      <Field label="Purchase summary" value={success.purchaseSummary} onChange={(v) => setField('purchaseSummary', v)} />
      <Area
        label="Delivery cards (title|description|href|icon, one per line)"
        value={success.deliveryCards.map((c) => c.title + '|' + c.description + '|' + c.href + '|' + c.icon).join('\n')}
        onChange={(v) =>
          setField(
            'deliveryCards',
            v
              .split('\n')
              .map((line) => {
                const [title, description, href, icon] = line.split('|').map((s) => s.trim());
                return { title: title || '', description: description || '', href: href || '', icon: icon || 'check' };
              })
              .filter((c) => c.title || c.description),
          )
        }
        rows={5}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CTA text" value={success.ctaText} onChange={(v) => setField('ctaText', v)} />
        <Field label="CTA href" value={success.ctaHref} onChange={(v) => setField('ctaHref', v)} placeholder="/funnel/slug/access" />
      </div>
      <Field label="Support email" value={success.supportEmail} onChange={(v) => setField('supportEmail', v)} />
      <Area label="Secondary note" value={success.secondaryNote} onChange={(v) => setField('secondaryNote', v)} rows={2} />
    </section>
  );
}

export function AccessTab({ access, setField, onRegenerate, busy, disabled, preview }: Common & { access: AccessContent; setField: Setter<AccessContent> }) {
  return (
    <section className={panelClass + ' space-y-4'}>
      {preview && <PagePreviewBar path={preview.path} status={preview.status} />}
      <RegenerateBar onRegenerate={onRegenerate} busy={busy} disabled={disabled} />
      <Field label="Headline" value={access.headline} onChange={(v) => setField('headline', v)} />
      <Area label="Subheadline" value={access.subheadline} onChange={(v) => setField('subheadline', v)} />
      <Area
        label="Onboarding items (title|description|href, one per line)"
        value={access.onboardingItems.map((i) => i.title + '|' + i.description + '|' + i.href).join('\n')}
        onChange={(v) =>
          setField(
            'onboardingItems',
            v
              .split('\n')
              .map((line) => {
                const [title, description, href] = line.split('|').map((s) => s.trim());
                return { title: title || '', description: description || '', href: href || '' };
              })
              .filter((i) => i.title || i.description),
          )
        }
        rows={5}
      />
      <Area
        label="Delivery links (label|href|description, one per line)"
        value={access.deliveryLinks.map((l) => l.label + '|' + l.href + '|' + l.description).join('\n')}
        onChange={(v) =>
          setField(
            'deliveryLinks',
            v
              .split('\n')
              .map((line) => {
                const [label, href, description] = line.split('|').map((s) => s.trim());
                return { label: label || '', href: href || '', description: description || '' };
              })
              .filter((l) => l.label || l.href),
          )
        }
        rows={6}
      />
      <Field label="Welcome video URL" value={access.welcomeVideoUrl} onChange={(v) => setField('welcomeVideoUrl', v)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Community link" value={access.communityHref} onChange={(v) => setField('communityHref', v)} />
        <Field label="Community label" value={access.communityLabel} onChange={(v) => setField('communityLabel', v)} />
      </div>
      <Field label="Support email" value={access.supportEmail} onChange={(v) => setField('supportEmail', v)} />
    </section>
  );
}
