/**
 * Framework registry. Maps each EmailFramework key to its spec (structure +
 * length target + style note) so the generator can inject the right authoring
 * guidance per email, and the editor can label the picker.
 */
import type { EmailFramework, EmailFrameworkSpec } from '../types';
import { EMAIL_FRAMEWORKS } from '../types';
import { soapOpera } from './soap-opera';
import { pas } from './pas';
import { valueLongform } from './value-longform';
import { storyLesson } from './story-lesson';
import { quickWin } from './quick-win';
import { founderNote } from './founder-note';
import { caseStudy } from './case-study';
import { objectionCrusher } from './objection-crusher';
import { listicle } from './listicle';

export const EMAIL_FRAMEWORK_SPECS: Record<EmailFramework, EmailFrameworkSpec> = {
  'soap-opera': soapOpera,
  pas,
  'value-longform': valueLongform,
  'story-lesson': storyLesson,
  'quick-win': quickWin,
  'founder-note': founderNote,
  'case-study': caseStudy,
  'objection-crusher': objectionCrusher,
  listicle,
};

/** Resolve one framework spec, defaulting to story-lesson if unknown. */
export function frameworkSpec(framework: EmailFramework): EmailFrameworkSpec {
  return EMAIL_FRAMEWORK_SPECS[framework] ?? storyLesson;
}

/** All framework keys in canonical order. */
export function allFrameworks(): EmailFramework[] {
  return [...EMAIL_FRAMEWORKS];
}
