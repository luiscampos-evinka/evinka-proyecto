import fs from 'fs';
const src = '/root/.openclaw/workspace/apps/overview-app/public/data/overview-data.json';
const dst = '/var/www/status.evinka.net/data/overview-data.json';
fs.copyFileSync(src, dst);
const data = JSON.parse(fs.readFileSync(dst, 'utf8'));
if (!data.generatedAt) throw new Error('missing generatedAt');
console.log(data.generatedAt);
