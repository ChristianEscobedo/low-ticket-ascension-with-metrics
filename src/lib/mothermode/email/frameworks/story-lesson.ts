import type { EmailFrameworkSpec } from '../types';

/** Story to lesson: a story, the extracted lesson, tie to the offer. */
export const storyLesson: EmailFrameworkSpec = {
  label: 'Story to lesson',
  structure: `STORY TO LESSON STRUCTURE
- Tell one short, concrete story (personal or a customer's).
- Extract the single lesson the story proves.
- Bridge that lesson to the resource, then one clear CTA.`,
  lengthTarget: 'medium',
  styleNote: `Lead with the story, not the moral. Keep it specific and human. The
lesson lands because the story earned it. One idea, one CTA.`,
};
