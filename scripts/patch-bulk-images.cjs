/**
 * Phase 3 — bulk image generation for sales funnel slots.
 * Adds a "Generate missing images" action to the Build tab that fills every
 * empty image slot across optin / sales / checkout / upsell1-4 using the
 * existing content-hub image API (aiGenerateImage).
 */
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx');
let ed = fs.readFileSync(P, 'utf8');
const before = ed.length;

/* 1. import the image client -------------------------------------------- */
if (!ed.includes("from '@/components/mothermode/content/aiClient'")) {
  const m = ed.match(/^import .*from 'react';$/m);
  if (!m) throw new Error('react import not found');
  ed = ed.replace(
    m[0],
    m[0] + "\nimport { aiGenerateImage } from '@/components/mothermode/content/aiClient';",
  );
  console.log('import added');
}

/* 2. Busy variant -------------------------------------------------------- */
if (!ed.includes("| 'generateImages'")) {
  ed = ed.replace("  | 'generatePage'", "  | 'generatePage'\n  | 'generateImages'");
  console.log('busy variant added');
}

/* 3. handler ------------------------------------------------------------- */
if (!ed.includes('async function onGenerateImages()')) {
  const anchor = '  function setIntakeField<K extends keyof SalesAiIntake>(key: K, value: SalesAiIntake[K]) {';
  if (!ed.includes(anchor)) throw new Error('setIntakeField anchor missing');
  const handler = `  /** Fill every empty image slot across the funnel in one AI pass. */
  async function onGenerateImages() {
    const subject = stack.frontEnd.name || intake.offerName || sales.name || 'digital offer';
    const niche = intake.niche || sales.category || 'online business';
    const audience = intake.audience || sales.audience || 'busy founders';
    const base =
      'Premium editorial product visual for "' +
      subject +
      '", a ' +
      niche +
      ' offer for ' +
      audience +
      '. Warm dark background, brass and bone palette, calm luxury, no text.';

    type ImageSlot = { label: string; current: string; prompt: string; apply: (url: string) => void };
    const slots: ImageSlot[] = [
      {
        label: 'Optin cover',
        current: optin.coverImageUrl || '',
        prompt: base + ' Lead magnet cover mockup for "' + (optin.magnetTitle || intake.magnetName || subject) + '".',
        apply: (url) => setOptinField('coverImageUrl', url),
      },
      {
        label: 'Sales hero',
        current: sales.heroImageUrl || '',
        prompt: base + ' Wide hero image, product in context, aspirational and quiet.',
        apply: (url) => setSalesField('heroImageUrl', url),
      },
      {
        label: 'Founder photo',
        current: sales.founderPhotoUrl || '',
        prompt: base + ' Editorial portrait-style brand image for the founder note section, soft light, no text.',
        apply: (url) => setSalesField('founderPhotoUrl', url),
      },
      {
        label: 'Checkout product',
        current: checkout.productImageUrl || '',
        prompt: base + ' Compact product thumbnail on a clean surface, order-summary style.',
        apply: (url) => setCheckoutField('productImageUrl', url),
      },
      {
        label: 'Upsell 1 product',
        current: upsell1.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell1.productName || upsell1.headline || 'upgrade') + '".',
        apply: (url) => setUpsell1Field('imageUrl', url),
      },
      {
        label: 'Upsell 2 product',
        current: upsell2.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell2.productName || upsell2.headline || 'upgrade') + '".',
        apply: (url) => setUpsell2Field('imageUrl', url),
      },
      {
        label: 'Upsell 3 product',
        current: upsell3.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell3.productName || upsell3.headline || 'upgrade') + '".',
        apply: (url) => setUpsell3Field('imageUrl', url),
      },
      {
        label: 'Upsell 4 product',
        current: upsell4.imageUrl || '',
        prompt: base + ' Upsell product mockup for "' + (upsell4.productName || upsell4.headline || 'upgrade') + '".',
        apply: (url) => setUpsell4Field('imageUrl', url),
      },
    ];

    const pending = slots.filter((s) => !s.current.trim());
    if (pending.length === 0) {
      setError(null);
      setNotice('Every image slot already has an image. Clear a URL to regenerate it.');
      return;
    }

    setBusy('generateImages');
    setError(null);
    setNotice('Generating ' + pending.length + ' image' + (pending.length === 1 ? '' : 's') + '…');
    const failed: string[] = [];
    let done = 0;
    for (const slot of pending) {
      try {
        const url = await aiGenerateImage(slot.prompt, 'feed');
        if (url) {
          slot.apply(url);
          done += 1;
        } else {
          failed.push(slot.label);
        }
      } catch {
        failed.push(slot.label);
      }
      setNotice('Generated ' + done + '/' + pending.length + '…');
    }
    setBusy(null);
    if (failed.length) {
      setNotice('Generated ' + done + ' of ' + pending.length + '. Save when ready.');
      setError('Image generation failed for: ' + failed.join(', '));
    } else {
      setNotice('Generated ' + done + ' image' + (done === 1 ? '' : 's') + '. Save to persist.');
    }
  }

`;
  ed = ed.replace(anchor, handler + anchor);
  console.log('handler added');
}

/* 4. button in the Build bar --------------------------------------------- */
if (!ed.includes('3. Generate missing images')) {
  const anchor = `              <button type="button" onClick={onGenerate} disabled={busy !== null} className={btnPrimary}>
                {busy === 'generate' ? 'Generating pages…' : '2. Generate full funnel'}
              </button>`;
  if (!ed.includes(anchor)) throw new Error('generate button anchor missing');
  ed = ed.replace(
    anchor,
    anchor +
      `
              <button type="button" onClick={onGenerateImages} disabled={busy !== null} className={btnGhost}>
                {busy === 'generateImages' ? 'Generating images…' : '3. Generate missing images'}
              </button>`,
  );
  console.log('button added');
}

fs.writeFileSync(P, ed, 'utf8');
console.log('done', before, '->', ed.length);
