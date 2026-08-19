// Wire the webhooks into the funnel editor: the save payload + the field.
const fs = require('fs');
const p = 'src/app/admin/sales-funnels/SalesFunnelEditor.tsx';
let s = fs.readFileSync(p, 'utf8');
const before = s;

// 1. The save payload carries the webhooks (one URL per line → a string[]).
s = s.replace(
  'footer, testMode })',
  "footer, testMode, webhooks: webhooks.split('\\n').map((u) => u.trim()).filter(Boolean) })"
);

// 2. The field: a "Webhooks" textarea after the test-mode cell, full width.
const field = `
            <div className="min-w-0 sm:col-span-2">
              <label className={labelClass}>Webhooks <span className="normal-case text-bone/40">(one URL per line — POSTed the purchase data on a sale: the main app, GHL, Zapier)</span></label>
              <textarea
                className={inputClass + ' min-h-[72px] font-mono text-xs'}
                value={webhooks}
                onChange={(e) => setWebhooks(e.target.value)}
                placeholder={'https://hooks.zapier.com/hooks/catch/…\\nhttps://your-main-app.com/api/funnel-webhook'}
              />
            </div>
`;
s = s.replace(
  "                    : 'Live keys'}\n                </span>\n              </div>\n            </div>\n\n          </div>",
  "                    : 'Live keys'}\n                </span>\n              </div>\n            </div>\n" + field + "\n          </div>"
);

if (s === before) {
  console.error('NO CHANGE — an anchor missed');
  process.exit(1);
}
const payloadOk = s.includes('webhooks: webhooks.split');
const fieldOk = s.includes('Webhooks <span');
fs.writeFileSync(p, s);
console.log('payload:', payloadOk ? 'ok' : 'MISSED', '| field:', fieldOk ? 'ok' : 'MISSED');
