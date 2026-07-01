'use client';

/**
 * A small rich-text field built on Tiptap, used in place of the plain textareas
 * on the content sheet's Edit tab. It gives a comfortable writing surface with
 * bold, italic, bullets, and undo/redo, but serializes back to plain text with
 * blank lines between paragraphs so it stays compatible with the review store
 * (which splits the body on blank lines) and with what platforms actually post.
 */
import React, { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  Undo2,
  Redo2,
  type LucideIcon,
} from 'lucide-react';

/** Plain text out, paragraphs separated by a blank line. */
const SEPARATOR = '\n\n';

/** Turn stored plain text into paragraph HTML for the editor's initial state. */
function toHTML(text: string): string {
  const blocks = text.split(/\n{2,}/);
  return blocks
    .map((b) => {
      const safe = b
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      return `<p>${safe}</p>`;
    })
    .join('');
}

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
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`rounded-md p-1.5 transition-colors disabled:opacity-30 ${
      active ? 'bg-mode/15 text-mode' : 'text-ink/55 hover:bg-ink/5 hover:text-ink'
    }`}
  >
    <Icon className="h-4 w-4" />
  </button>
);

const Toolbar: React.FC<{ editor: Editor }> = ({ editor }) => (
  <div className="flex items-center gap-0.5 border-b border-ink/10 px-1.5 py-1">
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
      icon={List}
      label="Bulleted list"
      active={editor.isActive('bulletList')}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
    />
    <span className="mx-1 h-4 w-px bg-ink/10" />
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

export const RichTextField: React.FC<{
  value: string;
  placeholder?: string;
  minHeight?: string;
  onChange: (value: string) => void;
}> = ({ value, placeholder, minHeight = '6rem', onChange }) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: toHTML(value),
    editorProps: {
      attributes: {
        class:
          'tiptap prose-none w-full px-2.5 py-2 text-sm text-ink focus:outline-none',
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getText({ blockSeparator: SEPARATOR })),
  });

  // Re-sync when the value changes from outside (e.g. switching pieces). Skips
  // our own updates, which already match the editor text, so the cursor holds.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getText({ blockSeparator: SEPARATOR });
    if (value !== current)
      editor.commands.setContent(toHTML(value), { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;
  return (
    <div className="mt-1.5 overflow-hidden rounded-lg border border-ink/15 bg-white/70 focus-within:border-mode">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};
