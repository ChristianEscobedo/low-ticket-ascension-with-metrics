import {
  html,
  introBox,
  step,
  callout,
  table,
  type SeedArticle,
} from './helpers';

/** Research Lab (/admin/research) admin guide. */
export const researchLab: SeedArticle[] = [
  {
    slug: 'research-lab',
    title: 'Research Lab: plan offers with real data',
    category: 'Planning',
    excerpt:
      'Chat with the research agent: pull social posts, Amazon reviews, web search, and your own metrics, then hand the plan off to the Planner and the kit builders.',
    body: html(
      introBox([
        ['Where', '/admin/research (sidebar: Research Lab)'],
        ['Keys', '/admin/integrations, Research Lab sources (Monid + RapidAPI)'],
        ['Cost', 'Monid + RapidAPI bill per run; results are cached in the app'],
      ]),
      '<p>The Research Lab is where offers get decided before anything gets built. You chat with the research agent. It can pull outside data (social posts, Amazon reviews, web search) and inside data (your tracked-link clicks, opt-ins, purchases, and revenue), then save what it concludes as <strong>artifacts</strong>: briefs, plans, and concepts.</p>',
      step(
        1,
        'Start a session',
        '<p>Open /admin/research and click <strong>New</strong>. Optionally scope the session to an offer in the header dropdown; the agent then treats that offer\'s facts as authoritative. Type what you are researching in plain language.</p>',
      ),
      step(
        2,
        'Fill the research brief first',
        '<p>Before the first message, open the <strong>Brief</strong> panel. The offer name is not a research query, so the agent searches with seeds instead: problem keywords, category analogs, competitor products, competitor voices, and subreddits. Two ways to fill it: <strong>Suggest from offer</strong> (instant, drafted from the offer context) or <strong>Find research context</strong> (searches the web for real products, influencers, and communities to watch). Everything is editable, and you can drop an Amazon link or influencer profile in the link field and it lands in the right list.</p>',
      ),
      step(
        3,
        'Let it pull data',
        '<p>Watch the <strong>Reasoning</strong> trace under each reply: every tool call shows what was asked and what came back. The agent has eight tools:</p>',
        table(
          ['Tool', 'What it pulls', 'Source'],
          [
            ['web_search', 'Topics, trends, competitor angles (cited)', 'Claude / OpenAI native search'],
            ['social_search', 'Real posts from X, TikTok, Instagram, Reddit, YouTube', 'Monid gateway'],
            ['voice_audit', 'A creator\'s posts ranked by engagement rate + top comments', 'Monid gateway'],
            ['reddit_deep_dive', 'Threads AND top comments: raw pain language', 'Monid gateway'],
            ['amazon_reviews', 'Review digests with low-star objections kept', 'RapidAPI real-time-amazon-data'],
            ['internal_metrics', 'Your clicks, opt-ins, purchases, attributed revenue', 'Your tracked links'],
            ['get_context', 'Offer + kit + brand facts', 'Context Bridge'],
            ['create_artifact', 'Saves a durable output', 'The artifacts panel'],
          ],
        ),
        '<p><strong>Deep research mode</strong> (the Standard/Deep toggle in the header or the brief panel) adds three more for the sessions where you need real performance data: <strong>top_posts</strong> ranks a topic\'s posts by engagement so you see which posts actually perform best, <strong>post_comments</strong> mines the comments on one post, reel, or YouTube video, and <strong>voice_deep_dive</strong> does the full influencer read in one call: the creator\'s posts ranked, comments on the winners, and a rollup of the exact phrases and questions the audience repeats. Deep mode spends more per turn, so it is opt-in per session; standard sessions are untouched.</p>',
        callout(
          'warn',
          'Paid runs are cached and capped',
          '<p>social_search and amazon_reviews cost money per call. Results cache for 7 days, so repeat questions do not re-bill — cached calls show a brass <strong>cached</strong> badge in the trace. There is also a daily budget (25 paid runs / about $2.00 per session): when it is hit the agent says so plainly instead of spending, and the header shows today\'s usage.</p>',
        ),
        '<p><strong>Live result cards</strong> render under each reply: the post ladder ranked by engagement, the comment threads, the review table — the actual data, not a summary of it. Any card item can be pinned into evidence in one click. The <strong>Phrases</strong> chips above the artifacts rail roll up what the audience keeps saying across every pull, with a trend marker for what is new or rising this week.</p>',
      ),
      step(
        4,
        'Pin evidence as you go',
        '<p>Select any text in the chat and the <strong>Pin as evidence</strong> button appears — quotes, phrases, and numbers land in the <strong>Evidence</strong> rail with their source and age. This is the compounding asset: the phrase bank, the semantic search box (find evidence by meaning, not keywords), and every future session\'s brief all read from it. The agent remembers too: what past research proved rides into each new session as cross-session memory.</p>',
      ),
      step(
        5,
        'Re-verify and measure',
        '<p>Two header buttons close the loop once a research brief exists. <strong>Re-verify</strong> re-checks the brief against fresh data and shows the diff — what is new, what is gone, what held. <strong>Outcomes</strong> reads your own numbers and writes an outcome digest: what the pieces you handed off actually did, linked to the research that produced them. Research → build → publish → measure → learn.</p>',
      ),
      step(
        6,
        'Save and hand off',
        '<p>When the conversation produces something worth keeping, the agent saves it as an artifact in the right rail. Open it, edit the markdown if needed, then hand it off. Two depths: <strong>Draft</strong> creates the thing with the intake pre-filled (you press Generate in the editor), and <strong>Build</strong> creates it AND runs the editor\'s own generation pipeline, so you land on a drafted document:</p>',
        table(
          ['Artifact', 'Handoff'],
          [
            ['Content plan / Ad angles', 'Send to Planner (creates dated cards)'],
            ['Lead magnet concept', 'Draft or Build Lead Gen Kit'],
            ['Email outline', 'Draft or Build Email Kit'],
            ['Offer brief', 'Funnel Draft, or Build Full System (magnet + opt-in funnel + nurture emails + sales funnel + planner cards in one click)'],
          ],
        ),
        '<p>The artifact stays marked <em>sent</em> with a link to what it created, so research always traces to what it produced.</p>',
      ),
      callout(
        'tip',
        'Ask for numbers first',
        '<p>The agent is instructed to quote internal_metrics exactly and to prefer them over guesses. "What should I double down on?" is a strong first question once posts have been tracked for a while.</p>',
      ),
    ),
    published: true,
    sortOrder: 60,
  },
  {
    slug: 'agent-recipes',
    title: 'Agent Recipes: run the crew on a play',
    category: 'Planning',
    excerpt:
      'One click runs a whole play: research, strategy, copy, and the build handoffs — with a human gate on the decision, background runs, and weekly watch digests.',
    body: html(
      introBox([
        ['Where', '/admin/recipes (sidebar: Recipes), /admin/experts'],
        ['Runs in', 'a Research Lab session (pick one, or a new one is created)'],
        ['Cost', 'each recipe shows its estimated budget before it runs'],
      ]),
      '<p>Recipes are the Research Lab\'s plays: a declarative list of steps, each run by a named expert, passing typed artifacts to the next step. The crew lives in <strong>/admin/experts</strong> — Research, Atlas (strategy), Wren (copy), Nova (lead magnets), Ember (email), Pixel (design), Rook (compliance), Sage (analyst) — and every one runs on the same loop as the research agent with its own persona, tool lane, and artifact contract.</p>',
      step(
        1,
        'Pick a play',
        '<p>Open /admin/recipes. The house plays, smallest to biggest: <strong>Niche Watch</strong> (this week\'s themes into ad angles) and <strong>Voice Check</strong> (a competitor voice into hooks in our voice) — the unattended watchers. <strong>Low-Ticket Launch</strong> (research the niche → the offer decision → the launch content) and <strong>Full System</strong> (the offer decision fans out into a sales funnel draft, a built lead magnet kit, a built nurture email kit, and planner cards). The deep research set (ungated, artifact-only, Watch-weekly eligible — Deep sessions get the full lane): <strong>Influencer Panel</strong> (every voice in the brief deep-dived, comments mined, the cross-creator hook bank), <strong>Comment Mining Sweep</strong> (the posts that already won across TikTok/X/Instagram, then the exact words under them), <strong>Cross-Channel Sweep</strong> (X, TikTok, Instagram, YouTube, and Reddit with a different keyword each, plus cited web passes on LinkedIn and Facebook), <strong>Reddit Rabbit Hole</strong> (every subreddit in the brief, objections ranked, questions harvested), and <strong>Video Deep Dive</strong> (TikTok + YouTube winners, comments mined, the video content plan). The builder fleet: <strong>Bulk Content Engine</strong> (a 30-day calendar of 20-30 dated posts gated into the Planner, then design direction and a claims pass), <strong>Full Funnel Build</strong> (research → the gated offer fans out into the WHOLE system — lead magnet, opt-in funnel, nurture kit, sales funnel, cards — plus a post-purchase sequence), <strong>Paid Launch System</strong> (the ads AND the funnel they point at, with a paid-claims review), <strong>Email Sequence Build</strong> (two drafted email kits in one run: nurture builds immediately, launch waits for your approval), <strong>Repurpose Engine</strong> (the analyst reads your own numbers and copy re-cuts the proven winners into 15-20 new posts), and <strong>Launch Week</strong> (the mega-recipe: the whole arc from research to gated system fan-out, paid angles, the organic calendar, and the cart open-close sequence). The flagship: <strong>The Audience Mosaic</strong> (every channel + the influencer panel + Reddit/YouTube → the unified themes map → the master hook bank gated into the Planner). Each card shows the steps and the estimated cost.</p>',
      ),
      step(
        2,
        'Run it, watch it, gate it',
        '<p>Choose the session and press Run — or skip the trip: the <strong>Plays</strong> section in the research chat\'s right rail runs any play in the session you are already in, shows the same live steps, and has the same gate buttons. The run executes in the background — the runs feed shows each step as it lands, with the artifact it produced, and the expert\'s turns stream into the session\'s chat transcript. Steps marked with a gate pause for you: read the artifact, then <strong>Approve & continue</strong> or <strong>Cancel</strong>. A gated step never builds downstream work before you approve it — the funnel fan-out, the paid planner cards, and the second email kit all wait for your decision. Steps after a handoff (design direction, the compliance pass) run automatically, so when the run finishes the assets exist AND the session holds the visual direction and the flags for them.</p>',
      ),
      step(
        3,
        'Watch a niche weekly',
        '<p>The <strong>Watch weekly</strong> toggle on a recipe card queues that play against the session every week (the daily 8am cron finds watches due — active and never run, or stale by 7 days). The digest lands as a new artifact in the watched session, so the niche compounds instead of resetting.</p>',
      ),
      callout(
        'tip',
        'The crew is editable',
        '<p>/admin/experts edits every persona: the prompt, the model, the tool policy, the artifact contract. A policy can only NARROW an expert\'s tools, never widen them, and every artifact stamps who made it, so the artifact tree always shows how a thing was made.</p>',
      ),
    ),
    published: true,
    sortOrder: 61,
  },
];
