import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-reviewed.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-reviewed-final.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-reviewed-final.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-bogota-universidades-final-actions.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));
const removed = new Set();
const actions = [];

function norm(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }
function merge(target, source, reason){
  if(!target||!source||target.id===source.id||removed.has(source.id)) return;
  target.rawCount=(target.rawCount||1)+(source.rawCount||1);
  target.aliases=uniq([...(target.aliases||[]), source.canonicalName||source.name, ...(source.aliases||[])]);
  target.aliasCount=target.aliases.length;
  target.rawIds=uniq([...(target.rawIds||[]), ...(source.rawIds||[]), source.id]);
  target.reviewReasons=uniq([...(target.reviewReasons||[]), ...(source.reviewReasons||[]), reason]);
  target.reviewStatus='review_light';
  target.commercialReady=false;
  removed.add(source.id);
  actions.push({type:'merge', source: source.canonicalName, target: target.canonicalName, reason});
}
function suppress(row, reason){ if(!row||removed.has(row.id)) return; removed.add(row.id); actions.push({type:'suppress', name:row.canonicalName, reason}); }

const universities = rows.filter(r=>r.category==='Universidad');
const find = (pred) => universities.find(r=>!removed.has(r.id) && pred(r));
const findAll = (pred) => universities.filter(r=>!removed.has(r.id) && pred(r));

// Tadeo duplicate critical into light
const tadeos = findAll(r=>norm(r.canonicalName)==='universidad de bogota jorge tadeo lozano');
const tadeoBest = tadeos.sort((a,b)=>(b.rawCount||1)-(a.rawCount||1)).find(r=>r.reviewStatus==='review_light') || tadeos[0];
for(const r of tadeos){ if(r.id!==tadeoBest.id) merge(tadeoBest, r, 'dedupe_same_institution'); }

// Cooperativa duplicates into best addressed row, but preserve explicit campus/sede rows as separate sites
const coops = findAll(r=>norm(r.canonicalName).includes('universidad cooperativa'));
const coopBest = coops.sort((a,b)=>{
  const sa = (/carrera 14a/i.test(a.address||'')?20:0) + (a.rawCount||1);
  const sb = (/carrera 14a/i.test(b.address||'')?20:0) + (b.rawCount||1);
  return sb-sa;
})[0];
for(const r of coops){
  if(r.id===coopBest.id) continue;
  if(/sede /i.test(r.canonicalName||'')) {
    r.reviewStatus='review_light';
    r.commercialReady=false;
    continue;
  }
  merge(coopBest, r, 'dedupe_same_institution');
}
coopBest.canonicalName='Universidad Cooperativa de Colombia'; coopBest.name=coopBest.canonicalName;

// Merge Nueva Granada faculty into parent institution
const nuevaGranadaParent = find(r=>norm(r.canonicalName).includes('universidad militar nueva granada'));
const nuevaGranadaFaculty = find(r=>norm(r.canonicalName).includes('facultad medicina universidad nueva granada'));
if (nuevaGranadaParent && nuevaGranadaFaculty) merge(nuevaGranadaParent, nuevaGranadaFaculty, 'merged_into_parent_institution');

// Merge UAN faculty into Universidad Antonio Nariño parent
const uanParent = find(r=>norm(r.canonicalName)==='universidad antonio narino' || norm(r.canonicalName)==='universidad antonio narino centro de convecciones');
const uanFaculty = find(r=>norm(r.canonicalName).includes('uan facultad de ingenieria mecanica'));
if (uanParent && uanFaculty) merge(uanParent, uanFaculty, 'merged_into_parent_institution');

// Suppress conflicting La Gran Colombia entry because clean alternatives exist and alias conflict persists
const granCritical = find(r=>norm(r.canonicalName)==='universidad la gran colombia' && r.reviewStatus==='review_critical');
if (granCritical) suppress(granCritical, 'alias_conflict_with_existing_clean_rows');

const finalRows = rows.filter(r=>!removed.has(r.id));
const counts = finalRows.reduce((acc, row)=>{
  acc[row.reviewStatus]=(acc[row.reviewStatus]||0)+1;
  if(!acc.byCategory[row.category]) acc.byCategory[row.category]={};
  acc.byCategory[row.category][row.reviewStatus]=(acc.byCategory[row.category][row.reviewStatus]||0)+1;
  return acc;
},{byCategory:{}});

await writeFile(OUTPUT, JSON.stringify(finalRows, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: finalRows.length, counts, actionsCount: actions.length }, null, 2));
await writeFile(AUDIT, JSON.stringify(actions, null, 2));
console.log(JSON.stringify({ total: finalRows.length, actions, counts }, null, 2));
