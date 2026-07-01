// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  VersionPreview,
  versionReview,
  versionPiece,
} from '@/components/mothermode/content/VersionPreview';
import { ViewToggle } from '@/components/mothermode/content/AmplifyComposer';
import { VersionChanges } from '@/components/mothermode/content/VersionChanges';
import { AmplifyIntro } from '@/components/mothermode/content/AmplifyIntro';
import type { ContentPiece, VersionParts } from '@/lib/mothermode/content';

// jsdom has no layout engine or ResizeObserver; stub it so Scaled can mount.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const piece: ContentPiece = {
  id: 'fb-feed-1',
  platform: 'facebook',
  format: 'feed',
  kind: 'organic',
  tone: 'confidante',
  theme: 'The mental load',
  title: 'Test piece',
  hook: 'Original hook',
  cta: 'Original cta',
  body: ['Original body'],
};

const version: VersionParts = {
  hook: 'Synth hook line',
  body: ['Synth body paragraph'],
  cta: 'Synth call to action',
};

afterEach(() => cleanup());

describe('versionReview', () => {
  it('maps the hook to the caption and the hook list', () => {
    const r = versionReview(version);
    expect(r.edits?.caption).toBe('Synth hook line');
    expect(r.edits?.hooks).toEqual(['Synth hook line']);
  });
  it('appends the cta after the body, blank-line joined', () => {
    expect(versionReview(version).edits?.body).toBe(
      'Synth body paragraph\n\nSynth call to action',
    );
  });
  it('drops empty parts and omits the cta when absent', () => {
    const r = versionReview({ hook: 'H', body: ['', '  ', 'Keep'], cta: '' });
    expect(r.edits?.body).toBe('Keep');
    expect(r.edits?.hooks).toEqual(['H']);
  });
  it('reflows the body to at most two sentences a block', () => {
    const r = versionReview({ hook: 'H', body: ['A. B. C. D.'], cta: 'Go.' });
    expect(r.edits?.body).toBe('A. B.\n\nC. D.\n\nGo.');
  });
  it("overrides the gallery with the version's own image", () => {
    const r = versionReview({ ...version, image: 'https://cdn/v.png' });
    expect(r.images).toEqual(['https://cdn/v.png']);
    expect(r.imageIndex).toBe(0);
  });
  it('leaves the gallery untouched when the version has no image', () => {
    expect(versionReview(version).images).toBeUndefined();
  });
});

describe('versionPiece', () => {
  it("swaps the piece's cta for the version's, leaving the rest intact", () => {
    const p = versionPiece(piece, version);
    expect(p.cta).toBe('Synth call to action');
    expect(p.id).toBe('fb-feed-1');
    expect(p.hook).toBe('Original hook');
  });
});

describe('VersionPreview (render)', () => {
  it('paints the version onto the platform card, not the originals', () => {
    const { container } = render(<VersionPreview piece={piece} version={version} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Synth hook line');
    expect(text).toContain('Synth body paragraph');
    expect(text).toContain('Synth call to action');
    expect(text).not.toContain('Original hook');
  });

  it('paints the version image as the post visual', () => {
    const { container } = render(
      <VersionPreview
        piece={piece}
        version={{ ...version, image: 'https://cdn/v.png' }}
      />,
    );
    expect(
      container.querySelector('img[src="https://cdn/v.png"]'),
    ).not.toBeNull();
  });

  it('renders a scaled, clickable tile when given a width', () => {
    const onEnlarge = vi.fn();
    const { container } = render(
      <VersionPreview piece={piece} version={version} width={264} onEnlarge={onEnlarge} />,
    );
    const btn = screen.getByTitle('Click to enlarge');
    const scaled = container.querySelector('[style*="scale"]') as HTMLElement | null;
    expect(scaled).not.toBeNull();
    expect(scaled!.style.transform).toContain('scale(');
    fireEvent.click(btn);
    expect(onEnlarge).toHaveBeenCalledTimes(1);
  });
});

describe('ViewToggle', () => {
  it('offers both views and reports a change', () => {
    const onChange = vi.fn();
    render(<ViewToggle value="visual" onChange={onChange} />);
    expect(screen.getByText('Visual')).toBeTruthy();
    fireEvent.click(screen.getByText('Text'));
    expect(onChange).toHaveBeenCalledWith('text');
  });

  it('marks the active view', () => {
    render(<ViewToggle value="visual" onChange={() => {}} />);
    expect(screen.getByText('Visual').className).toContain('text-mode');
    expect(screen.getByText('Text').className).not.toContain('text-mode');
  });
});

describe('VersionChanges', () => {
  const original: VersionParts = {
    hook: 'Original hook',
    body: ['Original body'],
    cta: 'Original cta',
  };
  it('marks rewritten parts as new and kept parts as kept', () => {
    const v: VersionParts = {
      hook: 'A fresh hook',
      body: ['Original body'],
      cta: 'Original cta',
    };
    render(<VersionChanges original={original} version={v} />);
    expect(screen.getByText('New hook')).toBeTruthy();
    expect(screen.getByText('body kept')).toBeTruthy();
    expect(screen.getByText('cta kept')).toBeTruthy();
  });
  it('collapses to a single note when nothing changed', () => {
    render(<VersionChanges original={original} version={original} />);
    expect(screen.getByText('Matches the original post.')).toBeTruthy();
  });
  it('carries the before/after in a chip tooltip', () => {
    const v: VersionParts = { ...original, hook: 'A fresh hook' };
    render(<VersionChanges original={original} version={v} />);
    const chip = screen.getByText('New hook');
    expect(chip.getAttribute('title')).toContain('Was: Original hook');
    expect(chip.getAttribute('title')).toContain('Now: A fresh hook');
  });
});

describe('AmplifyIntro', () => {
  it('shows the original post and what Amplify produces', () => {
    const { container } = render(<AmplifyIntro piece={piece} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Original hook');
    expect(text).toContain('Variant hooks');
    expect(text).toContain('Stronger CTAs');
  });
});
