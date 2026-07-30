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
          'Paid runs are cached, not free',
          '<p>social_search and amazon_reviews cost money per call. Results cache for 7 days, so repeat questions do not re-bill, but wildly different queries each cost a run.</p>',
        ),
      ),
      step(
        4,
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
];
