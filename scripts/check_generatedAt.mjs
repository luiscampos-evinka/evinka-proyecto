import fs from 'fs';
const p = '/root/.openclaw/workspace/apps/overview-app/public/data/overview-data.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log(j.generatedAt || '');
