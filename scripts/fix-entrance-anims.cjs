#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const p = path.join(root, 'src/lib/mothermode/reel/render/captionLayer.tsx');
let s = fs.readFileSync(p, 'utf8');

const es = s.indexOf('function entranceStyle');
console.log(s.slice(es, es + 2200));
console.log('--- around slam ---');
const slam = s.indexOf("case 'slam'");
console.log(s.slice(slam - 200, slam + 900));
