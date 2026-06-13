import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import { VSLScriptViewer } from '@/components/sales-page/VSLScriptViewer';

export const metadata: Metadata = {
  title: 'Millionaire Mindshift - VSL Script & Prompts',
};

// The script lives in the repo-root markdown file so the page stays a single
// source of truth with the production doc (no duplicated copy to drift).
const SCRIPT_FILE = 'MILLIONAIRE_MINDSHIFT_VSL.md';

export default function MillionaireMindshiftVSLScriptRoute() {
  let content: string;
  try {
    content = fs.readFileSync(path.join(process.cwd(), SCRIPT_FILE), 'utf8');
  } catch {
    content = `# VSL script not found\n\nExpected \`${SCRIPT_FILE}\` at the project root.`;
  }
  return <VSLScriptViewer content={content} />;
}
