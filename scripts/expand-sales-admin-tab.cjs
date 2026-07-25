/**
 * Expand SalesFunnelEditor sales tab to full MotherMode field set
 * (founder letter, media, origin, mechanism, inside, method, bonuses, etc.)
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'admin',
  'sales-funnels',
  'SalesFunnelEditor.tsx',
);

let s = fs.readFileSync(file, 'utf8');

const startMarker = "        {tab === 'sales' && (";
const endMarker = "        {tab === 'vsl' && (";
const si = s.indexOf(startMarker);
const ei = s.indexOf(endMarker);
if (si < 0 || ei < 0) {
  console.error('markers not found', si, ei);
  process.exit(1);
}

const replacement = `        {tab === 'sales' && (
          <section className="rounded-xl border border-bone/10 bg-ink/30 p-4 sm:p-5 space-y-6">
            <p className="text-xs text-bone/50">
              Full MotherMode long-form sales page. Every field maps 1:1 into{' '}
              <code className="text-brass">MotherModeSalesPage</code> via{' '}
              <code className="text-brass">salesContentToOffer</code>. Load MotherMode defaults
              to seed from a catalog offer.
            </p>

            {/* Identity / media */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Identity & media</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Offer name" value={sales.name} onChange={(v) => setSalesField('name', v)} />
                <Field label="Tagline" value={sales.tagline} onChange={(v) => setSalesField('tagline', v)} />
                <Field label="Category" value={sales.category} onChange={(v) => setSalesField('category', v)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Hero image URL" value={sales.heroImageUrl} onChange={(v) => setSalesField('heroImageUrl', v)} placeholder="Product mockup" />
                <Field label="Hero video URL" value={sales.heroVideoUrl} onChange={(v) => setSalesField('heroVideoUrl', v)} placeholder="VSL poster / hero video" />
                <Field label="Founder photo URL" value={sales.founderPhotoUrl} onChange={(v) => setSalesField('founderPhotoUrl', v)} placeholder="Portrait for founder letter" />
              </div>
            </div>

            {/* Hero */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Hero</h3>
              <Field label="Eyebrow" value={sales.eyebrow} onChange={(v) => setSalesField('eyebrow', v)} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Headline" value={sales.headline} onChange={(v) => setSalesField('headline', v)} />
                <Field label="Emphasis (italic)" value={sales.headlineEmphasis} onChange={(v) => setSalesField('headlineEmphasis', v)} />
                <Field label="Headline suffix" value={sales.headlineSuffix} onChange={(v) => setSalesField('headlineSuffix', v)} />
              </div>
              <Area label="Subheadline" value={sales.subheadline} onChange={(v) => setSalesField('subheadline', v)} rows={3} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Audience line" value={sales.audience} onChange={(v) => setSalesField('audience', v)} />
                <Field label="Promise" value={sales.promise} onChange={(v) => setSalesField('promise', v)} />
              </div>
            </div>

            {/* Problem */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Problem</h3>
              <Field label="Problem heading" value={sales.problemHeading} onChange={(v) => setSalesField('problemHeading', v)} />
              <Area label="Problem intro" value={sales.problemIntro} onChange={(v) => setSalesField('problemIntro', v)} rows={3} />
              <Area label="Problem scene" value={sales.problemScene} onChange={(v) => setSalesField('problemScene', v)} rows={3} />
              <Area label="Problem points (one per line)" value={listToLines(sales.problemPoints)} onChange={(v) => setSalesField('problemPoints', linesToList(v))} rows={5} />
              <Area label="Problem cost" value={sales.problemCost} onChange={(v) => setSalesField('problemCost', v)} rows={2} />
              <Area label="Problem body (legacy flat)" value={sales.problemBody} onChange={(v) => setSalesField('problemBody', v)} rows={3} />
            </div>

            {/* Origin */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Origin story</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Origin eyebrow" value={sales.originEyebrow} onChange={(v) => setSalesField('originEyebrow', v)} />
                <Field label="Origin heading" value={sales.originHeading} onChange={(v) => setSalesField('originHeading', v)} />
              </div>
              <Area label="Origin paragraphs (blank line between)" value={(sales.originParagraphs || []).join('\\n\\n')} onChange={(v) => setSalesField('originParagraphs', v.split(/\\n\\s*\\n/).map((p) => p.trim()).filter(Boolean))} rows={6} />
            </div>

            {/* What is / solution */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">What it is / solution</h3>
              <Field label="What-is heading" value={sales.whatIsHeading} onChange={(v) => setSalesField('whatIsHeading', v)} />
              <Area label="What-is paragraphs (blank line between)" value={(sales.whatIsParagraphs || []).join('\\n\\n')} onChange={(v) => setSalesField('whatIsParagraphs', v.split(/\\n\\s*\\n/).map((p) => p.trim()).filter(Boolean))} rows={5} />
              <Field label="Solution heading (legacy)" value={sales.solutionHeading} onChange={(v) => setSalesField('solutionHeading', v)} />
              <Area label="Solution body (legacy)" value={sales.solutionBody} onChange={(v) => setSalesField('solutionBody', v)} rows={3} />
            </div>

            {/* Mechanism */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Mechanism</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Mechanism eyebrow" value={sales.mechanismEyebrow} onChange={(v) => setSalesField('mechanismEyebrow', v)} />
                <Field label="Mechanism heading" value={sales.mechanismHeading} onChange={(v) => setSalesField('mechanismHeading', v)} />
                <Field label="Mechanism label" value={sales.mechanismLabel} onChange={(v) => setSalesField('mechanismLabel', v)} />
              </div>
              <Area label="Mechanism paragraphs (blank line between)" value={(sales.mechanismParagraphs || []).join('\\n\\n')} onChange={(v) => setSalesField('mechanismParagraphs', v.split(/\\n\\s*\\n/).map((p) => p.trim()).filter(Boolean))} rows={4} />
              <Area label="Mechanism points (title|description, one per line)" value={(sales.mechanismPoints || []).map((p) => p.title + '|' + p.description).join('\\n')} onChange={(v) => setSalesField('mechanismPoints', v.split('\\n').map((line) => { const [title, ...rest] = line.split('|').map((x) => x.trim()); return { title: title || '', description: rest.join('|') || '' }; }).filter((p) => p.title || p.description))} rows={5} />
            </div>

            {/* Inside / features */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Inside the offer</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Inside heading" value={sales.insideHeading} onChange={(v) => setSalesField('insideHeading', v)} />
                <Field label="Inside subheading" value={sales.insideSubheading} onChange={(v) => setSalesField('insideSubheading', v)} />
              </div>
              <Area label="Inside lead" value={sales.insideLead} onChange={(v) => setSalesField('insideLead', v)} rows={2} />
              <Area label="Inside items (title|description|tag|value|outcome, one per line)" value={(sales.insideItems || []).map((i) => [i.title, i.description, i.tag, i.value, i.outcome].join('|')).join('\\n')} onChange={(v) => setSalesField('insideItems', v.split('\\n').map((line) => { const [title, description, tag, value, outcome] = line.split('|').map((x) => (x || '').trim()); return { title: title || '', description: description || '', tag: tag || '', value: value || '', outcome: outcome || '' }; }).filter((i) => i.title || i.description))} rows={8} />
              <Field label="Features heading (legacy)" value={sales.featuresHeading} onChange={(v) => setSalesField('featuresHeading', v)} />
              <Area label="Features titles only (legacy, one per line)" value={listToLines(sales.features)} onChange={(v) => setSalesField('features', linesToList(v))} rows={5} />
            </div>

            {/* Method */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Method</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Method heading" value={sales.methodHeading} onChange={(v) => setSalesField('methodHeading', v)} />
                <Field label="Method subheading" value={sales.methodSubheading} onChange={(v) => setSalesField('methodSubheading', v)} />
              </div>
              <Area label="Method steps (number|title|description|meta|shift, one per line)" value={(sales.methodSteps || []).map((st) => [st.number, st.title, st.description, st.meta, st.shift].join('|')).join('\\n')} onChange={(v) => setSalesField('methodSteps', v.split('\\n').map((line, idx) => { const [number, title, description, meta, shift] = line.split('|').map((x) => (x || '').trim()); return { number: Number(number) || idx + 1, title: title || '', description: description || '', meta: meta || '', shift: shift || '' }; }).filter((st) => st.title || st.description))} rows={7} />
              <Area label="Method closer" value={sales.methodCloser} onChange={(v) => setSalesField('methodCloser', v)} rows={2} />
            </div>

            {/* Old vs new */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Old way vs new way</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Field label="Old-way heading" value={sales.oldWayHeading} onChange={(v) => setSalesField('oldWayHeading', v)} />
                  <Area label="Old-way items (one per line)" value={listToLines(sales.oldWayItems)} onChange={(v) => setSalesField('oldWayItems', linesToList(v))} rows={5} />
                </div>
                <div className="space-y-2">
                  <Field label="New-way heading" value={sales.newWayHeading} onChange={(v) => setSalesField('newWayHeading', v)} />
                  <Area label="New-way items (one per line)" value={listToLines(sales.newWayItems)} onChange={(v) => setSalesField('newWayItems', linesToList(v))} rows={5} />
                </div>
              </div>
            </div>

            {/* Proof */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Proof / testimonials</h3>
              <Area label="Proof (name|role|quote, one per line)" value={(sales.proof || []).map((p) => [p.name, p.role, p.quote].join('|')).join('\\n')} onChange={(v) => setSalesField('proof', v.split('\\n').map((line) => { const [name, role, ...rest] = line.split('|').map((x) => (x || '').trim()); return { name: name || '', role: role || '', quote: rest.join('|') || '', real: true }; }).filter((p) => p.name || p.quote))} rows={5} />
              <Field label="Testimonials heading (legacy)" value={sales.testimonialsHeading} onChange={(v) => setSalesField('testimonialsHeading', v)} />
              <Area label="Testimonials legacy (quote|author|role, one per line)" value={(sales.testimonials || []).map((t) => t.quote + '|' + t.author + '|' + t.role).join('\\n')} onChange={(v) => setSalesField('testimonials', v.split('\\n').map((line) => { const [quote, author, role] = line.split('|').map((x) => (x || '').trim()); return { quote: quote || '', author: author || '', role: role || '' }; }).filter((t) => t.quote || t.author))} rows={4} />
            </div>

            {/* Bonuses */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Bonuses</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Bonuses eyebrow" value={sales.bonusesEyebrow} onChange={(v) => setSalesField('bonusesEyebrow', v)} />
                <Field label="Bonuses heading" value={sales.bonusesHeading} onChange={(v) => setSalesField('bonusesHeading', v)} />
                <Field label="Total value" value={sales.bonusesTotalValue} onChange={(v) => setSalesField('bonusesTotalValue', v)} placeholder="$65" />
              </div>
              <Area label="Bonuses intro" value={sales.bonusesIntro} onChange={(v) => setSalesField('bonusesIntro', v)} rows={2} />
              <Area label="Bonus items (title|description|value, one per line)" value={(sales.bonusesItems || []).map((b) => [b.title, b.description, b.value].join('|')).join('\\n')} onChange={(v) => setSalesField('bonusesItems', v.split('\\n').map((line) => { const [title, description, value] = line.split('|').map((x) => (x || '').trim()); return { title: title || '', description: description || '', value: value || '' }; }).filter((b) => b.title || b.description))} rows={5} />
              <Area label="Bonuses closer" value={sales.bonusesCloser} onChange={(v) => setSalesField('bonusesCloser', v)} rows={2} />
            </div>

            {/* Founder letter */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Founder letter</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Founder eyebrow" value={sales.founderEyebrow} onChange={(v) => setSalesField('founderEyebrow', v)} placeholder="A letter from the founder" />
                <Field label="Founder heading" value={sales.founderHeading} onChange={(v) => setSalesField('founderHeading', v)} />
              </div>
              <Field label="Founder greeting" value={sales.founderGreeting} onChange={(v) => setSalesField('founderGreeting', v)} />
              <Area label="Founder paragraphs (blank line between)" value={(sales.founderParagraphs || []).join('\\n\\n')} onChange={(v) => setSalesField('founderParagraphs', v.split(/\\n\\s*\\n/).map((p) => p.trim()).filter(Boolean))} rows={8} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Founder signoff" value={sales.founderSignoff} onChange={(v) => setSalesField('founderSignoff', v)} placeholder="With Love," />
                <Field label="Founder photo URL" value={sales.founderPhotoUrl} onChange={(v) => setSalesField('founderPhotoUrl', v)} />
              </div>
              <Area label="Founder P.S." value={sales.founderPs} onChange={(v) => setSalesField('founderPs', v)} rows={3} />
            </div>

            {/* Pricing / CTA / guarantee */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">Pricing, CTA & guarantee</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Price label" value={sales.priceLabel} onChange={(v) => setSalesField('priceLabel', v)} placeholder="$27" />
                <Field label="Original price" value={sales.originalPriceLabel} onChange={(v) => setSalesField('originalPriceLabel', v)} placeholder="$47" />
                <Field label="Price description" value={sales.priceDescription} onChange={(v) => setSalesField('priceDescription', v)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CTA text" value={sales.ctaText} onChange={(v) => setSalesField('ctaText', v)} />
                <Field label="CTA subtext" value={sales.ctaSubtext} onChange={(v) => setSalesField('ctaSubtext', v)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Guarantee title" value={sales.guaranteeTitle} onChange={(v) => setSalesField('guaranteeTitle', v)} />
                <Area label="Guarantee body" value={sales.guaranteeText} onChange={(v) => setSalesField('guaranteeText', v)} rows={2} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Final CTA heading" value={sales.finalCtaHeading} onChange={(v) => setSalesField('finalCtaHeading', v)} />
                <Area label="Final CTA body" value={sales.finalCtaBody} onChange={(v) => setSalesField('finalCtaBody', v)} rows={2} />
              </div>
            </div>

            {/* FAQ / bumps */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass/80">FAQ & order bumps</h3>
              <Field label="FAQ heading" value={sales.faqHeading} onChange={(v) => setSalesField('faqHeading', v)} />
              <Area label="FAQs (question|answer, one per line)" value={(sales.faqs || []).map((f) => f.question + '|' + f.answer).join('\\n')} onChange={(v) => setSalesField('faqs', v.split('\\n').map((line) => { const [question, ...rest] = line.split('|').map((x) => (x || '').trim()); return { question: question || '', answer: rest.join('|') || '' }; }).filter((f) => f.question || f.answer))} rows={6} />
              <Area label="Bumps (id|title|description|price, one per line)" value={(sales.bumps || []).map((b) => [b.id, b.title, b.description, b.price].join('|')).join('\\n')} onChange={(v) => setSalesField('bumps', v.split('\\n').map((line, idx) => { const [id, title, description, price] = line.split('|').map((x) => (x || '').trim()); return { id: id || 'bump_' + (idx + 1), title: title || '', description: description || '', price: price || '' }; }).filter((b) => b.title || b.description))} rows={4} />
            </div>
          </section>
        )}
`;

// The replacement above has literal \\n which becomes \n in the written file
// because it's a JS string. We need the TSX source to contain real \n escapes.
// In a normal JS string 'join('\\n')' writes join('\n') to the file — correct.
// But above I used '\\n' inside a template literal, which is correct for writing \n to file.

s = s.slice(0, si) + replacement + s.slice(ei);
fs.writeFileSync(file, s);

console.log('Sales tab replaced. bytes:', s.length);
console.log('founderEyebrow:', s.includes("setSalesField('founderEyebrow'"));
console.log('founderPhotoUrl:', s.includes("setSalesField('founderPhotoUrl'"));
console.log('founderParagraphs:', s.includes("setSalesField('founderParagraphs'"));
console.log('originParagraphs:', s.includes("setSalesField('originParagraphs'"));
console.log('insideItems:', s.includes("setSalesField('insideItems'"));
console.log('methodSteps:', s.includes("setSalesField('methodSteps'"));
console.log('bonusesItems:', s.includes("setSalesField('bonusesItems'"));
