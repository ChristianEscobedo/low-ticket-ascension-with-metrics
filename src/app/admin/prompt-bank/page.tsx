import type { Metadata } from 'next';
import { PromptBankEditor } from './PromptBankEditor';

export const metadata: Metadata = {
  title: 'Prompt Bank | MotherMode Admin',
};

/**
 * The programmable prompt bank: every framework and style the content
 * generators can execute, editable live. Code registry is the seed and
 * fallback; rows in mothermode_prompt_recipes override, toggle, and extend.
 */
export default function PromptBankPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-bone">
          Prompt Bank
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-bone/60">
          A-level, platform-specific frameworks and styles that drive every
          generator (batch, variations, amplify, rewrites). Edit any recipe and
          the next run uses it. Reset restores the code default. Nothing here
          can break the brand voice: those rules stay server-side.
        </p>
      </div>
      <PromptBankEditor />
    </div>
  );
}
