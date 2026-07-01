/**
 * Saved-version types and pure helpers for the Version Composer's library. A
 * SavedVersion is a composed post (hook + body + cta) the team keeps, schedules,
 * or marks published, scoped to the offer and the source piece it was built from.
 * This module is storage-agnostic and server-safe: the browser I/O lives in
 * src/components/mothermode/content/versionsClient.ts and the persistence in
 * src/utils/mothermode/versions-content.ts.
 */
import type { VersionParts } from './compose';

/** Where a saved version sits in the ship pipeline. */
export type VersionStatus = 'draft' | 'scheduled' | 'published';

/** A composed version the team has saved to the library. */
export interface SavedVersion extends VersionParts {
  /** Stable id, unique within (offer, piece). */
  id: string;
  status: VersionStatus;
  /** ISO timestamp the version is scheduled to publish, when status scheduled. */
  scheduledFor?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Email of the admin who last wrote it, for light attribution. */
  updatedBy?: string | null;
}

/** Human label for each status, for chips and counts. */
export const VERSION_STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'Saved',
  scheduled: 'Scheduled',
  published: 'Published',
};

/** Sort weight so scheduled (upcoming work) leads, then drafts, then published. */
export function versionStatusRank(status: VersionStatus): number {
  return status === 'scheduled' ? 0 : status === 'draft' ? 1 : 2;
}

/** Turn a freshly built version into a draft SavedVersion. The id and timestamp
 *  are passed in so this stays pure and unit-testable. */
export function makeSavedVersion(
  parts: VersionParts,
  id: string,
  now: string,
): SavedVersion {
  return {
    hook: parts.hook,
    body: parts.body,
    cta: parts.cta,
    image: parts.image,
    id,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

/** Return a copy scheduled for the given ISO time. */
export function scheduleVersion(
  v: SavedVersion,
  scheduledFor: string,
  now: string,
): SavedVersion {
  return { ...v, status: 'scheduled', scheduledFor, updatedAt: now };
}

/** Return a copy marked published, dropping any pending schedule. */
export function publishVersion(v: SavedVersion, now: string): SavedVersion {
  return {
    ...v,
    status: 'published',
    scheduledFor: undefined,
    updatedAt: now,
  };
}

/** Return a copy back in the draft state, dropping any pending schedule. */
export function unscheduleVersion(v: SavedVersion, now: string): SavedVersion {
  return { ...v, status: 'draft', scheduledFor: undefined, updatedAt: now };
}

/** Count saved versions per status, for the library header. */
export function countByStatus(
  versions: SavedVersion[],
): Record<VersionStatus, number> {
  const counts: Record<VersionStatus, number> = {
    draft: 0,
    scheduled: 0,
    published: 0,
  };
  for (const v of versions) counts[v.status] += 1;
  return counts;
}

/**
 * Stable display order: scheduled first (soonest time leads), then drafts and
 * published, each newest-first. Pure and total, so two equal lists never reorder.
 */
export function sortVersions(versions: SavedVersion[]): SavedVersion[] {
  return [...versions].sort((a, b) => {
    const rank = versionStatusRank(a.status) - versionStatusRank(b.status);
    if (rank !== 0) return rank;
    if (a.status === 'scheduled' && b.status === 'scheduled')
      return (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? '');
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}
