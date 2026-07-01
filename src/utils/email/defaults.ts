/**
 * The themed default purchase receipt. This is the global fallback rendered
 * when no DB override and no per-offer email (see ./offer-emails) match the
 * purchased product. Built once from the shared Editorial Warm layout so the
 * baseline receipt already looks like the MotherMode app.
 *
 * The body keeps {{tokens}} intact; the render pipeline substitutes them per
 * send. Exported strings double as the admin editor's starting point.
 */
import { renderEmail, type EmailDoc } from './layout';

export const DEFAULT_RECEIPT_SUBJECT = 'Your {{brand}} receipt for {{amount}}';

const DEFAULT_RECEIPT_DOC: EmailDoc = {
  preheader: 'Your MotherMode receipt and access details.',
  title: 'Payment received',
  intro: [
    'Hi {{name}}, thank you. Your payment went through and your access is ready and waiting for you.',
    'Here are the details for your records. Everything you bought is in your account, and you can open it whenever the house goes quiet.',
  ],
  receipt: [
    { label: 'Amount', value: '{{amount}}' },
    { label: 'Product', value: '{{product}}' },
    { label: 'Reference', value: '{{ref}}' },
  ],
  outro: [
    'You do not have to figure this out tonight. Open it when you have ten quiet minutes, and let it carry a little of the load for you.',
    '{{signoff}}',
  ],
};

const rendered = renderEmail(DEFAULT_RECEIPT_DOC);

export const DEFAULT_RECEIPT_BODY_HTML = rendered.html;
export const DEFAULT_RECEIPT_BODY_TEXT = rendered.text;

/** Receipt-template shape consumed by the sender's fallback chain. */
export const DEFAULT_RECEIPT_TEMPLATE = {
  id: 'default',
  subject: DEFAULT_RECEIPT_SUBJECT,
  body_html: DEFAULT_RECEIPT_BODY_HTML,
  body_text: DEFAULT_RECEIPT_BODY_TEXT,
};
