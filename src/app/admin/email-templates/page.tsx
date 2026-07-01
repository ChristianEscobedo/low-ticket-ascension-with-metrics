import {
  listReceiptTemplates,
  RECEIPT_TOKEN_KEYS
} from '@/utils/email/templates';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';
import { getProductsWithPrices } from '@/utils/supabase/admin';
import ReceiptTemplateEditor, {
  DEFAULT_RECEIPT_SUBJECT,
  DEFAULT_RECEIPT_BODY_HTML,
  DEFAULT_RECEIPT_BODY_TEXT
} from './ReceiptTemplateEditor';
import TemplateScopePicker from './TemplateScopePicker';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { product_id?: string };
}

export default async function EmailTemplatesPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const rawProductId = searchParams?.product_id?.trim() || null;

  const [user, products, overrides] = await Promise.all([
    getUser(supabase),
    getProductsWithPrices().catch(() => [] as any[]),
    listReceiptTemplates()
  ]);

  // Validate the requested product id against the catalog so a stale URL
  // doesn't silently let an admin save a template against a nonexistent
  // product (the FK on the migration would also reject it server-side).
  const productList = (products as Array<{ id: string; name: string }>).map(
    (p) => ({ id: p.id, name: p.name })
  );
  const productId =
    rawProductId && productList.some((p) => p.id === rawProductId)
      ? rawProductId
      : null;
  const selectedProduct = productList.find((p) => p.id === productId) ?? null;

  const stored = productId
    ? overrides.find((t) => t.product_id === productId) ?? null
    : overrides.find((t) => !t.product_id && t.id === 'default') ?? null;

  const initial = stored
    ? {
        subject: stored.subject,
        body_html: stored.body_html,
        body_text: stored.body_text
      }
    : {
        subject: DEFAULT_RECEIPT_SUBJECT,
        body_html: DEFAULT_RECEIPT_BODY_HTML,
        body_text: DEFAULT_RECEIPT_BODY_TEXT
      };

  const productsWithOverride = new Set(
    overrides.filter((t) => t.product_id).map((t) => t.product_id as string)
  );

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Email
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Receipt template
        </h1>
        <p className="text-sm text-bone/60 mt-2 max-w-2xl">
          Override the default purchase receipt subject + body, or write a
          dedicated copy per product. Tokens in double braces are substituted
          per email; the most specific stored template wins (product &gt;
          default &gt; hardcoded).
        </p>
      </div>

      <TemplateScopePicker
        products={productList}
        productsWithOverride={Array.from(productsWithOverride)}
        currentProductId={productId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <ReceiptTemplateEditor
          key={productId ?? 'default'}
          initial={initial}
          isStored={!!stored}
          lastUpdated={stored?.updated_at ?? null}
          updatedBy={stored?.updated_by ?? null}
          defaultTestEmail={user?.email ?? ''}
          productId={productId}
          productName={selectedProduct?.name ?? null}
        />

        <aside className="rounded-2xl border border-brass/15 bg-bone/[0.02] p-5 h-fit lg:sticky lg:top-10">
          <div className="text-[11px] uppercase tracking-[0.18em] text-bone/50 font-semibold mb-3">
            Available tokens
          </div>
          <ul className="space-y-2 text-sm">
            {RECEIPT_TOKEN_KEYS.map((token) => (
              <li key={token} className="flex items-baseline gap-2">
                <code className="px-1.5 py-0.5 rounded bg-ink/40 border border-bone/10 text-brass font-mono text-xs">
                  {`{{${token}}}`}
                </code>
                <span className="text-bone/50 text-xs">{TOKEN_HELP[token]}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-bone/40 mt-5 leading-relaxed">
            Tokens are HTML-escaped inside the HTML body and inserted verbatim
            into the plaintext body. Unknown tokens render as empty strings.
          </p>
        </aside>
      </div>
    </div>
  );
}

const TOKEN_HELP: Record<string, string> = {
  brand: 'RECEIPT_BRAND_NAME env value',
  amount: 'Formatted as currency (e.g. $27.00)',
  currency: 'Uppercased currency code (USD)',
  product: 'Stripe product id from the purchase',
  name: 'Buyer first name',
  email: 'Buyer email',
  ref: 'payment_intent_id / session id',
  signoff: 'Auto-generated sign-off line'
};
