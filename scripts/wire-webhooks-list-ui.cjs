// Rebuild the webhooks field as a clean list: a field per webhook, a Test
// button, a remove button, an Add button. Plus the testWebhook function.
const fs = require('fs');
const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
let s = fs.readFileSync(p, 'utf8');
const before = s;

// 1. The save payload: the list, trimmed + filtered (no more .split).
s = s.replace(
  "webhooks: webhooks.split('\\n').map((u) => u.trim()).filter(Boolean)",
  'webhooks: webhooks.map((u) => u.trim()).filter(Boolean)'
);

// 2. The testWebhook function, before onSave.
const testFn = `
  /** POST a test payload to a webhook URL. Browser-side; CORS-permissive endpoints (Zapier, GHL) accept it. */
  async function testWebhook(url: string, i: number) {
    setTestingWebhook(i); setWebhookTestNote(null);
    try {
      const res = await fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'purchase', test: true, funnelSlug: slug, email: 'test@example.com', amountCents: 2700, purchasedAt: new Date().toISOString() }),
      });
      setWebhookTestNote(res.ok ? 'Test sent (HTTP ' + res.status + '). Check the receiving end.' : 'Test failed (HTTP ' + res.status + ').');
    } catch (e) {
      setWebhookTestNote('Test failed: ' + (e instanceof Error ? e.message : 'network error') + ' — the endpoint may block browser calls (CORS). It still works server-side on a real sale.');
    } finally {
      setTestingWebhook(null);
    }
  }

  async function onSave(statusOverride?: SalesFunnelStatus) {`;
s = s.replace(
  '  async function onSave(statusOverride?: SalesFunnelStatus) {',
  testFn
);

// 3. The field: the textarea → the list UI.
const oldField = `            <div className="min-w-0 sm:col-span-2">
              <label className={labelClass}>Webhooks <span className="normal-case text-bone/40">(one URL per line — POSTed the purchase data on a sale: the main app, GHL, Zapier)</span></label>
              <textarea
                className={inputClass + ' min-h-[72px] font-mono text-xs'}
                value={webhooks}
                onChange={(e) => setWebhooks(e.target.value)}
                placeholder={'https://hooks.zapier.com/hooks/catch/…\\nhttps://your-main-app.com/api/funnel-webhook'}
              />
            </div>`;
const newField = `            <div className="min-w-0 sm:col-span-2">
              <label className={labelClass}>Webhooks <span className="normal-case text-bone/40">(POSTed the purchase data on a sale — the main app, GHL, Zapier)</span></label>
              <div className="space-y-2">
                {webhooks.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputClass + ' font-mono text-xs'}
                      value={url}
                      onChange={(e) => setWebhooks((prev) => prev.map((u, j) => (j === i ? e.target.value : u)))}
                      placeholder="https://hooks.zapier.com/hooks/catch/…"
                    />
                    <button type="button" onClick={() => testWebhook(url, i)} disabled={!url.trim() || testingWebhook === i} className={btnGhost + ' shrink-0'}>{testingWebhook === i ? 'Testing…' : 'Test'}</button>
                    <button type="button" onClick={() => setWebhooks((prev) => prev.filter((_, j) => j !== i))} className={btnDanger + ' shrink-0'} title="Remove">×</button>
                  </div>
                ))}
                <button type="button" onClick={() => setWebhooks((prev) => [...prev, ''])} className={btnGhost}>+ Add webhook</button>
                {webhookTestNote && <div className="text-xs text-bone/50">{webhookTestNote}</div>}
              </div>
            </div>`;
s = s.replace(oldField, newField);

if (s === before) {
  console.error('NO CHANGE — an anchor missed');
  process.exit(1);
}
const payloadOk = s.includes('webhooks: webhooks.map((u) => u.trim())');
const fnOk = s.includes('async function testWebhook');
const fieldOk = s.includes('+ Add webhook');
fs.writeFileSync(p, s);
console.log('payload:', payloadOk ? 'ok' : 'MISSED', '| testFn:', fnOk ? 'ok' : 'MISSED', '| field:', fieldOk ? 'ok' : 'MISSED');
