/**
 * Refuses to mint a tracked link whose destination is a loopback host.
 *
 * `base_url` and `full_url` are PERSISTED, and `/go/<code>` redirects to the
 * stored `full_url`. So a link minted against NEXT_PUBLIC_SITE_URL=localhost is
 * not a display bug that fixes itself when the env changes -- the row keeps
 * pointing at 127.0.0.1 forever, and the failure surfaces weeks later as a paid
 * ad that goes nowhere for everyone except the person who made it.
 *
 * The guard lives in the store, not the route, because the store is the single
 * choke point every caller passes through -- and it also catches a hand-pasted
 * localhost URL in the custom-destination field, which no route-level origin
 * check would see.
 */
const fs = require('fs');

const file = 'src/lib/mothermode/planner/links.ts';
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let src = crlf ? raw.replace(/\r\n/g, '\n') : raw;

if (src.includes('isLoopbackUrl')) {
  console.log('already applied — no changes');
  process.exit(0);
}

const anchor = `  const base = (input.baseUrl || '').trim();
  if (!base) throw new Error('A destination URL is required');`;

if (!src.includes(anchor)) {
  console.error('ANCHOR MISS — nothing written');
  process.exit(1);
}

src = src.replace(
  anchor,
  `${anchor}

  // A tracked link is a permanent, publishable artifact. Minting one against
  // localhost bakes an unreachable host into base_url/full_url, and /go/<code>
  // redirects to the stored full_url -- so this cannot be corrected later by
  // fixing the env. Set NEXT_PUBLIC_SITE_URL to the real domain instead.
  // ALLOW_LOCALHOST_TRACKED_LINKS=true opts local testing back in deliberately.
  if (
    isLoopbackUrl(base) &&
    (process.env.ALLOW_LOCALHOST_TRACKED_LINKS || '').toLowerCase() !== 'true'
  ) {
    throw new Error(
      'Refusing to mint a tracked link pointing at ' +
        base +
        ' — base_url and full_url are stored permanently and /go/ redirects to ' +
        'them, so this link would be dead everywhere but this machine. Set ' +
        'NEXT_PUBLIC_SITE_URL to your real domain (or set ' +
        'ALLOW_LOCALHOST_TRACKED_LINKS=true if you are only testing).',
    );
  }`,
);

src += `
/**
 * True when a URL points at this machine rather than the public internet.
 *
 * Covers the hosts a dev environment actually produces: localhost, the IPv4 and
 * IPv6 loopbacks, 0.0.0.0, and \`*.local\`. Anything unparseable is treated as
 * NOT loopback -- a malformed URL is a different error, and swallowing it here
 * would block minting for the wrong reason.
 */
export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    );
  } catch {
    return false;
  }
}
`;

fs.writeFileSync(file, crlf ? src.replace(/\n/g, '\r\n') : src);
console.log('added loopback guard to', file);
