import { describe, it, expect } from 'vitest';
import {
  normalizeTags,
  assetMatches,
  folderCounts,
  folderTree,
  tagRollup,
  type MediaAsset,
  type MediaFolder,
} from '@/lib/mothermode/reel/mediaLibrary';

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: 'a1',
  name: 'Hook clip',
  url: 'https://x/a.mp4',
  kind: 'video',
  source: 'vault',
  durationSec: 3,
  thumbnailUrl: null,
  folderId: null,
  tags: [],
  refId: null,
  refKind: null,
  createdAt: null,
  ...over,
});

describe('media library helpers', () => {
  it('normalizes tags: lowercase, dashes, dedupe, no empties', () => {
    expect(normalizeTags([' Hook ', 'HOOK', 'money talk', '', '  '])).toEqual([
      'hook',
      'money-talk',
    ]);
  });

  it('matches by name, tag, source, or kind (case-insensitive)', () => {
    const a = asset({ name: 'Shock Hook', tags: ['hook', 'money'] });
    expect(assetMatches(a, 'shock')).toBe(true);
    expect(assetMatches(a, 'MONEY')).toBe(true);
    expect(assetMatches(a, 'vault')).toBe(true);
    expect(assetMatches(a, 'video')).toBe(true);
    expect(assetMatches(a, 'zebra')).toBe(false);
    expect(assetMatches(a, '')).toBe(true);
  });

  it('counts assets per folder, including empty folders', () => {
    const folders: MediaFolder[] = [
      { id: 'f1', name: 'Hooks', parentId: null, color: null },
      { id: 'f2', name: 'Empty', parentId: null, color: null },
    ];
    const assets = [
      asset({ id: 'a1', folderId: 'f1' }),
      asset({ id: 'a2', folderId: 'f1' }),
      asset({ id: 'a3', folderId: null }),
    ];
    const counts = folderCounts(assets, folders);
    expect(counts.get('f1')).toBe(2);
    expect(counts.get('f2')).toBe(0);
    expect(counts.get(null)).toBe(1);
  });

  it('builds a folder tree: roots with their children', () => {
    const folders: MediaFolder[] = [
      { id: 'root', name: 'Assets', parentId: null, color: null },
      { id: 'kid', name: 'Hooks', parentId: 'root', color: null },
      { id: 'other', name: 'Other', parentId: null, color: null },
    ];
    const tree = folderTree(folders);
    expect(tree).toHaveLength(2);
    expect(tree.find((t) => t.folder.id === 'root')?.children.map((c) => c.id)).toEqual(['kid']);
    expect(tree.find((t) => t.folder.id === 'other')?.children).toEqual([]);
  });

  it('rolls up tags most-used first, alphabetical on ties', () => {
    const assets = [
      asset({ id: 'a1', tags: ['hook', 'money'] }),
      asset({ id: 'a2', tags: ['hook'] }),
      asset({ id: 'a3', tags: ['intro', 'money'] }),
    ];
    const roll = tagRollup(assets);
    expect(roll[0]).toEqual({ tag: 'hook', count: 2 });
    expect(roll[1]).toEqual({ tag: 'money', count: 2 });
    expect(roll[2]).toEqual({ tag: 'intro', count: 1 });
  });
});
