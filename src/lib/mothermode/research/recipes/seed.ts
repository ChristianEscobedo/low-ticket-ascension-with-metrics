/**
 * The house recipes (roadmap 3.1 + 3.4 + the builder fleet) as DATA.
 *
 * Patterns the fleet shares:
 * - Every step's instruction names its actual job; {input} is the input
 *   envelope's markdown (the brief for step 1, the previous artifact after).
 * - Gates sit where money or judgment matters: before funnel fan-outs,
 *   before paid cards, before a second built kit. A gated handoff fires on
 *   APPROVAL through the existing pipeline.
 * - Post-handoff advisory steps (design, compliance) run auto AFTER the
 *   assets land, so the owner gets the built things plus Pixel's direction
 *   and Rook's flags in the session. Compliance always runs last.
 * - 'system' handoffs fan one offer-brief out into the whole machine
 *   (lead magnet + opt-in funnel + nurture kit + sales funnel draft +
 *   planner cards, manifest persisted) through runSystemBuild.
 * - The deep research fleet (influencer-panel, comment-mining-sweep,
 *   cross-channel-sweep, reddit-rabbit-hole, video-deep-dive) is UNGATED
 *   and artifact-only like the watchers — intelligence producers that are
 *   safe to run unattended or weekly. Deep-only tools are named with their
 *   standard-session fallback; LinkedIn/Facebook ride cited web_search
 *   passes (no scrape lane exists for them — the instruction says so).
 */
import type { RecipeStep } from './types';

export interface RecipeSeed {
  slug: string;
  name: string;
  description: string;
  steps: RecipeStep[];
  budgetEstCents: number;
}

export const RECIPE_SEEDS: RecipeSeed[] = [
  {
    slug: 'low-ticket-launch',
    name: 'Low-Ticket Launch',
    description:
      'Research the niche, decide the offer, plan the launch content. Research → strategist (gate) → copy.',
    budgetEstCents: 150,
    steps: [
      {
        expert: 'research',
        instruction:
          'Research the niche for the next low-ticket offer. Sweep Reddit and one social platform broadly across the brief\'s problem keywords, mine the pain language and the objections, then save a research-brief artifact with the 3-5 biggest themes and the exact phrases to reuse. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'strategist',
        instruction:
          'Turn this research brief into an offer decision. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles. Save an offer-brief artifact with the exact documented structure. Research brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'offer-brief',
        gate: 'approve',
      },
      {
        expert: 'copy',
        instruction:
          'Plan the launch content for this offer. 7 posts across instagram and tiktok, hooks pulled from the research language verbatim, one paid angle per platform. Save a content-plan artifact with the exact documented items structure. Offer brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'full-system',
    name: 'Full System',
    description:
      'One offer decision fans out into the whole system: sales funnel draft, lead magnet kit, nurture emails, launch content. Strategist (gate) → leadmagnet → email → copy, each handing off through the existing pipeline.',
    budgetEstCents: 200,
    steps: [
      {
        expert: 'strategist',
        instruction:
          'Decide the offer for the next low-ticket launch from the brief and our numbers. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles. Save an offer-brief artifact with the exact documented structure. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'offer-brief',
        gate: 'approve',
        handoff: { target: 'sales-funnel', generate: false },
      },
      {
        expert: 'leadmagnet',
        instruction:
          'Design the lead magnet for this offer: the FIRST slice of its promise, consumable in one sitting, bridging to the paid mechanism. Save a lead-magnet artifact with the exact documented structure. Offer brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'lead-magnet',
        gate: 'auto',
        handoff: { target: 'leadgen-kit', generate: true },
      },
      {
        expert: 'email',
        instruction:
          'Write the nurture sequence for this lead magnet: 4-5 emails from download to offer, subject lines from the research language, one job per email. Save an email-outline artifact with the exact documented structure. Lead magnet:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'email-outline',
        gate: 'auto',
        handoff: { target: 'email-kit', generate: true },
      },
      {
        expert: 'copy',
        instruction:
          'Plan the launch content for this system: 7 posts across instagram and tiktok, hooks from the research language verbatim, one paid angle per platform. Save a content-plan artifact with the exact documented items structure. The system so far:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
        handoff: { target: 'planner-cards', generate: false },
      },
    ],
  },
  {
    slug: 'niche-watch',
    name: 'Niche Watch',
    description:
      'A broad sweep of the niche this week: themes, phrases, and the angles worth running. Research → copy, no gates.',
    budgetEstCents: 100,
    steps: [
      {
        expert: 'research',
        instruction:
          'Broad scan of the niche this week. Sweep Reddit and one social platform across the brief\'s DIFFERENT problem keywords (not the same one twice), plus one web search for the current angle. Deliver the 3-5 biggest themes with the source that showed each, then save a research-brief artifact. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Turn this niche watch into angles worth running this week: 5 hooks pulled from the audience language verbatim, each with the theme it rides and the platform it fits. Save an ad-angles artifact with the exact documented items structure. Niche brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'voice-check',
    name: 'Voice Check',
    description:
      'Deep dive the brief\'s competitor voices: what performs, what the audience repeats back, and the hooks to borrow. Research → copy, no gates.',
    budgetEstCents: 120,
    steps: [
      {
        expert: 'research',
        instruction:
          'Check the competitor voices in the brief. Deep dive the FIRST voice (voice_deep_dive when the session is on Deep, voice_audit otherwise): rank their posts by real engagement, mine the comments on the winners, and roll up the phrases and questions the audience keeps repeating. Save a research-brief artifact with what performs and the exact audience language. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Borrow what works from this voice check: 5 hooks in OUR voice (house rules apply) built on the winning patterns and the audience\'s exact phrases, each noting the pattern it borrows. Save an ad-angles artifact with the exact documented items structure. Voice check:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'bulk-content-engine',
    name: 'Bulk Content Engine',
    description:
      'A month of content in one run: research the language, plan 20-30 dated posts batched by theme week, then visual direction and a claims pass. Research → copy (gate → planner) → design → compliance.',
    budgetEstCents: 250,
    steps: [
      {
        expert: 'research',
        instruction:
          'Research the niche for a month of content. Sweep Reddit and one social platform broadly across the brief\'s problem keywords, mine the pain language, the objections, and the questions the audience keeps asking, then save a research-brief artifact with the 3-5 biggest themes and the exact phrases to reuse. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Plan a 30-day content calendar from this research: 20-30 dated items across instagram, tiktok, and facebook, batched by theme week (each week rides ONE of the research themes), hooks pulled from the research language verbatim, formats mixed (feed, reel, story, carousel), one paid angle per week marked kind paid. Save a content-plan artifact with the exact documented items structure, every item dated across the next 30 days. Research brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'approve',
        handoff: { target: 'planner-cards', generate: false },
      },
      {
        expert: 'design',
        instruction:
          'Direct the visuals for this content plan: per theme week, name the format (colorblock, slideshow, reel cover), the short on-image text, and the mood in concrete words, reusing the house palette and type rules from context. Save a notes artifact the owner can hand to the content tools. Content plan:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
      {
        expert: 'compliance',
        instruction:
          'Review this month of content before it schedules: flag any income or results claim, guaranteed outcome, or platform-rule problem with the exact line, why it is a problem, and the safer rewrite — or state a clean pass plainly. Save a notes artifact. The plan and its visual direction:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'full-funnel-build',
    name: 'Full Funnel Build',
    description:
      'Research to a full funnel in one run: the offer gates, then the whole system fans out (lead magnet, opt-in funnel, nurture kit, sales funnel draft, planner cards), plus a post-purchase sequence and a claims pass. Research → strategist (gate → system) → email → compliance.',
    budgetEstCents: 300,
    steps: [
      {
        expert: 'research',
        instruction:
          'Research the niche for the funnel being built. Sweep Reddit and one social platform broadly across the brief\'s problem keywords, mine the pain language, the objections, and the buying triggers, then save a research-brief artifact with the 3-5 biggest themes and the exact phrases to reuse. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'strategist',
        instruction:
          'Turn this research brief into the offer the funnel sells. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles. Save an offer-brief artifact with the exact documented structure. Research brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'offer-brief',
        gate: 'approve',
        handoff: { target: 'system', generate: false },
      },
      {
        expert: 'email',
        instruction:
          'Write the post-purchase sequence for this offer: 4-5 emails from buyer welcome to the ascension ask, subject lines from the research language, one job per email (deliver the win, handle the first objection, the success story, the next-step offer). Save an email-outline artifact with the exact documented structure, campaignType post-purchase. Offer brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'email-outline',
        gate: 'auto',
        handoff: { target: 'email-kit', generate: true },
      },
      {
        expert: 'compliance',
        instruction:
          'Review this funnel\'s promise before the pages get copy: flag any income or results claim, guaranteed outcome, or platform-rule problem in the offer and the sequence with the exact line, why, and the safer rewrite — or state a clean pass plainly. Save a notes artifact. The system so far:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'paid-launch-system',
    name: 'Paid Launch System',
    description:
      'Ads and the funnel they point at: research the buying language, gate the offer into a sales funnel draft, gate the ad angles into paid planner cards, then creative direction and a paid-claims review. Research → strategist (gate → sales funnel) → copy (gate → paid cards) → design → compliance.',
    budgetEstCents: 350,
    steps: [
      {
        expert: 'research',
        instruction:
          'Mine the paid-angle language for this offer. Sweep Reddit and one social platform across the brief\'s problem keywords, deep dive ONE competitor voice whose content clearly converts, and roll up the exact pain phrases, the objections, and the words buyers use when they describe paying for a fix. Save a research-brief artifact. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'strategist',
        instruction:
          'Decide the offer the ads will sell. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles ranked by how directly they answer the paid objections. Save an offer-brief artifact with the exact documented structure. Research brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'offer-brief',
        gate: 'approve',
        handoff: { target: 'sales-funnel', generate: false },
      },
      {
        expert: 'copy',
        instruction:
          'Write the paid angles for this offer: 5 angles per platform (instagram, tiktok, facebook), each with the hook pulled from the research language verbatim, the primary text in the house voice, the call to action, and the landing destination it points at. Save an ad-angles artifact with the exact documented items structure. Offer brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'approve',
        handoff: { target: 'planner-cards', generate: false },
      },
      {
        expert: 'design',
        instruction:
          'Direct the creative for these paid angles: per angle, name the format (colorblock, slideshow, reel cover), the first-frame visual that stops the scroll, the short on-image text, and the mood in concrete words, reusing the house palette and type rules. Save a notes artifact. Ad angles:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
      {
        expert: 'compliance',
        instruction:
          'Run the paid-claims review on these ads: income and results claims need a real number from the evidence or they come out, guaranteed outcomes come out, platform ad policies apply. Flag the exact line, why it is a problem, and the safer rewrite — or state a clean pass plainly. Save a notes artifact. The ads and their creative direction:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'email-sequence-build',
    name: 'Email Sequence Build',
    description:
      'Two drafted email kits in one run: the nurture sequence builds immediately, the launch sequence waits for your approval, then a claims pass. Research → email (nurture, built) → email (launch, gate → built) → compliance.',
    budgetEstCents: 250,
    steps: [
      {
        expert: 'research',
        instruction:
          'Mine the audience language for email. Sweep Reddit and one social platform across the brief\'s problem keywords and roll up the exact phrases, the questions, and the objections worth answering in an inbox — these become subject lines. Save a research-brief artifact. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'email',
        instruction:
          'Write the nurture sequence from this language: 5-7 emails from first touch to the offer, subject lines from the research phrases verbatim, one job per email and one call to action, campaignType nurture-to-offer. Save an email-outline artifact with the exact documented structure. Research brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'email-outline',
        gate: 'auto',
        handoff: { target: 'email-kit', generate: true },
      },
      {
        expert: 'email',
        instruction:
          'Write the launch sequence that follows the nurture: 4-6 emails from cart open to cart close (the open, the objection handler, the proof email, the FAQ, the last call), subject lines from the research language, one job per email, campaignType launch. Save an email-outline artifact with the exact documented structure. The nurture sequence it follows:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'email-outline',
        gate: 'approve',
        handoff: { target: 'email-kit', generate: true },
      },
      {
        expert: 'compliance',
        instruction:
          'Review both sequences before they send: flag any income or results claim, false urgency, or guaranteed outcome with the exact line, why, and the safer rewrite — or state a clean pass plainly. Save a notes artifact. The launch sequence:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'repurpose-engine',
    name: 'Repurpose Engine',
    description:
      'Re-cut what already won: the analyst reads our own numbers, copy turns the proven winners into 15-20 new dated posts, design directs the re-cuts. Analyst → copy (gate → planner) → design.',
    budgetEstCents: 150,
    steps: [
      {
        expert: 'analyst',
        instruction:
          'Read our own numbers for what already worked. Pull internal_metrics for the brief\'s offer (house-wide when unscoped): the top clicked and top converting pieces this month quoted exactly, with the paid/organic split named and thin data said out loud. Save a research-brief artifact listing the 5-10 proven winners and the angle each one rode. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Repurpose the proven winners into a fresh calendar: 15-20 dated items across instagram, tiktok, and facebook over the next 3 weeks. Each item re-cuts ONE named winner — new hook from the same audience language, new format, same proven angle — and its notes field names the winner it re-cuts. Save a content-plan artifact with the exact documented items structure. The winners:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'approve',
        handoff: { target: 'planner-cards', generate: false },
      },
      {
        expert: 'design',
        instruction:
          'Direct the visuals for these re-cuts: per item, name the format that fits its platform, the short on-image text, and the mood in concrete words, reusing the house palette and type rules. Where a re-cut changes format from its winner, say what carries over. Save a notes artifact. Content plan:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'launch-week',
    name: 'Launch Week',
    description:
      'The full arc in one run: research, gate the offer into the whole system (lead magnet, opt-in, nurture kit, sales funnel, cards), gate the paid angles into paid cards, the organic calendar, the cart open-close sequence, then direction and a claims pass. The mega-recipe.',
    budgetEstCents: 450,
    steps: [
      {
        expert: 'research',
        instruction:
          'Research the niche for launch week. Sweep Reddit and one social platform broadly across the brief\'s problem keywords, deep dive ONE competitor voice, and roll up the pain language, the objections, and the buying triggers with the exact phrases to reuse. Save a research-brief artifact with the 3-5 biggest themes. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'strategist',
        instruction:
          'Turn this research into the launch offer. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles. Save an offer-brief artifact with the exact documented structure. Research brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'offer-brief',
        gate: 'approve',
        handoff: { target: 'system', generate: false },
      },
      {
        expert: 'copy',
        instruction:
          'Write the paid angles for launch week: 3 angles per platform (instagram, tiktok, facebook), each with the hook from the research language verbatim, the primary text, the call to action, and the landing destination. Save an ad-angles artifact with the exact documented items structure. Offer brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'approve',
        handoff: { target: 'planner-cards', generate: false },
      },
      {
        expert: 'copy',
        instruction:
          'Plan the organic launch-week calendar that supports these paid angles: 7-10 dated items across instagram and tiktok from cart open to cart close, hooks from the research language verbatim, warm-up posts before the open and urgency posts before the close. Save a content-plan artifact with the exact documented items structure. The paid angles:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
        handoff: { target: 'planner-cards', generate: false },
      },
      {
        expert: 'email',
        instruction:
          'Write the launch-week sales sequence: 5-6 emails from cart open to cart close (the open, the objection handler, the proof email, the FAQ, the last call), subject lines from the research language, one job per email, campaignType launch. Save an email-outline artifact with the exact documented structure. The launch calendar:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'email-outline',
        gate: 'auto',
        handoff: { target: 'email-kit', generate: true },
      },
      {
        expert: 'design',
        instruction:
          'Direct the visuals for launch week: per channel (paid angles, organic calendar, email headers), name the format, the short on-image text, and the mood in concrete words, reusing the house palette and type rules so the whole week reads as one campaign. Save a notes artifact. The launch sequence:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
      {
        expert: 'compliance',
        instruction:
          'Run the final claims pass on launch week: income and results claims need a real number from the evidence or they come out, urgency must be real (the cart close date or it comes out), platform ad policies apply to the paid angles. Flag the exact line, why, and the safer rewrite — or state a clean pass plainly. Save a notes artifact. The launch system:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'notes',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'influencer-panel',
    name: 'Influencer Panel',
    description:
      'Deep dive every voice in the brief: posts ranked by real engagement, comments mined on the winners, then the cross-creator hook bank. Research × 2 → copy, no gates.',
    budgetEstCents: 250,
    steps: [
      {
        expert: 'research',
        instruction:
          'Deep dive the influencer panel for the brief, FIRST HALF: the first 1-2 competitor voices in the brief\'s list (voice_deep_dive when the session is on Deep, voice_audit otherwise). Per voice: rank their posts by real engagement, mine the comments on the top 3-5 winners, and roll up the phrases and questions that audience keeps repeating. Save a research-brief artifact with what performs per voice and the exact audience language. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'research',
        instruction:
          'Finish the influencer panel: deep dive the NEXT 1-2 voices in the brief\'s list the same way, then post_comments on the 3 strongest posts ACROSS the whole panel (the previous brief names them) — the audiences\' exact words under content that already won. Save a research-brief artifact comparing the voices: what performs everywhere vs what one voice owns. The panel so far:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Build the cross-creator hook bank: 8-10 hooks in OUR voice (house rules), each borrowed from a winning pattern or an audience phrase in this panel research, and each naming the voice and the pattern it borrows. Save an ad-angles artifact with the exact documented items structure. The panel comparison:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'comment-mining-sweep',
    name: 'Comment Mining Sweep',
    description:
      'Find the posts that already won across TikTok, X, and Instagram, then mine the comments under them for the audience\'s exact words. Research × 2 → copy, no gates.',
    budgetEstCents: 250,
    steps: [
      {
        expert: 'research',
        instruction:
          'Find the content that already won. On a Deep session use top_posts across the brief\'s problem keywords on TikTok, X, and Instagram (a DIFFERENT keyword per platform, results ranked by real engagement, URLs kept); on a standard session use social_search the same way and say the deep lane is off. Save a research-brief artifact with the 8-10 winning posts, their engagement numbers quoted exactly, and the keyword that found each. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'research',
        instruction:
          'Mine the comments under those winners. On a Deep session run post_comments on the 5-8 strongest posts from this brief (whatever platforms the URLs are) and roll up the phrases and questions with the computed counts; on a standard session voice_audit the creators behind the 2 strongest posts for their comment language instead. Save a research-brief artifact with the audience\'s exact words, quoted, counts included. The winners:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Write hooks from the comment language verbatim: 8-10 hooks, each quoting or lightly reshaping an exact comment phrase (keep its words), each noting the post and platform it came from. Save an ad-angles artifact with the exact documented items structure. The comment mining:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'cross-channel-sweep',
    name: 'Cross-Channel Sweep',
    description:
      'Every channel in one sweep: X, TikTok, Instagram, YouTube, and Reddit with a different keyword each, plus cited web passes on LinkedIn and Facebook. Research × 2 → copy, no gates.',
    budgetEstCents: 250,
    steps: [
      {
        expert: 'research',
        instruction:
          'Sweep the first three channels, one keyword each: social_search (top_posts on a Deep session) on X with the brief\'s FIRST problem keyword, TikTok with the SECOND, Instagram with the THIRD — never the same query twice. Then one cited web_search pass on LinkedIn conversations in this problem space (search-cited, not scraped — say so). Save a research-brief artifact with the themes per channel and the exact phrases. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'research',
        instruction:
          'Sweep the remaining channels: YouTube search with the brief\'s NEXT problem keyword, reddit_deep_dive across the brief\'s subreddits with a DIFFERENT keyword per subreddit, then one cited web_search pass on Facebook group conversations (search-cited, not scraped — say so). Save a research-brief artifact merging the picture: which themes live on which channel, and where the same pain shows up in different words. The first three channels:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Build the platform-angle map: 8-10 angles, each naming the platform it fits, the theme it rides, and the hook in the audience\'s words from that channel — the LinkedIn and Facebook angles marked as search-sourced. Save an ad-angles artifact with the exact documented items structure. The channel sweeps:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'reddit-rabbit-hole',
    name: 'Reddit Rabbit Hole',
    description:
      'Every subreddit in the brief, one dive each, threads and top comments: the objections ranked and the questions worth answering. Research → copy, no gates.',
    budgetEstCents: 150,
    steps: [
      {
        expert: 'research',
        instruction:
          'Go down the Reddit rabbit hole: reddit_deep_dive in EVERY subreddit in the brief\'s list, one dive per sub with a DIFFERENT problem keyword each — threads by score AND the top comments, the pullpush fallback when a source fails. Roll up per subreddit: the objections, the questions people keep asking, and the exact phrases. Save a research-brief artifact with all of it, sources named. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Turn the rabbit hole into the objections-and-questions digest: the objections ranked by repetition, each quoted exactly with its subreddit, and the questions worth answering in content, each as a hook in the audience\'s words. Save an ad-angles artifact with the exact documented items structure. The rabbit hole:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'video-deep-dive',
    name: 'Video Deep Dive',
    description:
      'The video lane end to end: TikTok and YouTube winners ranked, their comments mined, the strongest creators deep-dived, then the video content plan. Research × 2 → copy, no gates.',
    budgetEstCents: 250,
    steps: [
      {
        expert: 'research',
        instruction:
          'Find the video content that already won. On a Deep session use top_posts on TikTok and YouTube across the brief\'s problem keywords (a DIFFERENT keyword per platform, ranked by real engagement, URLs kept), then post_comments on the top 3-5 per platform; on a standard session use social_search plus voice_audit on one video creator and say the deep lane is off. Save a research-brief artifact with the winners, the engagement numbers quoted exactly, and the comment language. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'research',
        instruction:
          'Deep dive the 1-2 strongest video creators from this brief (voice_deep_dive on Deep, voice_audit otherwise): their posts ranked, the comments on their winners, the phrase rollup — what formats and first-frames their audience rewards. Save a research-brief artifact comparing the creators\' patterns. The video winners:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Plan the video content: 8-10 dated items for TikTok, reels, and shorts, each with the hook in the comment language verbatim, the format (talking head, b-roll, slideshow), the first-frame text, and the pattern it borrows. Save a content-plan artifact with the exact documented items structure. The creator comparison:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'audience-mosaic',
    name: 'The Audience Mosaic',
    description:
      'The full evidence picture in one run: every channel, the influencer panel, Reddit and YouTube, then the unified themes map and the master hook bank gated into the planner. The daily budget gate may stretch this one across two days — that is the spend safety working.',
    budgetEstCents: 450,
    steps: [
      {
        expert: 'research',
        instruction:
          'Open the mosaic: sweep X, TikTok, and Instagram with a DIFFERENT problem keyword per platform (top_posts on a Deep session, social_search otherwise), plus one cited web_search pass on LinkedIn conversations (search-cited, not scraped — say so). Themes and exact phrases per channel. Save a research-brief artifact. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'research',
        instruction:
          'Add the influencer panel: deep dive the first 2 voices in the brief\'s list (voice_deep_dive on Deep, voice_audit otherwise) — posts ranked by real engagement, comments on the winners mined, the phrase rollup per voice. Save a research-brief artifact with what performs per voice and the audience language. The channel sweep:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'research',
        instruction:
          'Close the evidence loop: reddit_deep_dive across the brief\'s subreddits with a DIFFERENT keyword per sub, YouTube search with the remaining keyword, and one cited web_search pass on Facebook group conversations (search-cited, not scraped — say so). Save a research-brief artifact with the full picture: every theme, its channel, its exact phrases. The panel:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'research-brief',
        gate: 'auto',
      },
      {
        expert: 'strategist',
        instruction:
          'Build the unified themes map from ALL the evidence: which themes live on which channel, which voice owns which angle, and the ONE theme every channel shares. Rank 6-8 angles by cross-channel evidence strength, each named with its channels and its exact phrases. Save an ad-angles artifact with the exact documented items structure. The full picture:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'ad-angles',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Turn the themes map into the master hook bank: 12-15 dated items across instagram, tiktok, facebook, and linkedin over the next 2 weeks — hooks verbatim from the evidence phrases, organic items plus 3 paid-test angles marked kind paid, each item noting the channel and the voice it borrows from. Save a content-plan artifact with the exact documented items structure. The themes map:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'approve',
        handoff: { target: 'planner-cards', generate: false },
      },
    ],
  },
  {
    slug: 'reel-cue-autopilot',
    name: 'Reel Cue Autopilot',
    description:
      'Reads a reel\'s indexed transcript and proposes image fly-in beats (word + image prompt + style hint), then — after you approve the list — matches the Media Library first (free) and generates what\'s missing, and attaches the cues to the reel. Design (gate → reel-cues).',
    budgetEstCents: 120,
    steps: [
      {
        expert: 'design',
        instruction:
          'The brief is a Reel Studio export: it names the reel project id (REEL_PROJECT_ID) and each scene\'s clip id with its INDEXED transcript (index: word (start–end seconds)). Propose up to 8 image fly-in beats — the Submagic/Opus b-roll beat: pick the STRONG visual words (things, numbers, outcomes, named places — never glue words like "really" or "going"), one beat per word, spread across scenes so they don\'t cluster. Per beat write the image prompt (concrete, photographic, on-brand for a vertical reel card) and an optional style hint (widthPct 15–80, xPct/yPct 0–90 — default is a top-right card at 34% width). Save a reel-cue-plan artifact: { projectId, beats: [{ clipId, wordIndex, word, imagePrompt, style? }] } — wordIndex must be the EXACT index from the transcript line, and clipId the EXACT id from the scene header. The reel export:\n\n{input}',
        inputFrom: 'brief',
        outputArtifact: 'reel-cue-plan',
        gate: 'approve',
        handoff: { target: 'reel-cues', generate: true },
      },
    ],
  },
  {
    slug: 'system-blueprint',
    name: 'System Blueprint',
    description:
      'Draft the source material for a System Map blueprint: the offer decision (gated), the nurture outline, and the launch content. The artifacts it produces are what "Create a blueprint → From research" aims at the map — the blueprint creator assembles them into the connected subgraph (funnel + emails + links + content) as a pending overlay for approval. Strategist (gate) → email → copy.',
    budgetEstCents: 200,
    steps: [
      {
        expert: 'strategist',
        instruction:
          'Decide the offer this system sells, from the brief and our numbers. Pick the ONE promise the evidence supports best, the mechanism that delivers it in one sitting, the price point, and 3-5 angles. Save an offer-brief artifact with the exact documented structure — this becomes the blueprint\'s funnel + pages. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'offer-brief',
        gate: 'approve',
      },
      {
        expert: 'email',
        instruction:
          'Write the nurture sequence for this offer: 4-5 emails from opt-in to the ask, subject lines from the research language, one job per email, campaignType nurture-to-offer. Save an email-outline artifact with the exact documented structure — this becomes the blueprint\'s nurture node. Offer brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'email-outline',
        gate: 'auto',
      },
      {
        expert: 'copy',
        instruction:
          'Plan the launch content that feeds this system: 5-7 posts across instagram and tiktok, hooks pulled from the research language verbatim, one paid angle. Save a content-plan artifact with the exact documented items structure — these become the blueprint\'s content + link nodes. The offer and its sequence:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'content-plan',
        gate: 'auto',
      },
    ],
  },
  {
    slug: 'lead-magnet-reel-day',
    name: 'Lead Magnet Reel Day',
    description:
      'The daily lead-magnet reel: decide the magnet, build + publish it as HTML, write the reel script with hooks + filming recs, then choose — gate it behind an opt-in page (delivers by email) or give it away free. Strategist (gate) → build magnet → reel brief (gate) → gated delivery (gate: approve = opt-in + email, cancel = free link).',
    budgetEstCents: 180,
    steps: [
      {
        expert: 'leadmagnet',
        instruction:
          'Decide today\'s lead magnet from the brief: the FIRST slice of the offer\'s promise, consumable in one sitting, that the reel will give away. Save a lead-magnet artifact with the exact documented structure (title, format, promise, audience, outline, cta). Approving this builds + publishes the magnet as a styled HTML page. Brief goal: {input}',
        inputFrom: 'brief',
        outputArtifact: 'lead-magnet',
        gate: 'approve',
        handoff: { target: 'leadgen-kit', generate: true },
      },
      {
        expert: 'strategist',
        instruction:
          'Write the reel that gives this magnet away today. The spoken hook (the first 1-2s pattern interrupt), 3-6 script beats, the closing CTA pointing at the magnet, 3-5 hook variants, and the filming recommendations (shot list, framing, the chaos-then-calm interrupt). Save a reel-brief artifact with the documented structure (title, hook, beats, cta, hooks, filming, magnetTitle, linkUrl). Approving creates the reel project + the planner card. The magnet:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'reel-brief',
        gate: 'approve',
        handoff: { target: 'reel-brief', generate: true },
      },
      {
        expert: 'strategist',
        instruction:
          'Decide the delivery. GATE IT: the magnet sits behind an opt-in page and the delivery email sends it (approve to build both). GIVE IT AWAY FREE: cancel this step — the magnet\'s public link stays the reel\'s CTA and nothing gated is built. Either way, re-emit the reel-brief artifact (same documented structure) with linkUrl set to the opt-in page when gating, or the magnet\'s public link when free. The brief:\n\n{input}',
        inputFrom: 'previous',
        outputArtifact: 'reel-brief',
        gate: 'approve',
        handoff: { target: 'gated-delivery', generate: true },
      },
    ],
  },
];
