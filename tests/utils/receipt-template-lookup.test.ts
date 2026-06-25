import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @supabase/supabase-js before importing the module under test. The
// queries we issue are tiny: .from('receipt_templates').select(...).eq(col,
// val).maybeSingle(). The mock client returns whatever the harness sets
// for each (col, val) pair.

type Resolver = (col: string, val: string) => unknown | null;
let resolver: Resolver = () => null;

const queryBuilder = (table: string) => {
  let filterCol = '';
  let filterVal = '';
  const builder: any = {
    select() {
      return builder;
    },
    eq(col: string, val: string) {
      filterCol = col;
      filterVal = val;
      return builder;
    },
    async maybeSingle() {
      if (table !== 'receipt_templates') return { data: null, error: null };
      return { data: resolver(filterCol, filterVal), error: null };
    }
  };
  return builder;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => queryBuilder(table) })
}));

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
  resolver = () => null;
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('getReceiptTemplate precedence', () => {
  const productRow = {
    id: 'product:prod_42',
    subject: 'Product subject',
    body_html: '<p>p</p>',
    body_text: 'p',
    product_id: 'prod_42'
  };
  const defaultRow = {
    id: 'default',
    subject: 'Default subject',
    body_html: '<p>d</p>',
    body_text: 'd',
    product_id: null
  };

  it('returns the product-specific row when product_id matches', async () => {
    resolver = (col, val) => {
      if (col === 'product_id' && val === 'prod_42') return productRow;
      if (col === 'id' && val === 'default') return defaultRow;
      return null;
    };
    const { getReceiptTemplate } = await import('@/utils/email/templates');
    const t = await getReceiptTemplate('prod_42');
    expect(t?.subject).toBe('Product subject');
  });

  it('falls back to the default row when no product override exists', async () => {
    resolver = (col, val) => {
      if (col === 'product_id') return null;
      if (col === 'id' && val === 'default') return defaultRow;
      return null;
    };
    const { getReceiptTemplate } = await import('@/utils/email/templates');
    const t = await getReceiptTemplate('prod_99');
    expect(t?.subject).toBe('Default subject');
  });

  it('returns the default row when called with no product id', async () => {
    resolver = (col, val) => {
      if (col === 'id' && val === 'default') return defaultRow;
      return null;
    };
    const { getReceiptTemplate } = await import('@/utils/email/templates');
    const t = await getReceiptTemplate(null);
    expect(t?.subject).toBe('Default subject');
  });

  it('returns null when neither product nor default exists', async () => {
    resolver = () => null;
    const { getReceiptTemplate } = await import('@/utils/email/templates');
    const t = await getReceiptTemplate('prod_x');
    expect(t).toBeNull();
  });

  it('returns null when env is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { getReceiptTemplate } = await import('@/utils/email/templates');
    const t = await getReceiptTemplate('prod_42');
    expect(t).toBeNull();
  });
});

describe('deleteReceiptTemplate', () => {
  it('targets product:<id> when a productId is given', async () => {
    let deletedId: string | null = null;
    const queryBuilderDel = () => ({
      delete() {
        return this;
      },
      async eq(_col: string, val: string) {
        deletedId = val;
        return { data: null, error: null };
      }
    });
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({ from: () => queryBuilderDel() })
    }));
    const { deleteReceiptTemplate } = await import(
      '@/utils/email/templates'
    );
    await deleteReceiptTemplate('prod_42');
    expect(deletedId).toBe('product:prod_42');
  });

  it('targets the default id when productId is null', async () => {
    let deletedId: string | null = null;
    const queryBuilderDel = () => ({
      delete() {
        return this;
      },
      async eq(_col: string, val: string) {
        deletedId = val;
        return { data: null, error: null };
      }
    });
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({ from: () => queryBuilderDel() })
    }));
    const { deleteReceiptTemplate } = await import(
      '@/utils/email/templates'
    );
    await deleteReceiptTemplate(null);
    expect(deletedId).toBe('default');
  });
});

describe('sendPurchaseReceipt → getReceiptTemplate wiring', () => {
  it('passes payload.product_id through to the lookup', async () => {
    const spy = vi.fn().mockResolvedValue(null);
    vi.doMock('@/utils/email/templates', async (orig) => {
      const real = await orig<typeof import('@/utils/email/templates')>();
      return { ...real, getReceiptTemplate: spy };
    });
    process.env.RESEND_API_KEY = 're_x';
    process.env.RECEIPT_FROM_EMAIL = 'noreply@x.com';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockResolvedValue(new Response('{"id":"em_1"}', { status: 200 }) as any);
    const { sendPurchaseReceipt } = await import('@/utils/email/receipt');
    await sendPurchaseReceipt({
      stripe_event_id: 'evt_1',
      payment_intent_id: 'pi_1',
      product_id: 'prod_77',
      page_type: 'fe',
      amount_cents: 100,
      currency: 'usd',
      customer_email: 'a@b.com',
      customer_name: 'A'
    });
    expect(spy).toHaveBeenCalledWith('prod_77');
    fetchSpy.mockRestore();
  });
});
