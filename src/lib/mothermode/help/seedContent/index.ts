import type { SeedArticle } from './helpers';
import { gettingStarted } from './gettingStarted';
import { offersFunnels } from './offersFunnels';
import { contentHub } from './contentHub';
import { planner } from './planner';
import { kits } from './kits';
import { deliverablesBrand, adminSystem } from './system';
import { researchLab } from './researchLab';
import { reelStudio } from './reelStudio';
import { buyerHelp } from './buyerHelp';

export type { SeedArticle, SeedChangelog } from './helpers';

/** The assembled starter knowledge base, in category order. The first seven
 *  groups are admin docs (how to run the app); the last is buyer-facing help
 *  (how to use a purchase), shown publicly at /mothermode/help. */
export const HELP_CENTER_SEED_ARTICLES: SeedArticle[] = [
  ...gettingStarted,
  ...offersFunnels,
  ...contentHub,
  ...planner,
  ...kits,
  ...deliverablesBrand,
  ...adminSystem,
  ...researchLab,
  ...reelStudio,
  ...buyerHelp,
];
