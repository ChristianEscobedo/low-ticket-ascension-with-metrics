import { describe, it, expect } from 'vitest';
import {
  buildReceiptTokens,
  renderTemplate
} from '@/utils/email/templates';
import type { PurchaseEvent } from '@/utils/integrations/dispatch';

const payload: PurchaseEvent = {
  stripe_event_id: 'evt_1',
  payment_intent_id: 'pi_123',
  product_id: 'prod_fe27',
  page_type: 'fe',
  amount_cents: 2700,
  currency: 'usd',
  customer_email: 'buyer@example.com',
  customer_name: 'Jane Buyer'
};

describe('renderTemplate', () => {
  it('substitutes known tokens verbatim by default', () => {
    expect(
      renderTemplate('Hi {{name}}, your {{product}} is ready', {
        name: 'Jane',
        product: 'Mastery Course'
      })
    ).toBe('Hi Jane, your Mastery Course is ready');
  });

  it('replaces unknown tokens with an empty string', () => {
    expect(renderTemplate('Hello {{nope}}!', { name: 'x' })).toBe('Hello !');
  });

  it('is case-insensitive on token keys + tolerates whitespace', () => {
    expect(
      renderTemplate('{{ BRAND }} - {{ amount }}', {
        brand: 'Mindshift',
        amount: '$27.00'
      })
    ).toBe('Mindshift - $27.00');
  });

  it('escapes HTML-special characters when escapeHtml=true', () => {
    expect(
      renderTemplate('<p>{{name}}</p>', { name: '<script>x</script>' }, {
        escapeHtml: true
      })
    ).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
  });

  it('does NOT escape token values in plaintext mode', () => {
    expect(
      renderTemplate('{{name}}', { name: '<not html>' })
    ).toBe('<not html>');
  });

  it('leaves the surrounding template HTML untouched', () => {
    const tpl = '<a href="https://x.com">{{name}}</a>';
    expect(renderTemplate(tpl, { name: 'Jane' }, { escapeHtml: true })).toBe(
      '<a href="https://x.com">Jane</a>'
    );
  });
});

describe('buildReceiptTokens', () => {
  it('formats currency and extracts first name', () => {
    const tokens = buildReceiptTokens(payload, { brandName: 'Mindshift' });
    expect(tokens.amount).toBe('$27.00');
    expect(tokens.currency).toBe('USD');
    expect(tokens.name).toBe('Jane');
    expect(tokens.product).toBe('prod_fe27');
    expect(tokens.email).toBe('buyer@example.com');
    expect(tokens.ref).toBe('pi_123');
    expect(tokens.brand).toBe('Mindshift');
    expect(tokens.signoff).toBe('— The Mindshift team');
  });

  it('falls back to "there" when no customer_name is present', () => {
    const tokens = buildReceiptTokens(
      { ...payload, customer_name: null },
      { brandName: null }
    );
    expect(tokens.name).toBe('there');
    expect(tokens.brand).toBe('');
    expect(tokens.signoff).toContain('just reply to this email');
  });

  it('falls back ref to checkout_session_id then stripe_event_id', () => {
    const a = buildReceiptTokens(
      {
        ...payload,
        payment_intent_id: null,
        checkout_session_id: 'cs_999'
      },
      { brandName: null }
    );
    expect(a.ref).toBe('cs_999');

    const b = buildReceiptTokens(
      {
        ...payload,
        payment_intent_id: null,
        checkout_session_id: null
      },
      { brandName: null }
    );
    expect(b.ref).toBe('evt_1');
  });
});
