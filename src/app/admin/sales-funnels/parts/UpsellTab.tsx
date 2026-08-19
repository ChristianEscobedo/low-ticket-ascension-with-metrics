'use client';

import type { UpsellContent } from '@/lib/mothermode/sales/types';

import { Area, Collapse, Field, PagePreviewBar, WebhooksField, inputClass, selectClass, labelClass, linesToList, listToLines } from './ui';
import ProductPicker from './ProductPicker';

/**
 * One upsell step. Moved out of SalesFunnelEditor (was lines 1384-1544).
 *
 * Holds no state: `upsell` and `setField` both belong to the shell, so this can
 * be unmounted on tab switch without losing an edit. The subsections are
 * `Collapse` (a `<details>`), which keeps its children mounted while closed —
 * collapsing a group does not discard what you typed in it.
 */
export default function UpsellTab({
  label,
  upsell,
  setField,
  onRegenerate,
  regenBusy,
  preview,
  funnelSlug,
  stepKey,
}: {
  label: string;
  upsell: UpsellContent;
  setField: <K extends keyof UpsellContent>(key: K, value: UpsellContent[K]) => void;
  onRegenerate?: () => void;
  regenBusy?: boolean;
  /** Per-tab preview: public path + funnel publish status. */
  preview?: { path: string; status: string };
  /** Funnel slug — enables the catalog product picker. */
  funnelSlug?: string;
  /** This step's key, e.g. 'upsell2'. */
  stepKey?: 'upsell1' | 'upsell2' | 'upsell3' | 'upsell4';
}) {
  return (
    <section className="rounded-xl border border-brass/15 bg-gradient-to-br from-mode-deep/40 to-ink/70 p-4 sm:p-5 space-y-4">
      <div className="text-xs uppercase tracking-[0.2em] text-brass/80 font-semibold">{label}</div>
      {preview && <PagePreviewBar path={preview.path} status={preview.status} />}
      {onRegenerate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/25 bg-brass/[0.05] px-3 py-2">
          <p className="text-[11px] text-bone/60">Rewrite this upsell from the Build tab offer stack.</p>
          <button
            type="button"
            disabled={Boolean(regenBusy)}
            onClick={onRegenerate}
            className="rounded-lg border border-brass/30 bg-brass/[0.14] px-3 py-1.5 text-[11px] font-semibold text-brass hover:bg-brass/20 disabled:opacity-40"
          >
            {regenBusy ? 'Regenerating…' : 'Regenerate this page'}
          </button>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-bone/70"><input type="checkbox" checked={upsell.enabled} onChange={(e) => setField('enabled', e.target.checked)} /> Enable this upsell step</label>

      <Collapse title="Hook" defaultOpen>
        <Field label="Eyebrow" value={upsell.eyebrow} onChange={(v) => setField('eyebrow', v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Headline" value={upsell.headline} onChange={(v) => setField('headline', v)} />
          <Field label="Headline emphasis" value={upsell.headlineEmphasis} onChange={(v) => setField('headlineEmphasis', v)} />
        </div>
        <Field label="Headline suffix" value={upsell.headlineSuffix} onChange={(v) => setField('headlineSuffix', v)} />
        <Area label="Subheadline" value={upsell.subheadline} onChange={(v) => setField('subheadline', v)} />
      </Collapse>

      <Collapse title="Letter">
        <Area
          label="Letter paragraphs (one per line)"
          value={listToLines(upsell.letter)}
          onChange={(v) => setField('letter', linesToList(v))}
          rows={8}
        />
        <Area
          label="Legacy bullets (one per line — used when features empty)"
          value={listToLines(upsell.bullets)}
          onChange={(v) => setField('bullets', linesToList(v))}
          rows={4}
        />
      </Collapse>

      <Collapse title="Value stack">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stack eyebrow" value={upsell.stackEyebrow} onChange={(v) => setField('stackEyebrow', v)} />
          <Field label="Stack heading" value={upsell.stackHeading} onChange={(v) => setField('stackHeading', v)} />
        </div>
        <Area
          label="Features (title|description|value|core, one per line — core = yes/true)"
          value={(upsell.features || [])
            .map((f) => [f.title, f.description, f.value, f.core ? 'yes' : ''].join('|'))
            .join('\n')}
          onChange={(v) =>
            setField(
              'features',
              v
                .split('\n')
                .map((line) => {
                  const [title, description, value, core] = line.split('|').map((x) => (x || '').trim());
                  return {
                    title: title || '',
                    description: description || '',
                    value: value || '',
                    core: /^(yes|true|1|core)$/i.test(core || ''),
                    icon: 'check' as const,
                  };
                })
                .filter((f) => f.title || f.description),
            )
          }
          rows={8}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Total value label" value={upsell.totalValueLabel} onChange={(v) => setField('totalValueLabel', v)} placeholder="$497 value" />
          <Area label="Big idea" value={upsell.bigIdea} onChange={(v) => setField('bigIdea', v)} rows={2} />
        </div>
      </Collapse>

      <Collapse title="Pricing & CTAs">
        {funnelSlug && stepKey && (
          <ProductPicker
            funnelSlug={funnelSlug}
            step={stepKey}
            currentProductId={upsell.productId || undefined}
            onPick={(p) => {
              setField('productId', p.productId);
              setField('productName', p.productName);
              if (p.priceCents > 0) setField('priceCents', p.priceCents);
              if (p.stripePriceId) setField('stripePriceId', p.stripePriceId);
              setField('paymentType', p.paymentType);
              setField('billingType', p.paymentType);
              if (p.interval) setField('interval', p.interval);
              if (p.priceCents > 0) {
                setField(
                  'priceLabel',
                  `$${(p.priceCents / 100).toFixed(p.priceCents % 100 === 0 ? 0 : 2)}${p.interval === 'monthly' ? '/mo' : p.interval === 'yearly' ? '/yr' : ''}`,
                );
              }
            }}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Price label" value={upsell.priceLabel} onChange={(v) => setField('priceLabel', v)} placeholder="$97" />
          <Field label="Original price" value={upsell.originalPriceLabel} onChange={(v) => setField('originalPriceLabel', v)} placeholder="$147" />
          <div><label className={labelClass}>Price (cents)</label><input type="number" min={0} className={inputClass} value={upsell.priceCents} onChange={(e) => setField('priceCents', Number(e.target.value) || 0)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stripe Price ID" value={upsell.stripePriceId} onChange={(v) => setField('stripePriceId', v)} />
          <Field label="Product name" value={upsell.productName} onChange={(v) => setField('productName', v)} />
        </div>
        <div><label className={labelClass}>Payment type</label><select className={selectClass} value={upsell.paymentType} onChange={(e) => setField('paymentType', e.target.value)}><option value="one_time">one_time</option><option value="subscription">subscription</option></select></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Yes CTA" value={upsell.ctaYes} onChange={(v) => setField('ctaYes', v)} />
          <Field label="No CTA" value={upsell.ctaNo} onChange={(v) => setField('ctaNo', v)} />
        </div>
        <Field label="Yes link (path or URL)" value={upsell.yesHref} onChange={(v) => setField('yesHref', v)} />
      </Collapse>

      <Collapse title="Timer & guarantee">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Timer label" value={upsell.timerLabel} onChange={(v) => setField('timerLabel', v)} />
          <div><label className={labelClass}>Timer (minutes)</label><input type="number" min={0} className={inputClass} value={upsell.timerMinutes} onChange={(e) => setField('timerMinutes', Number(e.target.value) || 0)} /></div>
        </div>
        <Field label="Guarantee title" value={upsell.guaranteeTitle} onChange={(v) => setField('guaranteeTitle', v)} />
        <Area label="Guarantee body" value={upsell.guaranteeBody} onChange={(v) => setField('guaranteeBody', v)} rows={3} />
      </Collapse>

      <Collapse title="Media & gallery">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product image URL" value={upsell.imageUrl} onChange={(v) => setField('imageUrl', v)} />
          <Field label="Product video URL" value={upsell.videoUrl} onChange={(v) => setField('videoUrl', v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Video poster URL" value={upsell.mediaVideoPoster} onChange={(v) => setField('mediaVideoPoster', v)} />
          <label className="flex items-center gap-2 text-sm text-bone/70 pt-6">
            <input
              type="checkbox"
              checked={upsell.mediaVideo}
              onChange={(e) => setField('mediaVideo', e.target.checked)}
            />
            Show walkthrough video block
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Gallery eyebrow" value={upsell.galleryEyebrow} onChange={(v) => setField('galleryEyebrow', v)} />
          <Field label="Gallery aspect (e.g. aspect-[9/16])" value={upsell.galleryAspect} onChange={(v) => setField('galleryAspect', v)} />
        </div>
        <Area
          label="Gallery shots (src|alt|caption|hint, one per line)"
          value={(upsell.gallery || [])
            .map((s) => [s.src, s.alt, s.caption, s.hint].join('|'))
            .join('\n')}
          onChange={(v) =>
            setField(
              'gallery',
              v
                .split('\n')
                .map((line) => {
                  const [src, alt, caption, hint] = line.split('|').map((x) => (x || '').trim());
                  return {
                    src: src || '',
                    alt: alt || '',
                    caption: caption || '',
                    hint: hint || '',
                  };
                })
                .filter((s) => s.src || s.alt || s.caption),
            )
          }
          rows={5}
        />
      </Collapse>
      <WebhooksField value={upsell.webhooks} onChange={(v) => setField('webhooks', v)} hint="POSTed the purchase data on an upsell take — the main app, GHL, Zapier" />
    </section>
  );
}
