import { readFile, writeFile } from 'node:fs/promises';

const INPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-curated.json';
const OUTPUT = '/root/.openclaw/workspace/apps/mapco-web/public/data/places-reviewed.json';
const SUMMARY = '/root/.openclaw/workspace/apps/mapco-web/public/data/summary-bogota-reviewed.json';
const AUDIT = '/root/.openclaw/workspace/deliverables/mapco-bogota-universidades-refinadas.json';

const rows = JSON.parse(await readFile(INPUT, 'utf8'));
const actions = [];

const severity = { approved_auto: 0, review_light: 1, review_critical: 2 };
const universityRows = rows.filter((r) => r.category === 'Universidad');
const otherRows = rows.filter((r) => r.category !== 'Universidad');
const removed = new Set();

function norm(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

function chooseBetterName(a, b) {
  if (!a) return b;
  if (!b) return a;
  const score = (s) => {
    const n = norm(s);
    let v = s.length;
    if (/universidad|academia|fundacion|fundación|politecnico|politécnico|escuela/i.test(s)) v += 20;
    if (/facultad|modulo|m[oó]dulo|biblioteca|admisiones|consultorio|decanatura|laboratorio|tadeolab/i.test(s)) v -= 25;
    if (/sede|campus/i.test(s)) v += 5;
    if (!/[a-z]/i.test(s)) v -= 20;
    if (n === 'u catolica de colombia') v -= 3;
    return v;
  };
  return score(b) > score(a) ? b : a;
}

function findByRegex(regex) {
  return universityRows.find((r) => !removed.has(r.id) && regex.test(r.canonicalName || r.name || ''));
}

function mergeInto(target, source, reason) {
  if (!target || !source || target.id === source.id || removed.has(source.id)) return false;
  target.rawCount = (target.rawCount || 1) + (source.rawCount || 1);
  target.aliases = uniq([...(target.aliases || [target.canonicalName || target.name]), source.canonicalName || source.name, ...(source.aliases || [])]);
  target.aliasCount = target.aliases.length;
  target.rawIds = uniq([...(target.rawIds || []), source.id, ...(source.rawIds || [])]);
  target.hasSubunits = !!(target.hasSubunits || source.hasSubunits || /facultad|modulo|m[oó]dulo|biblioteca|admisiones|consultorio|decanatura|laboratorio|tadeolab|palacio/i.test(source.canonicalName || ''));
  target.reviewReasons = uniq([...(target.reviewReasons || []), ...(source.reviewReasons || []), reason]);
  target.canonicalName = chooseBetterName(target.canonicalName || target.name, source.canonicalName || source.name);
  target.name = target.canonicalName;
  target.reviewStatus = severity[target.reviewStatus] <= severity.review_light ? target.reviewStatus : 'review_light';
  target.commercialReady = target.reviewStatus === 'approved_auto';
  removed.add(source.id);
  actions.push({ type: 'merge', source: source.canonicalName, target: target.canonicalName, reason });
  return true;
}

function relabel(row, canonicalName, reviewStatus = 'review_light', reason = 'relabel') {
  if (!row || removed.has(row.id)) return;
  const prev = row.canonicalName;
  row.canonicalName = canonicalName;
  row.name = canonicalName;
  row.aliases = uniq([canonicalName, ...(row.aliases || []), prev]);
  row.aliasCount = row.aliases.length;
  row.reviewStatus = reviewStatus;
  row.commercialReady = reviewStatus === 'approved_auto';
  row.reviewReasons = uniq([...(row.reviewReasons || []), reason]);
  actions.push({ type: 'relabel', from: prev, to: canonicalName, reason });
}

function suppress(row, reason) {
  if (!row || removed.has(row.id)) return;
  removed.add(row.id);
  actions.push({ type: 'suppress', name: row.canonicalName, reason });
}

// Parents
const tadeo = findByRegex(/Universidad de Bogot[aá] Jorge Tadeo Lozano/i);
const santoTomas = findByRegex(/^Universidad Santo Tom[aá]s$/i);
const catolica = findByRegex(/Universidad Cat[oó]lica de Colombia|U\. Catolica de Colombia/i);
const cooperativa = findByRegex(/Universidad Cooperativa de Colombia|Universidad cooperativa de Colombia|Universidad Cooperativa$/i);
const uniciencia = findByRegex(/^UNICIENCIA$/i);
const distritalMacarenaA = findByRegex(/Sede Macarena A/i);
const distritalMacarenaB = findByRegex(/Sede Macarena B/i);
const distritalVivero1 = findByRegex(/Sede Vivero/i);
const distritalVivero2 = universityRows.find((r) => !removed.has(r.id) && /Sede Vivero/i.test(r.canonicalName || '') && r.id !== distritalVivero1?.id);
const laSalle = findByRegex(/^Universidad de La Salle$/i);
const externado = findByRegex(/^Universidad Externado de Colombia$/i);
const nacional = findByRegex(/^Universidad Nacional de Colombia$/i);
const pedagogica = findByRegex(/^Universidad Pedag[oó]gica Nacional$/i);
const asab = findByRegex(/Academia Superior de Artes de Bogota - ASAB/i);
const unicienciaA = findByRegex(/UNICIENCIA Sede Administrativa/i);
const unicienciaArtes = findByRegex(/UNICIENCIA Sede Artes/i);

// Clean ASAB
if (asab) relabel(asab, 'Academia Superior de Artes de Bogotá - ASAB', 'review_light', 'validated_campus');
const palacio = findByRegex(/Palacio de la Merced/i);
if (asab && palacio) mergeInto(asab, palacio, 'merged_into_asab_main');

// Jorge Tadeo absorbs internal subunits
for (const pattern of [/Casa de los Deportes, Universidad de Bogota Jorge Tadeo Lozano/i,/Facultad de Arte Y Dise/i,/M[oó]dulo 16/i,/M[oó]dulo 17/i,/^M[oó]dulo 8$/i,/Modulo 9, Centro de Arte y Cultura/i,/TadeoLab/i,/Laboratorios de Ingenier/i]) {
  const row = findByRegex(pattern);
  if (tadeo && row) mergeInto(tadeo, row, 'merged_tadeo_subunit');
}
if (tadeo) {
  relabel(tadeo, 'Universidad de Bogotá Jorge Tadeo Lozano', 'review_light', 'validated_main_campus');
}

// Santo Tomás
for (const pattern of [/Admisiones Universidad Santo Tomas/i,/Consultorio jur[ií]dico Universidad Santo Tom[aá]s/i,/Universidad Santo Tom[aá]s sede principal/i]) {
  const row = findByRegex(pattern);
  if (santoTomas && row) mergeInto(santoTomas, row, 'merged_santo_tomas_subunit');
}
const aquinate = findByRegex(/Campus El Aquinate/i);
if (aquinate) relabel(aquinate, 'Universidad Santo Tomás - Campus El Aquinate', 'review_light', 'validated_campus');
const deportivo = findByRegex(/Campus deportivo Universidad Santo Tom[aá]s/i);
if (deportivo) relabel(deportivo, 'Universidad Santo Tomás - Campus Deportivo', 'review_light', 'validated_campus');
if (santoTomas) relabel(santoTomas, 'Universidad Santo Tomás', 'review_light', 'validated_main_campus');

// Universidad Católica
for (const pattern of [/Universidad Catolica - Sede Administrativa/i,/Universidad Catolica Facultad de Psicologia/i,/Liceo Universidad Cat[oó]lica de Colombia/i]) {
  const row = findByRegex(pattern);
  if (catolica && row) mergeInto(catolica, row, 'merged_catolica_subunit');
}
if (catolica) relabel(catolica, 'Universidad Católica de Colombia', 'review_light', 'validated_main_campus');

// Universidad Cooperativa
for (const pattern of [/^Universidad Cooperativa$/i,/Decanatura U\.Cooperativa/i]) {
  const row = findByRegex(pattern);
  if (cooperativa && row && row.id !== cooperativa.id) mergeInto(cooperativa, row, 'merged_cooperativa_subunit');
}
const coopNorte = findByRegex(/sede Norte/i);
if (coopNorte) relabel(coopNorte, 'Universidad Cooperativa de Colombia - Sede Norte', 'review_light', 'validated_campus');
if (cooperativa) relabel(cooperativa, 'Universidad Cooperativa de Colombia', 'review_light', 'validated_main_campus');

// UNICIENCIA
for (const pattern of [/Facultad de Ingenieria Sede I/i,/Facultad de Ciencias Econ[oó]micas/i,/UNICIENCIA Sede Administrativa - A/i,/UNICIENCIA Sede Artes/i]) {
  const row = findByRegex(pattern);
  if (uniciencia && row && row.id !== uniciencia.id) mergeInto(uniciencia, row, 'merged_uniciencia_subunit');
}
if (uniciencia) relabel(uniciencia, 'UNICIENCIA', 'review_light', 'validated_multi_sede_cluster');

// Universidad Distrital campuses
if (distritalMacarenaA && distritalMacarenaB) mergeInto(distritalMacarenaA, distritalMacarenaB, 'merged_same_campus_macarena');
const distritalBiblioteca = findByRegex(/Biblioteca Universidad Distrital/i);
if (distritalMacarenaA && distritalBiblioteca) mergeInto(distritalMacarenaA, distritalBiblioteca, 'merged_same_campus_macarena');
if (distritalMacarenaA) relabel(distritalMacarenaA, 'Universidad Distrital Francisco José de Caldas - Sede Macarena', 'review_light', 'validated_campus');
if (distritalVivero1 && distritalVivero2) mergeInto(distritalVivero1, distritalVivero2, 'merged_same_campus_vivero');
if (distritalVivero1) relabel(distritalVivero1, 'Universidad Distrital Francisco José de Caldas - Sede Vivero', 'review_light', 'validated_campus');
for (const pattern of [/Facultad del Medio Ambiente/i,/Sede El Porvenir/i,/Sede Tecnol[oó]gica/i]) {
  const row = findByRegex(pattern);
  if (row) {
    const label = /Medio Ambiente/i.test(row.canonicalName) ? 'Universidad Distrital Francisco José de Caldas - Facultad del Medio Ambiente' :
      /Porvenir/i.test(row.canonicalName) ? 'Universidad Distrital Francisco José de Caldas - Sede El Porvenir' : 'Universidad Distrital Francisco José de Caldas - Sede Tecnológica';
    relabel(row, label, 'review_light', 'validated_campus');
  }
}

// Externado / Nacional / La Salle / Pedagógica
const externadoAlcazar = findByRegex(/Externado de Colombia sede El Alc[aá]zar/i);
if (externadoAlcazar) relabel(externadoAlcazar, 'Universidad Externado de Colombia - Sede El Alcázar', 'review_light', 'validated_campus');
const colegioExternado = findByRegex(/Colegio Externado Nacional Camilo Torres/i);
if (colegioExternado) suppress(colegioExternado, 'non_university_school');
const odontologia = findByRegex(/Facultad de Odontolog/i);
if (nacional && odontologia) mergeInto(nacional, odontologia, 'merged_nacional_subunit');
const santaRosa = findByRegex(/Campus Santa Rosa/i);
if (santaRosa) relabel(santaRosa, 'Universidad Nacional de Colombia - Campus Santa Rosa', 'review_light', 'validated_campus');
const salleNorte = findByRegex(/La Salle - Sede Norte/i);
if (salleNorte) relabel(salleNorte, 'Universidad de La Salle - Sede Norte', 'review_light', 'validated_campus');
const salleCentro = findByRegex(/la Salle-Sede Centro/i);
if (salleCentro) relabel(salleCentro, 'Universidad de La Salle - Sede Centro', 'review_light', 'validated_campus');
const valmaria = findByRegex(/Campus Valmaria/i);
if (valmaria) relabel(valmaria, 'Universidad Pedagógica Nacional - Campus Valmaria', 'review_light', 'validated_campus');

// Other obvious campus/subunit relabels
for (const [pattern, label] of [
  [/UniSin[uú] Sede Bogot[aá]/i, 'Universidad del Sinú - Sede Bogotá'],
  [/Uniminuto sede virtual y a distancia/i, 'UNIMINUTO - Sede Virtual y a Distancia'],
  [/Universidad de la Salle-Sede Centro/i, 'Universidad de La Salle - Sede Centro'],
]) {
  const row = findByRegex(pattern);
  if (row) relabel(row, label, 'review_light', 'validated_campus');
}

// Suppress obvious garbage/non-commercial university artifacts
for (const pattern of [/^passport$/i,/^Ñl$/i,/^Mj$/i,/^M[oó]dulo 8$/i,/Modulo 9, Centro de Arte y Cultura/i]) {
  const row = findByRegex(pattern);
  if (row) suppress(row, 'non_commercial_internal_artifact');
}

// downgrade remaining university criticals that are explicit campuses/sedes to review_light
for (const row of universityRows) {
  if (removed.has(row.id)) continue;
  if (row.reviewStatus !== 'review_critical') continue;
  if (/sede|campus/i.test(row.canonicalName || '')) {
    row.reviewStatus = 'review_light';
    row.commercialReady = false;
    row.reviewReasons = uniq([...(row.reviewReasons || []), 'validated_campus_label']);
    actions.push({ type: 'downgrade', name: row.canonicalName, to: 'review_light', reason: 'validated_campus_label' });
  }
}

const finalUniversities = universityRows.filter((r) => !removed.has(r.id));
const finalRows = [...otherRows, ...finalUniversities];

const counts = finalRows.reduce((acc, row) => {
  acc[row.reviewStatus] = (acc[row.reviewStatus] || 0) + 1;
  if (!acc.byCategory[row.category]) acc.byCategory[row.category] = {};
  acc.byCategory[row.category][row.reviewStatus] = (acc.byCategory[row.category][row.reviewStatus] || 0) + 1;
  return acc;
}, { byCategory: {} });

await writeFile(OUTPUT, JSON.stringify(finalRows, null, 2));
await writeFile(SUMMARY, JSON.stringify({ generatedAt: new Date().toISOString(), total: finalRows.length, counts, actionsCount: actions.length }, null, 2));
await writeFile(AUDIT, JSON.stringify(actions, null, 2));
console.log(JSON.stringify({ total: finalRows.length, universityCount: finalUniversities.length, actions: actions.length, counts }, null, 2));
