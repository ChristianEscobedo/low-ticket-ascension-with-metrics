/**
 * Owner-supplied frameworks for the Community Kit generator.
 *
 * Each module is authoritative guidance the generator concatenates into the
 * system prompt (like `guides` in openai-content.ts). Swapping any module here
 * visibly changes the matching section's output without touching generation
 * logic.
 */
import { QUALIFYING_QUESTIONS_FRAMEWORK } from './qualifying-questions';
import { DM_SCRIPTS_FRAMEWORK } from './dm-scripts';
import { SALES_CALL_FRAMEWORK } from './sales-call';
import { ADS_STYLE_FRAMEWORK } from './ads-style';
import { PINNED_POST_FRAMEWORK } from './pinned-post';
import { LEAD_FORM_FRAMEWORK } from './lead-form';
import {
  NAMES_FRAMEWORK,
  DESCRIPTION_FRAMEWORK,
  NAMES_DESCRIPTION_FRAMEWORK,
} from './names-description';

export interface CommunityFrameworks {
  names: string;
  description: string;
  namesDescription: string;
  qualifyingQuestions: string;
  dmScripts: string;
  salesCall: string;
  adsStyle: string;
  pinnedPost: string;
  leadForm: string;
}

/** The single source of truth the generator reads. */
export const COMMUNITY_FRAMEWORKS: CommunityFrameworks = {
  names: NAMES_FRAMEWORK,
  description: DESCRIPTION_FRAMEWORK,
  namesDescription: NAMES_DESCRIPTION_FRAMEWORK,
  qualifyingQuestions: QUALIFYING_QUESTIONS_FRAMEWORK,
  dmScripts: DM_SCRIPTS_FRAMEWORK,
  salesCall: SALES_CALL_FRAMEWORK,
  adsStyle: ADS_STYLE_FRAMEWORK,
  pinnedPost: PINNED_POST_FRAMEWORK,
  leadForm: LEAD_FORM_FRAMEWORK,
};

export {
  NAMES_FRAMEWORK,
  DESCRIPTION_FRAMEWORK,
  NAMES_DESCRIPTION_FRAMEWORK,
  QUALIFYING_QUESTIONS_FRAMEWORK,
  DM_SCRIPTS_FRAMEWORK,
  SALES_CALL_FRAMEWORK,
  ADS_STYLE_FRAMEWORK,
  PINNED_POST_FRAMEWORK,
  LEAD_FORM_FRAMEWORK,
};
