'use client';

import type { SalesPageContent } from '@/lib/mothermode/sales/types';

import { Area, Collapse, Field, RegenerateBar, linesToList, listToLines, panelClass } from './ui';

/**
 * The long-form sales page tab. Moved out of SalesFunnelEditor (was lines
 * 1014-1212), the largest single tab body in the editor.
 *
 * Holds no state: `sales` and `setField` both belong to the shell, so this can
 * be unmounted on tab switch without losing an edit. The fourteen `<h3>` groups
 * of the original are now `Collapse` subsections (a `<details>`), which keeps
 * its children mounted while closed — collapsing a group does not discard what
 * you typed in it.
 *
 * `regenBusy` is specifically "this page is being regenerated" (it drives the
 * button text) while `disabled` is "some operation is in flight" (it drives
 * clickability). The original inline bar made that same distinction.
 */
export default function SalesTab({
  sales,
  setField,
  onRegenerate,
  regenBusy,
  disabled,
}: {
  sales: SalesPageContent;
  setField: <K extends keyof SalesPageContent>(key: K, value: SalesPageContent[K]) => void;
  onRegenerate: () => void;
  regenBusy?: boolean;
  disabled?: boolean;
}) {
  return (
    <section className={panelClass + ' space-y-6'}>
      <RegenerateBar
        onRegenerate={onRegenerate}
        busy={regenBusy}
        disabled={disabled}
        label="Rewrite this page from the Offer tab offer stack."
      />
      <p className="text-xs text-bone/50">
        Full MotherMode long-form sales page. Every field maps 1:1 into{' '}
        <code className="text-brass">MotherModeSalesPage</code> via{' '}
        <code className="text-brass">salesContentToOffer</code>. Load MotherMode defaults
        to seed from a catalog offer.
      </p>

      <Collapse title="Identity & media" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Offer name" value={sales.name} onChange={(v) => setField('name', v)} />
          <Field label="Tagline" value={sales.tagline} onChange={(v) => setField('tagline', v)} />
          <Field label="Category" value={sales.category} onChange={(v) => setField('category', v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Hero image URL" value={sales.heroImageUrl} onChange={(v) => setField('heroImageUrl', v)} placeholder="Product mockup" />
          <Field label="Hero video URL" value={sales.heroVideoUrl} onChange={(v) => setField('heroVideoUrl', v)} placeholder="VSL poster / hero video" />
          <Field label="Founder photo URL" value={sales.founderPhotoUrl} onChange={(v) => setField('founderPhotoUrl', v)} placeholder="Portrait for founder letter" />
        </div>
      </Collapse>

      <Collapse title="Hero">
        <Field label="Eyebrow" value={sales.eyebrow} onChange={(v) => setField('eyebrow', v)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Headline" value={sales.headline} onChange={(v) => setField('headline', v)} />
          <Field label="Emphasis (italic)" value={sales.headlineEmphasis} onChange={(v) => setField('headlineEmphasis', v)} />
          <Field label="Headline suffix" value={sales.headlineSuffix} onChange={(v) => setField('headlineSuffix', v)} />
        </div>
        <Area label="Subheadline" value={sales.subheadline} onChange={(v) => setField('subheadline', v)} rows={3} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Audience line" value={sales.audience} onChange={(v) => setField('audience', v)} />
          <Field label="Promise" value={sales.promise} onChange={(v) => setField('promise', v)} />
        </div>
      </Collapse>

      <Collapse title="Problem">
        <Field label="Problem heading" value={sales.problemHeading} onChange={(v) => setField('problemHeading', v)} />
        <Area label="Problem intro" value={sales.problemIntro} onChange={(v) => setField('problemIntro', v)} rows={3} />
        <Area label="Problem scene" value={sales.problemScene} onChange={(v) => setField('problemScene', v)} rows={3} />
        <Area label="Problem points (one per line)" value={listToLines(sales.problemPoints)} onChange={(v) => setField('problemPoints', linesToList(v))} rows={5} />
        <Area label="Problem cost" value={sales.problemCost} onChange={(v) => setField('problemCost', v)} rows={2} />
        <Area label="Problem body (legacy flat)" value={sales.problemBody} onChange={(v) => setField('problemBody', v)} rows={3} />
      </Collapse>

      <Collapse title="Origin story">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Origin eyebrow" value={sales.originEyebrow} onChange={(v) => setField('originEyebrow', v)} />
          <Field label="Origin heading" value={sales.originHeading} onChange={(v) => setField('originHeading', v)} />
        </div>
        <Area
          label="Origin paragraphs (blank line between)"
          value={(sales.originParagraphs || []).join('\n\n')}
          onChange={(v) => setField('originParagraphs', v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean))}
          rows={6}
        />
      </Collapse>

      <Collapse title="What it is / solution">
        <Field label="What-is heading" value={sales.whatIsHeading} onChange={(v) => setField('whatIsHeading', v)} />
        <Area
          label="What-is paragraphs (blank line between)"
          value={(sales.whatIsParagraphs || []).join('\n\n')}
          onChange={(v) => setField('whatIsParagraphs', v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean))}
          rows={5}
        />
        <Field label="Solution heading (legacy)" value={sales.solutionHeading} onChange={(v) => setField('solutionHeading', v)} />
        <Area label="Solution body (legacy)" value={sales.solutionBody} onChange={(v) => setField('solutionBody', v)} rows={3} />
      </Collapse>

      <Collapse title="Mechanism">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Mechanism eyebrow" value={sales.mechanismEyebrow} onChange={(v) => setField('mechanismEyebrow', v)} />
          <Field label="Mechanism heading" value={sales.mechanismHeading} onChange={(v) => setField('mechanismHeading', v)} />
          <Field label="Mechanism label" value={sales.mechanismLabel} onChange={(v) => setField('mechanismLabel', v)} />
        </div>
        <Area
          label="Mechanism paragraphs (blank line between)"
          value={(sales.mechanismParagraphs || []).join('\n\n')}
          onChange={(v) => setField('mechanismParagraphs', v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean))}
          rows={4}
        />
        <Area
          label="Mechanism points (title|description, one per line)"
          value={(sales.mechanismPoints || []).map((p) => p.title + '|' + p.description).join('\n')}
          onChange={(v) =>
            setField(
              'mechanismPoints',
              v
                .split('\n')
                .map((line) => {
                  const [title, ...rest] = line.split('|').map((x) => x.trim());
                  return { title: title || '', description: rest.join('|') || '' };
                })
                .filter((p) => p.title || p.description),
            )
          }
          rows={5}
        />
      </Collapse>

      <Collapse title="Inside the offer">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inside heading" value={sales.insideHeading} onChange={(v) => setField('insideHeading', v)} />
          <Field label="Inside subheading" value={sales.insideSubheading} onChange={(v) => setField('insideSubheading', v)} />
        </div>
        <Area label="Inside lead" value={sales.insideLead} onChange={(v) => setField('insideLead', v)} rows={2} />
        <Area
          label="Inside items (title|description|tag|value|outcome, one per line)"
          value={(sales.insideItems || []).map((i) => [i.title, i.description, i.tag, i.value, i.outcome].join('|')).join('\n')}
          onChange={(v) =>
            setField(
              'insideItems',
              v
                .split('\n')
                .map((line) => {
                  const [title, description, tag, value, outcome] = line.split('|').map((x) => (x || '').trim());
                  return { title: title || '', description: description || '', tag: tag || '', value: value || '', outcome: outcome || '' };
                })
                .filter((i) => i.title || i.description),
            )
          }
          rows={8}
        />
        <Field label="Features heading (legacy)" value={sales.featuresHeading} onChange={(v) => setField('featuresHeading', v)} />
        <Area label="Features titles only (legacy, one per line)" value={listToLines(sales.features)} onChange={(v) => setField('features', linesToList(v))} rows={5} />
      </Collapse>

      <Collapse title="Method">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Method heading" value={sales.methodHeading} onChange={(v) => setField('methodHeading', v)} />
          <Field label="Method subheading" value={sales.methodSubheading} onChange={(v) => setField('methodSubheading', v)} />
        </div>
        <Area
          label="Method steps (number|title|description|meta|shift, one per line)"
          value={(sales.methodSteps || []).map((st) => [st.number, st.title, st.description, st.meta, st.shift].join('|')).join('\n')}
          onChange={(v) =>
            setField(
              'methodSteps',
              v
                .split('\n')
                .map((line, idx) => {
                  const [number, title, description, meta, shift] = line.split('|').map((x) => (x || '').trim());
                  return { number: Number(number) || idx + 1, title: title || '', description: description || '', meta: meta || '', shift: shift || '' };
                })
                .filter((st) => st.title || st.description),
            )
          }
          rows={7}
        />
        <Area label="Method closer" value={sales.methodCloser} onChange={(v) => setField('methodCloser', v)} rows={2} />
      </Collapse>

      <Collapse title="Old way vs new way">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Field label="Old-way heading" value={sales.oldWayHeading} onChange={(v) => setField('oldWayHeading', v)} />
            <Area label="Old-way items (one per line)" value={listToLines(sales.oldWayItems)} onChange={(v) => setField('oldWayItems', linesToList(v))} rows={5} />
          </div>
          <div className="space-y-2">
            <Field label="New-way heading" value={sales.newWayHeading} onChange={(v) => setField('newWayHeading', v)} />
            <Area label="New-way items (one per line)" value={listToLines(sales.newWayItems)} onChange={(v) => setField('newWayItems', linesToList(v))} rows={5} />
          </div>
        </div>
      </Collapse>

      <Collapse title="Proof / testimonials">
        <Area
          label="Proof (name|role|quote, one per line)"
          value={(sales.proof || []).map((p) => [p.name, p.role, p.quote].join('|')).join('\n')}
          onChange={(v) =>
            setField(
              'proof',
              v
                .split('\n')
                .map((line) => {
                  const [name, role, ...rest] = line.split('|').map((x) => (x || '').trim());
                  return { name: name || '', role: role || '', quote: rest.join('|') || '', real: true };
                })
                .filter((p) => p.name || p.quote),
            )
          }
          rows={5}
        />
        <Field label="Testimonials heading (legacy)" value={sales.testimonialsHeading} onChange={(v) => setField('testimonialsHeading', v)} />
        <Area
          label="Testimonials legacy (quote|author|role, one per line)"
          value={(sales.testimonials || []).map((t) => t.quote + '|' + t.author + '|' + t.role).join('\n')}
          onChange={(v) =>
            setField(
              'testimonials',
              v
                .split('\n')
                .map((line) => {
                  const [quote, author, role] = line.split('|').map((x) => (x || '').trim());
                  return { quote: quote || '', author: author || '', role: role || '' };
                })
                .filter((t) => t.quote || t.author),
            )
          }
          rows={4}
        />
      </Collapse>

      <Collapse title="Bonuses">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bonuses eyebrow" value={sales.bonusesEyebrow} onChange={(v) => setField('bonusesEyebrow', v)} />
          <Field label="Bonuses heading" value={sales.bonusesHeading} onChange={(v) => setField('bonusesHeading', v)} />
          <Field label="Total value" value={sales.bonusesTotalValue} onChange={(v) => setField('bonusesTotalValue', v)} placeholder="$65" />
        </div>
        <Area label="Bonuses intro" value={sales.bonusesIntro} onChange={(v) => setField('bonusesIntro', v)} rows={2} />
        <Area
          label="Bonus items (title|description|value, one per line)"
          value={(sales.bonusesItems || []).map((b) => [b.title, b.description, b.value].join('|')).join('\n')}
          onChange={(v) =>
            setField(
              'bonusesItems',
              v
                .split('\n')
                .map((line) => {
                  const [title, description, value] = line.split('|').map((x) => (x || '').trim());
                  return { title: title || '', description: description || '', value: value || '' };
                })
                .filter((b) => b.title || b.description),
            )
          }
          rows={5}
        />
        <Area label="Bonuses closer" value={sales.bonusesCloser} onChange={(v) => setField('bonusesCloser', v)} rows={2} />
      </Collapse>

      <Collapse title="Founder letter">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Founder eyebrow" value={sales.founderEyebrow} onChange={(v) => setField('founderEyebrow', v)} placeholder="A letter from the founder" />
          <Field label="Founder heading" value={sales.founderHeading} onChange={(v) => setField('founderHeading', v)} />
        </div>
        <Field label="Founder greeting" value={sales.founderGreeting} onChange={(v) => setField('founderGreeting', v)} />
        <Area
          label="Founder paragraphs (blank line between)"
          value={(sales.founderParagraphs || []).join('\n\n')}
          onChange={(v) => setField('founderParagraphs', v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean))}
          rows={8}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Founder signoff" value={sales.founderSignoff} onChange={(v) => setField('founderSignoff', v)} placeholder="With Love," />
          <Field label="Founder photo URL" value={sales.founderPhotoUrl} onChange={(v) => setField('founderPhotoUrl', v)} />
        </div>
        <Area label="Founder P.S." value={sales.founderPs} onChange={(v) => setField('founderPs', v)} rows={3} />
      </Collapse>

      <Collapse title="Pricing, CTA & guarantee">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Price label" value={sales.priceLabel} onChange={(v) => setField('priceLabel', v)} placeholder="$27" />
          <Field label="Original price" value={sales.originalPriceLabel} onChange={(v) => setField('originalPriceLabel', v)} placeholder="$47" />
          <Field label="Price description" value={sales.priceDescription} onChange={(v) => setField('priceDescription', v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CTA text" value={sales.ctaText} onChange={(v) => setField('ctaText', v)} />
          <Field label="CTA subtext" value={sales.ctaSubtext} onChange={(v) => setField('ctaSubtext', v)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guarantee title" value={sales.guaranteeTitle} onChange={(v) => setField('guaranteeTitle', v)} />
          <Area label="Guarantee body" value={sales.guaranteeText} onChange={(v) => setField('guaranteeText', v)} rows={2} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Final CTA heading" value={sales.finalCtaHeading} onChange={(v) => setField('finalCtaHeading', v)} />
          <Area label="Final CTA body" value={sales.finalCtaBody} onChange={(v) => setField('finalCtaBody', v)} rows={2} />
        </div>
      </Collapse>

      <Collapse title="FAQ & order bumps">
        <Field label="FAQ heading" value={sales.faqHeading} onChange={(v) => setField('faqHeading', v)} />
        <Area
          label="FAQs (question|answer, one per line)"
          value={(sales.faqs || []).map((f) => f.question + '|' + f.answer).join('\n')}
          onChange={(v) =>
            setField(
              'faqs',
              v
                .split('\n')
                .map((line) => {
                  const [question, ...rest] = line.split('|').map((x) => (x || '').trim());
                  return { question: question || '', answer: rest.join('|') || '' };
                })
                .filter((f) => f.question || f.answer),
            )
          }
          rows={6}
        />
        <Area
          label="Bumps (id|title|description|price, one per line)"
          value={(sales.bumps || []).map((b) => [b.id, b.title, b.description, b.price].join('|')).join('\n')}
          onChange={(v) =>
            setField(
              'bumps',
              v
                .split('\n')
                .map((line, idx) => {
                  const [id, title, description, price] = line.split('|').map((x) => (x || '').trim());
                  return { id: id || 'bump_' + (idx + 1), title: title || '', description: description || '', price: price || '' };
                })
                .filter((b) => b.title || b.description),
            )
          }
          rows={4}
        />
      </Collapse>
    </section>
  );
}
