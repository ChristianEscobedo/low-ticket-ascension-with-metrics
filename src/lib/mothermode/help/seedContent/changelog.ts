import type { SeedChangelog } from './helpers';

function cl(parts: string[]): string {
  return parts.join('\n').trim();
}

export const HELP_CENTER_SEED_CHANGELOG: SeedChangelog[] = [
  {
    version: '0.1.0',
    releasedOn: '2026-06-28',
    entryType: 'added',
    title: 'AI content library and per-piece review state',
    body: cl([
      '<p>The generated content library landed. AI drafts and their review state (generated images, picked hooks, YouTube kits) now persist in Supabase instead of living only in the browser.</p>',
      '<p><strong>Why it matters:</strong> you can close the tab mid-review and come back to every draft exactly as you left it, on any device.</p>',
    ]),
    published: true,
  },
  {
    version: '0.2.0',
    releasedOn: '2026-07-01',
    entryType: 'added',
    title: 'Admin-editable deliverables',
    body: cl([
      '<p>Buyer deliverables are now editable in the admin with the drafts-and-publishing model. Overrides layer on top of built-in defaults, so the product is never broken by an empty admin state.</p>',
      '<p><strong>Why it matters:</strong> improving what a buyer receives no longer needs a deploy. Edit a section, save, and it is live.</p>',
    ]),
    published: true,
  },
  {
    version: '0.2.1',
    releasedOn: '2026-07-05',
    entryType: 'added',
    title: 'Buyer resource workspaces',
    body: cl([
      '<p>Interactive resources (worksheets, planners) now store buyer entries scoped by email, so a returning buyer finds their previous work and one buyer never sees another\'s entries.</p>',
    ]),
    published: true,
  },
  {
    version: '0.3.0',
    releasedOn: '2026-07-10',
    entryType: 'added',
    title: 'Help Center: knowledge base and changelog',
    body: cl([
      '<p>This system. Knowledge base articles and a release changelog, authored in /admin/help and published without a deploy. Drafts are admin-only; published rows are readable by the public viewer.</p>',
    ]),
    published: true,
  },
  {
    version: '0.4.0',
    releasedOn: '2026-07-15',
    entryType: 'added',
    title: 'Community Kit',
    body: cl([
      '<p>One intake generates a complete community launch kit: name, description, three qualifying questions for paid and free, a DM script, a sales-call script, an ad content style, a lead form, and the first pinned post.</p>',
      '<p><strong>Where to start:</strong> Kits / Community Kit, in this Help Center.</p>',
    ]),
    published: true,
  },
  {
    version: '0.5.0',
    releasedOn: '2026-07-25',
    entryType: 'added',
    title: 'Lead Gen Kit',
    body: cl([
      '<p>An AI lead-magnet builder with ten formats, length-driven multi-pass generation for coherent ultra-long documents, and one-click publish of a self-contained styled document to Deliverables.</p>',
    ]),
    published: true,
  },
  {
    version: '0.6.0',
    releasedOn: '2026-07-30',
    entryType: 'added',
    title: 'Email Marketing Kit',
    body: cl([
      '<p>Campaign sequences from eight deterministic blueprints and nine per-email frameworks, with timing styles and plain-text-source-of-truth export to styled HTML or CSV. The model writes only copy; the arc is always sound.</p>',
    ]),
    published: true,
  },
  {
    version: '0.6.1',
    releasedOn: '2026-07-31',
    entryType: 'improved',
    title: 'Two-way context for kits and content',
    body: cl([
      '<p>The Context Bridge now flows both directions: a saved email sequence can be attached to the content Generate drawer, and kits carry their own context selectors, so context flows from kits into content and back.</p>',
    ]),
    published: true,
  },
  {
    version: '0.7.0',
    releasedOn: '2026-08-05',
    entryType: 'added',
    title: 'Email images in body and funnel asset library',
    body: cl([
      '<p>Images insert into email bodies from the Studio, gallery images round-trip as edit seeds, and a polymorphic asset library attaches any kit to a funnel, resolved through the Context Bridge.</p>',
    ]),
    published: true,
  },
  {
    version: '0.8.0',
    releasedOn: '2026-08-12',
    entryType: 'added',
    title: 'Sales funnel AI builder and editor refactor',
    body: cl([
      '<p>The sales funnel editor gained the AI autofill (every page drafted from the offer), per-page regenerate bars, chrome and media editing, and a layout refactor for the master/detail workspace.</p>',
      '<p><strong>Where to start:</strong> Offers and Funnels / Sales Funnels, in this Help Center.</p>',
    ]),
    published: true,
  },
  {
    version: '0.8.1',
    releasedOn: '2026-08-18',
    entryType: 'fixed',
    title: 'Clear error when the AI key is invalid',
    body: cl([
      '<p>The funnel AI builder now surfaces a clear banner when the OpenAI key is missing or invalid, instead of failing silently. If the builder refuses to run, check Admin / Integrations first.</p>',
    ]),
    published: true,
  },
  {
    version: '0.9.0',
    releasedOn: '2026-08-25',
    entryType: 'added',
    title: 'Email flow canvas, testing, and analytics',
    body: cl([
      '<p>The transactional email layer gained the visual flow canvas, funnel event assignment, a testing inbox preview with real tokens, and send, open, and click analytics dashboards.</p>',
    ]),
    published: true,
  },
  {
    version: '0.10.0',
    releasedOn: '2026-09-02',
    entryType: 'added',
    title: 'Seedance video pipeline and storyboard lab',
    body: cl([
      '<p>Script to storyboard to render: second-by-second scene scripts, per-beat storyboard approval, and the Seedance render step with a model selector and per-clip progress.</p>',
      '<p><strong>Where to start:</strong> Content Hub / Video, in this Help Center.</p>',
    ]),
    published: true,
  },
  {
    version: '0.11.0',
    releasedOn: '2026-09-10',
    entryType: 'added',
    title: 'Brand Bible, Asset Hub, and admin palette alignment',
    body: cl([
      '<p>The Brand Bible centralizes the voice and visual rules every generator follows, the Asset Hub adds the offer-systems view that checks an offer is complete, and every admin surface was aligned to one palette.</p>',
    ]),
    published: true,
  },
  {
    version: '0.12.0',
    releasedOn: '2026-09-20',
    entryType: 'added',
    title: 'Opt-in funnels with steps and destinations',
    body: cl([
      '<p>Standalone lead-capture funnels with per-step URLs, post-capture destinations, and UTM-preserving lead capture, so a no-sale still becomes a lead you can follow up with.</p>',
    ]),
    published: true,
  },
  {
    version: '0.13.0',
    releasedOn: '2026-10-05',
    entryType: 'added',
    title: 'Tracked links and UTM everywhere',
    body: cl([
      '<p>Every post link is now a minted /go/code link with UTM parameters. Planner cards, funnel links, and opt-in destinations all mint and carry tracked links, so clicks, leads, and sales join back to the exact post.</p>',
      '<p><strong>One rule:</strong> always mint links from the piece, never by hand. See Offers and Funnels / Tracked Links.</p>',
    ]),
    published: true,
  },
  {
    version: '0.13.1',
    releasedOn: '2026-10-06',
    entryType: 'improved',
    title: 'Loopback guard and click rollups',
    body: cl([
      '<p>Tracked links minted against local or loopback destinations are repaired automatically, and per-card click rollups now keep pace with the raw click rows.</p>',
    ]),
    published: true,
  },
  {
    version: '0.13.2',
    releasedOn: '2026-10-06',
    entryType: 'fixed',
    title: 'Clicks written but not counted',
    body: cl([
      '<p>Fixed a class of bug where raw click rows were written but the link counter did not reflect them, so cards showed zero clicks on links with real traffic.</p>',
      '<p><strong>If numbers still look wrong:</strong> run scripts/inspect-tracked-link-clicks.cjs to separate write, counter, and join problems.</p>',
    ]),
    published: true,
  },
  {
    version: '0.13.3',
    releasedOn: '2026-10-07',
    entryType: 'fixed',
    title: 'Organic thread tagged as paid',
    body: cl([
      '<p>Fixed the medium derivation that could tag an organic thread as paid when its format resolved to a paid medium, which produced phantom paid metrics on cards.</p>',
    ]),
    published: true,
  },
  {
    version: '0.14.0',
    releasedOn: '2026-10-07',
    entryType: 'added',
    title: 'Publish state system for planner cards',
    body: cl([
      '<p>Every planner card now carries an explicit draft, scheduled, or published state with badges and board filters, so the board shows what is actually live at a glance.</p>',
    ]),
    published: true,
  },
  {
    version: '0.14.1',
    releasedOn: '2026-10-08',
    entryType: 'fixed',
    title: 'Planner card missing offer slug',
    body: cl([
      '<p>Fixed cards that could be created without their offer slug, which broke the link from a card back to its offer.</p>',
    ]),
    published: true,
  },
  {
    version: '1.0.0',
    releasedOn: '2026-10-26',
    entryType: 'added',
    title: 'Knowledge base rewritten as step-by-step guides',
    body: cl([
      '<p>The Help Center knowledge base now ships with a full step-by-step guide per feature across every area of the app, with numbered walkthroughs, tables, and callouts, plus reserved media slots for walkthrough videos and screenshots.</p>',
    ]),
    published: true,
  },
  {
    version: '1.1.0',
    releasedOn: '2026-10-26',
    entryType: 'added',
    title: 'Facebook color-block posts and TikTok photo-mode slideshows',
    body: cl([
      '<p>Two new native formats. Facebook color-block posts render a short hook as big bold text on a brand background, with a palette composer and a one-click render to a shareable image. TikTok photo-mode slideshows are swipeable multi-image posts where every slide carries its own styled, editable text that you can burn onto the image.</p>',
      '<p>Both work end to end: catalog pieces, AI generation, platform-accurate previews, export, and compliance.</p>',
      '<p><strong>Where to start:</strong> Content Hub / Color blocks and photo slideshows, in this Help Center.</p>',
    ]),
    published: true,
  },
  {
    version: '1.2.0',
    releasedOn: '2026-11-13',
    entryType: 'added',
    title: 'Agent Recipes: 16 plays, the expert crew, and the in-chat Plays rail',
    body: cl([
      '<p>The Research Lab became a crew. Eight experts (research, strategy, copy, lead magnets, email, design, compliance, analyst) run declarative plays end to end: Low-Ticket Launch and Full System, the builder fleet (Bulk Content Engine, Full Funnel Build, Paid Launch System, Email Sequence Build, Repurpose Engine, Launch Week), and the deep research set — Influencer Panel, Comment Mining Sweep, Cross-Channel Sweep, Reddit Rabbit Hole, Video Deep Dive, and The Audience Mosaic.</p>',
      '<p>Deep plays dive multiple influencers, rank posts by real engagement, and mine the comments under the winners across X, TikTok, Instagram, Reddit, and YouTube, with cited web passes on LinkedIn and Facebook. Gates pause for your approval before anything builds downstream. Runs work in the background with live step progress in /admin/recipes or the Plays rail inside the research chat, and the Watch weekly toggle re-runs a play every week.</p>',
      '<p><strong>Where to start:</strong> Planning / Agent Recipes, in this Help Center.</p>',
    ]),
    published: true,
  },
  {
    version: '1.3.0',
    releasedOn: '2026-11-18',
    entryType: 'added',
    title: 'Agent Skills, run sharing, and Mission Control',
    body: cl([
      '<p>The crew learned new tricks and got a home screen. Agent Skills (/admin/skills) are declarative HTTP tools — an allowlisted URL template with declared inputs and secrets that only ever resolve in headers — that any expert or play can call. Drafts save imperfect; activation requires a clean validation, and a 5-failure breaker auto-pauses a dead endpoint before it burns the daily call budget.</p>',
      '<p>Recipe runs can now be shared as read-only public links (/share/run/<token>), the chat live-follows a running play step by step with the crew labeled on every turn, and per-call cost + citation tracking lands fleet-wide.</p>',
      '<p>Mission Control moved onto /admin: gates waiting on you, today\'s fleet spend, the job lane, active watches, and who is working on what, refreshed live. /admin/gates is the phone-first approve-or-cancel screen, and the new Command Palette jumps anywhere from the keyboard.</p>',
    ]),
    published: true,
  },
  {
    version: '1.4.0',
    releasedOn: '2026-11-19',
    entryType: 'added',
    title: '1:1 Personalization: every lead gets their own page',
    body: cl([
      '<p>One funnel now serves a different page to every lead. A signed link from your email (?pp=) tells the funnel who is visiting, and the page renders copy written for them — headline, benefits, problem scene, CTA, checkout — merged server-side before render, so there is no flicker and nothing sensitive in the URL. Price, Stripe ids, and links can never be touched by the AI: the merge is copy-only by construction.</p>',
      '<p>Per funnel in /admin/personalization: overlay mode personalizes signed-link visitors while everyone else sees the generic page; gated mode hides the offer from everyone without a valid key (competitors get a polite decoy). Payloads generate automatically at opt-in and can be regenerated or reviewed per lead, with the AI\'s intent read on each one.</p>',
      '<p>Bonus: per-recipient email images. Embed one signed image URL in your ESP and every opener sees their own first name rendered in the creative, generated at open time and cached at the edge.</p>',
      '<p><strong>Where to start:</strong> set a funnel to overlay in /admin/personalization, generate, mint a link, and put it in your next send.</p>',
    ]),
    published: true,
  },
];


