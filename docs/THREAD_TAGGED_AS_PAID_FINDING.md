# Finding: organic threads were tagged as paid traffic

**Status:** code fixed, stored rows NOT yet repaired.
**Found:** while verifying that the new paid block on a piece could ever render.
**Fixed in:** `src/lib/offers/planner/utm.ts` (`mediumForFormat`).
**Pinned by:** `tests/lib/planner-medium-for-format.test.ts`.

## What was wrong

`mediumForFormat` classified a content format into a `utm_medium`, and the paid
test was a substring check:

```ts
if (f.includes('ad') || f.includes('paid')) return 'paid_social';
```

`thread` contains `ad` — thre**ad**. `thread` is a real `ContentFormat` (X
threads; there are a dozen organic thread pieces in `src/lib/mothermode/content/x.ts`),
so every tracked link minted for a thread was stamped `utm_medium=paid_social`.
`paid_social` is in `PAID_MEDIUMS`, so `trafficType()` returned `'paid'`, and from
there every downstream surface treated those clicks and their leads as paid.

Also caught by the same substring: any format or label containing `lead`,
`roadmap`, `headline`, or `download`.

## Why it mattered more than a mislabelled row

The error ran in the *worst* direction. Organic traffic converts better than
paid, so folding organic threads into the paid bucket:

1. inflated the paid opt-in rate,
2. inflated earnings per paid click,
3. and the paid EPC **is** the bid ceiling (`bidCeilingSummary`).

The entire paid/blended split exists to stop organic revenue from justifying an
ad bid. This defeated it upstream of the whole mechanism — the split was working
perfectly on inputs that were already wrong.

## The fix

Short markers now match whole words; only long, unambiguous markers stay as
substrings:

```ts
const words = f.split(/[^a-z0-9]+/i).filter(Boolean);
hasWord('ad', 'ads', 'advert', 'promo', 'promoted', 'boosted', 'sponsored')
  || f.includes('paid')
```

`dm` got the same treatment for the same reason (two letters). Tests cover both
directions — `thread`/`lead magnet`/`roadmap` must not be paid, and
`ad`/`story ad`/`boosted post`/`sponsored post` must still be. A sweep over every
key of `FORMAT_LABEL` asserts no hub format lands in the paid bucket, so adding a
format without thinking about attribution now fails in CI rather than on a
dashboard.

## Still to do: repair the stored rows

The fix only affects links minted from now on. Rows already written keep the
wrong medium, and every paid figure that reads history stays contaminated.

Affected rows are identifiable without guesswork — a tracked link whose medium
is paid but whose piece is a thread:

```sql
select l.id, l.short_code, l.utm_medium, l.utm_content
from mothermode_tracked_links l
where l.utm_medium in ('paid_social', 'cpc', 'ppc', 'paid')
  and l.utm_content in (
    select piece_id from mothermode_planner_cards where format = 'thread'
  );
```

Two cautions before writing the repair:

- **Do not blanket-rewrite `paid_social` to `organic_social`.** Genuinely boosted
  threads exist, and a boosted thread is correctly paid. The format alone cannot
  distinguish "thread" from "thread we put money behind"; only the admin knows.
  A repair should therefore report first and require confirmation, in the shape
  of `scripts/repair-localhost-tracked-links.cjs`.
- **`utm_medium` is also stamped on lead rows** (`leadUtmContent.ts` path). A
  repair that fixes links but not the leads captured through them leaves the two
  disagreeing, which is worse than either being uniformly wrong.

Until that runs, treat any paid EPC on a thread piece as suspect.
