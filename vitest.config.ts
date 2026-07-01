import { defineConfig } from 'vitest/config';
// Types resolve only under bundler/node16 resolution; the app tsconfig uses
// node10, so suppress the type-only lookup here. The runtime import is fine.
// @ts-ignore
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // The catalog tsconfig sets `jsx: preserve` for Next; the React plugin handles
  // the JSX transform (automatic runtime) under rolldown-vite's oxc pipeline so
  // component suites render without importing React.
  plugins: [react()],
  test: {
    // Logic suites run in node; component suites opt into jsdom per file with a
    // `// @vitest-environment jsdom` docblock at the top.
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
