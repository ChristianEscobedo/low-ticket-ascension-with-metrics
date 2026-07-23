/**
 * Lead-magnet format library, aggregated into one record keyed by
 * LeadMagnetFormat. Each format is a plain data module describing the skeleton
 * the generator must follow plus an authoring-style note. Swapping a format
 * module visibly changes the matching document's structure without touching
 * generation logic (mirrors highticket/frameworks/index.ts).
 */
import type { LeadMagnetFormat, LeadMagnetFormatSpec } from '../types';
import { ebook } from './ebook';
import { guide } from './guide';
import { cheatsheet } from './cheatsheet';
import { sop } from './sop';
import { course } from './course';
import { minicourse } from './minicourse';
import { template } from './template';
import { checklist } from './checklist';
import { worksheet } from './worksheet';
import { swipefile } from './swipefile';

/** Every lead-magnet format, keyed by its LeadMagnetFormat enum value. */
export const LEAD_MAGNET_FORMAT_SPECS: Record<LeadMagnetFormat, LeadMagnetFormatSpec> = {
  ebook,
  guide,
  cheatsheet,
  sop,
  course,
  minicourse,
  template,
  checklist,
  worksheet,
  swipefile,
};

/** The spec for one format. */
export function formatSpec(format: LeadMagnetFormat): LeadMagnetFormatSpec {
  return LEAD_MAGNET_FORMAT_SPECS[format];
}

/** Formats that render nested lessons (course-style). */
export function formatUsesLessons(format: LeadMagnetFormat): boolean {
  return format === 'course' || format === 'minicourse';
}

/** [{ value, label, hint }] for the admin format picker. */
export function formatOptions(): Array<{
  value: LeadMagnetFormat;
  label: string;
  hint: string;
}> {
  return (Object.keys(LEAD_MAGNET_FORMAT_SPECS) as LeadMagnetFormat[]).map((value) => ({
    value,
    label: LEAD_MAGNET_FORMAT_SPECS[value].label,
    hint: LEAD_MAGNET_FORMAT_SPECS[value].hint,
  }));
}
