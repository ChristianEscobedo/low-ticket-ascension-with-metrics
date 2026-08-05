# Finding: tracked links weren't counting anything

## Symptom

Clicked a link minted from the content hub's piece sheet. Counter stayed at 0.
Server log showed:

```
GET /funnel/10-minute-mom-reset?utm_source=facebook&...&utm_content=fb-reel-1 200
```

## Cause

That request never touched `/go/[code]`, and **the redirect handler is the only
place a click is ever recorded**. So there was nothing to count — the zero was
accurate, it just wasn't measuring anything.

Why the link pointed straight at `/funnel/...`: `createLink` only mints a short
code when the caller passes `withShortLink: true`. `PieceLinkPanel` wasn't passing
it. With no short code, `getLinkUrlByPieceId()` falls back to `link.fullUrl` —
the destination with UTMs appended:

```ts
const url = origin && link.shortCode ? `${origin}/go/${link.shortCode}` : link.fullUrl;
```

**The dangerous part is that the fallback URL looks correct.** It carries all five
UTM parameters, so opt-in and purchase attribution *does* work through it — a
lead captured from that URL is credited to the right piece. Only the click count
is silently impossible. That's why this survived: the panel's three numbers were
"0 clicks, 1 opt-in", which reads as a weird-but-plausible funnel rather than as
a broken link.

**Fixed** by sending `withShortLink: true` from the panel.

## Correction to the "same browser" hypothesis

Repeat clicks from the same computer/browser were **not** the cause, and total
clicks already counts them:

- The redirect is deliberately a **302, not a 301** — specifically so the browser
  doesn't cache it and the second click still reaches the server.
- There is no dedupe on the counter. Two clicks from one browser = 2.

The only hits excluded are bot/link-preview crawlers (`countable: family !== 'bot'`),
which are still logged so the traffic is explainable but don't move the number a
human reads as "clicks".

## Links minted before the fix are permanently un-countable

Not retroactively fixable, and worth being precise about why: those rows have no
short code, so no `/go/` URL for them has ever existed. Any click already made
against the `fullUrl` was never logged anywhere — there's no record to recover.
Re-mint from the panel (the newest link per piece wins) and the new one counts.
Their opt-in/purchase attribution is unaffected and stays intact.

## Unique clicks — built (was "still open #1")

Total clicks answers "how much traffic", unique answers "how many people", and
the gap between them is itself the signal — 40 clicks from 3 people is a link
being re-checked, not an audience.

Uniques are `count(distinct ip_hash)` over `mothermode_link_clicks` within a
window (30 days by default), *not* a counter on the link row: `clickCount` is a
hot atomic increment with no room for set semantics. Because the click log is
already read for `recentClicks`, uniques cost no extra query.

The derivation lives alone in **`src/lib/offers/planner/clickPeople.ts`**,
with `links.ts` supplying the raw three numbers (`uniqueClicks`,
`unattributedClicks`, plus the per-piece variants) and every surface calling
`readPeople()` / `peopleLabel()`. It is a separate module for a concrete reason:
`links.ts` builds a service-role Supabase client at module scope, and two of the
four consumers (`LinkTracking`, `PieceClickMetrics`) are client components —
importing `links.ts` there would pull the service key into a browser bundle.
`ip_hash` itself never leaves `links.ts`; only set *sizes* travel upward.

Three judgement calls, shared rather than re-derived per surface, because a
re-implementation is how two screens start disagreeing about the same link:

- **`people: null`, never 0, when no click carried a hash.** The local-dev case —
  no `x-forwarded-for` to hash. "0 people / 40 clicks" reads as a broken counter
  and sends someone hunting a bug that does not exist. Surfaces render "not
  measurable".
- **`atLeast: true` when only *some* clicks lacked a hash.** The count is a floor,
  labelled "at least 3 people", never rounded into a fact.
- **`selfTrafficLikely`** at ≥8 clicks *and* ≥5 clicks/person, and suppressed
  entirely when any click is unattributed. The floor spares a new post with 2
  clicks from 1 person; the suppression matters because unhashed clicks inflate
  the ratio by construction, and a false "this is just you" invites deleting a
  post that was working.

People are also clamped to never exceed clicks. The two numbers come from two
passes over the same rows (one bot-filtered, one set-sized), so a future
crawler-pattern change can transiently invert them; unclamped that prints "1
click from 5 people", which discredits every other number on the page.

Standing caveat: hashed-IP uniques over-count anyone on a changing mobile IP and
under-count a shared office NAT. Fine for "3 people or 300", not fine for
anything reported as precise. Rules are pinned in
`tests/lib/planner-click-people.test.ts` (9 tests), each documenting why the case
is deliberate — the null and the thresholds all look like bugs from outside.

### Where it shows
| Surface | Reading |
| --- | --- |
| `/admin` overview | "N in 30d from at least 3 people" under tracked clicks |
| `/admin/funnel-stats` | sub-line on the 30d card, with the self-traffic note |
| `LinkTracking` (planner) | per-link people column |
| `PieceClickMetrics` (Metrics tab) | per-piece people, same derivation as the panel |

On funnel-stats the people count is a sub-line rather than a fourth card, on
purpose: "Unique customers" already sits two rows up, and two adjacent "unique"
numbers invite a comparison that is meaningless (Stripe customers all-time vs
distinct IPs over 30 days).

## Still open

**`localhost` in minted links.** `NEXT_PUBLIC_SITE_URL` isn't set locally, so

`siteOrigin()` falls back to the request origin, which in dev is
`http://localhost:3000`. Set `NEXT_PUBLIC_SITE_URL` in `.env.local` before
minting any link intended to be posted publicly — a localhost link works
perfectly on your machine and is dead for every reader. `scripts/repair-localhost-tracked-links.cjs`
exists to clean up rows already minted that way.
