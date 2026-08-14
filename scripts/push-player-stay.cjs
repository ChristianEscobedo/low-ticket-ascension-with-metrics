#!/usr/bin/env node
const { execSync } = require('child_process');
const root = require('path').join(__dirname, '..');
function run(cmd) {
  console.log('>', cmd);
  const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(out);
}
run('git add -- "src/app/(fullscreen)/admin/reel-studio/page.tsx"');
run('git commit -m "fix(reel): keep player mounted and insert clip immediately on upload"');
run('git push origin main');
run('git log -1 --oneline');
