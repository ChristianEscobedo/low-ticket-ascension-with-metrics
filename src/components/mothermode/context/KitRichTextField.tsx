'use client';

/**
 * A rich-text field for ADMIN KIT editing that serializes to HTML. Unlike the
 * content hub's `RichTextField` (which serializes to plain text for platform
 * posting), kit fields keep their markup so admins can fine-tune formatting.
 * The stored HTML is flattened back to plain text wherever it feeds a prompt or
 * a flat export, via `htmlToPromptText()` in '@/lib/mothermode/richtext'; the
 * email exporter preserves the markup through `emailBodyHtml()` so recipients
 * see the styling.
 *
 * Supported marks/nodes: headings (H2/H3), bold, italic, underline, strike,
 * bullet + ordered lists, blockquote, horizontal rule, links, inline images,
 * brand-palette text color + highlight, and paragraph alignment.
 *
 * Styled for the admin DARK theme (ink/bone/brass) so it sits inside the kit
 * editors without a jarring light surface.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  Link2Off,
  Image as ImageIcon,
  Palette,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
  Braces,
  type LucideIcon,
} from 'lucide-react';

/**
 * A merge token the editor can insert at the cursor, e.g. `{{first_name}}`.
 * Structurally compatible with `EmailMergeToken` but kept local so this field
 * stays decoupled from the email module and reusable by any kit editor. Pass a
 * non-empty `tokens` array to surface the Tokens dropdown in the toolbar.
 */
export interface RichTextToken {
  /** The full marker inserted into copy, e.g. '{{first_name}}'. */
  token: string;
  /** Short human label for the menu. */
  label: string;
  /** Optional helper text shown under the label. */
  description?: string;
}


/**
 * Brand-safe swatches. Constraining text color + highlight to a small palette
 * (rather than a free color wheel) protects the Editorial Warm look and keeps
 * every send on-brand.
 */
const TEXT_COLORS: { label: string; value: string }[] = [
  { label: 'Ink', value: '#211d17' },
  { label: 'Brass', value: '#c9a24b' },
  { label: 'Clay', value: '#a6532f' },
  { label: 'Sage', value: '#5b6b4f' },
  { label: 'Slate', value: '#3b4a5a' },
];

const HIGHLIGHTS: { label: string; value: string }[] = [
  { label: 'Brass', value: '#f3e6c4' },
  { label: 'Sage', value: '#dfe7d5' },
  { label: 'Sky', value: '#d7e6f0' },
  { label: 'Blush', value: '#f4dcd4' },
];

const ToolButton: React.FC<{
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, active, disabled, onClick }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`rounded-md p-1.5 transition-colors disabled:opacity-30 ${
      active
        ? 'bg-brass/20 text-brass'
        : 'text-bone/50 hover:bg-bone/10 hover:text-bone'
    }`}
  >
    <Icon className="h-4 w-4" />
  </button>
);

const Divider = () => <span className="mx-1 h-4 w-px bg-bone/10" />;

/** A small swatch flyout for text color / highlight. */
const SwatchMenu: React.FC<{
  icon: LucideIcon;
  label: string;
  swatches: { label: string; value: string }[];
  active?: boolean;
  onPick: (value: string) => void;
  onClear: () => void;
}> = ({ icon: Icon, label, swatches, active, onPick, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ToolButton icon={Icon} label={label} active={active} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-1 rounded-lg border border-bone/15 bg-ink p-1.5 shadow-lg">
          {swatches.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-label={s.label}
              title={s.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(s.value);
                setOpen(false);
              }}
              className="h-5 w-5 rounded-full border border-bone/25"
              style={{ background: s.value }}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-bone/50 hover:text-bone"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * A dropdown of merge tokens. Picking one inserts the `{{token}}` marker at the
 * cursor. Rendered only when the editor is given a non-empty `tokens` list, so
 * non-email kit editors never see it.
 */
const TokenMenu: React.FC<{
  tokens: RichTextToken[];
  onPick: (token: string) => void;
}> = ({ tokens, onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Insert token"
        title="Insert merge token"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
          open
            ? 'bg-brass/20 text-brass'
            : 'text-bone/50 hover:bg-bone/10 hover:text-bone'
        }`}
      >
        <Braces className="h-4 w-4" />
        <span className="hidden sm:inline">Tokens</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-bone/15 bg-ink p-1 shadow-lg">
          {tokens.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-bone/40">No tokens available.</p>
          ) : (
            tokens.map((t) => (
              <button
                key={t.token}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(t.token);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-bone/10"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-xs font-medium text-bone">{t.label}</span>
                  <code className="rounded bg-bone/10 px-1 py-0.5 text-[10px] text-brass">
                    {t.token}
                  </code>
                </span>
                {t.description && (
                  <span className="mt-0.5 text-[10px] leading-snug text-bone/40">
                    {t.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<{ editor: Editor; tokens?: RichTextToken[] }> = ({
  editor,
  tokens,
}) => {

  const addLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return; // cancelled
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const addImage = () => {
    const src = window.prompt('Image URL');
    if (!src || !src.trim()) return;
    const alt = window.prompt('Alt text (for accessibility)') ?? '';
    editor.chain().focus().setImage({ src: src.trim(), alt: alt.trim() }).run();
  };

  const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? undefined;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-bone/10 px-1.5 py-1">
      <ToolButton
        icon={Heading2}
        label="Heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        icon={Heading3}
        label="Subheading"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <Divider />
      <ToolButton
        icon={Bold}
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <SwatchMenu
        icon={Palette}
        label="Text color"
        swatches={TEXT_COLORS}
        active={!!currentColor}
        onPick={(v) => editor.chain().focus().setColor(v).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <SwatchMenu
        icon={Highlighter}
        label="Highlight"
        swatches={HIGHLIGHTS}
        active={editor.isActive('highlight')}
        onPick={(v) => editor.chain().focus().setHighlight({ color: v }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
      />
      <Divider />
      <ToolButton
        icon={List}
        label="Bulleted list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        icon={Quote}
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        icon={Minus}
        label="Divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <Divider />
      <ToolButton
        icon={AlignLeft}
        label="Align left"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      />
      <ToolButton
        icon={AlignCenter}
        label="Align center"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      />
      <ToolButton
        icon={AlignRight}
        label="Align right"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      />
      <Divider />
      <ToolButton
        icon={Link2}
        label="Add link"
        active={editor.isActive('link')}
        onClick={addLink}
      />
      <ToolButton
        icon={Link2Off}
        label="Remove link"
        disabled={!editor.isActive('link')}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />
      <ToolButton icon={ImageIcon} label="Insert image" onClick={addImage} />
      {tokens && tokens.length > 0 && (
        <>
          <Divider />
          <TokenMenu
            tokens={tokens}
            onPick={(t) => editor.chain().focus().insertContent(t).run()}
          />
        </>
      )}
      <Divider />
      <ToolButton
        icon={Undo2}
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />

      <ToolButton
        icon={Redo2}
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
};

/** Wrap bare text (legacy plain-text kit values) in paragraphs for the editor. */
function toInitialHtml(value: string): string {
  if (!value) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value; // already HTML
  return value
    .split(/\n{2,}/)
    .map(
      (b) =>
        `<p>${b
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

export const KitRichTextField: React.FC<{
  /** Stored HTML (or legacy plain text). */
  value: string;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  /**
   * Optional merge tokens. When provided (non-empty), a "Tokens" dropdown is
   * shown in the toolbar that inserts `{{token}}` markers at the cursor.
   */
  tokens?: RichTextToken[];
  /** Receives serialized HTML on every edit. */
  onChange: (html: string) => void;
}> = ({ value, placeholder, minHeight = '6rem', disabled, tokens, onChange }) => {

  // Keep the latest onChange in a ref so the editor's stable onUpdate closure
  // always calls the current handler without recreating the editor.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      // StarterKit (v3) bundles Link + Underline; configure them here instead
      // of registering duplicates. Headings are limited to H2/H3 for structure.
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: toInitialHtml(value),
    editorProps: {
      attributes: {
        class: 'kit-rte-content w-full px-3 py-2 text-sm text-bone focus:outline-none',
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getText().trim() === '' && !editor.getHTML().includes('<img')
        ? ''
        : editor.getHTML();
      onChangeRef.current(html);
    },
  });

  // Keep the editor editable state in sync with the disabled prop.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  // Controlled sync: whenever the incoming `value` differs from what the editor
  // currently shows, push it in. Comparing against the editor's OWN serialized
  // HTML (rather than a "last emitted" ref) is what makes AI rewrites and kit
  // loads reliably paint: a user's own keystrokes produce a `value` that equals
  // `editor.getHTML()`, so this is a no-op mid-typing (cursor never jumps),
  // while an external replacement always differs and is applied.
  useEffect(() => {
    if (!editor) return;
    const incoming = toInitialHtml(value);
    const currentRaw = editor.getHTML();
    const current = currentRaw === '<p></p>' ? '' : currentRaw;
    const normalizedIncoming = incoming === '<p></p>' ? '' : incoming;
    if (normalizedIncoming === current) return;
    editor.commands.setContent(normalizedIncoming);
  }, [value, editor]);

  if (!editor) return null;
  return (
    <div className="kit-rte mt-1 overflow-hidden rounded-lg border border-bone/15 bg-ink/40 focus-within:border-brass/60">
      <Toolbar editor={editor} tokens={tokens} />
      <EditorContent editor={editor} />

      <style jsx global>{`
        .kit-rte .kit-rte-content p {
          margin: 0.35rem 0;
        }
        .kit-rte .kit-rte-content h2 {
          margin: 0.6rem 0 0.3rem;
          font-size: 1.1rem;
          font-weight: 700;
          line-height: 1.3;
        }
        .kit-rte .kit-rte-content h3 {
          margin: 0.5rem 0 0.25rem;
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.3;
        }
        .kit-rte .kit-rte-content ul {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.35rem 0;
        }
        .kit-rte .kit-rte-content ol {
          list-style: decimal;
          padding-left: 1.25rem;
          margin: 0.35rem 0;
        }
        .kit-rte .kit-rte-content blockquote {
          border-left: 3px solid var(--brass, #c9a24b);
          padding-left: 0.75rem;
          margin: 0.5rem 0;
          color: rgba(245, 240, 230, 0.75);
          font-style: italic;
        }
        .kit-rte .kit-rte-content hr {
          border: none;
          border-top: 1px solid rgba(245, 240, 230, 0.2);
          margin: 0.75rem 0;
        }
        .kit-rte .kit-rte-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.5rem 0;
        }
        .kit-rte .kit-rte-content img.ProseMirror-selectednode {
          outline: 2px solid var(--brass, #c9a24b);
        }
        .kit-rte .kit-rte-content a {
          color: var(--brass, #c9a24b);
          text-decoration: underline;
        }
        .kit-rte .kit-rte-content mark {
          border-radius: 0.15rem;
          padding: 0 0.1rem;
          color: #211d17;
        }
        .kit-rte .kit-rte-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          color: rgba(245, 240, 230, 0.3);
        }
      `}</style>
    </div>
  );
};
