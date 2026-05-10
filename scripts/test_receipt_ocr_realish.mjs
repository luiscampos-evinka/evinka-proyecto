import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { extractReceiptDataFromBuffer, shutdownReceiptOcrWorker } from '../src/receiptOcr.mjs';
import { createCanvas } from '@napi-rs/canvas';

async function imageFromLines(lines) {
  const canvas = createCanvas(1600, 1200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 34px Arial';
  lines.forEach((line, i) => ctx.fillText(line, 60, 90 + i * 60));
  return canvas.toBuffer('image/jpeg');
}

const pluzLines = [
  'PLUZ Energia Peru S.A.A.',
  'EUROAMERICA CONTRATISTAS GENERALES S A',
  'JIRON HUARAZ 2096 DPTO 102 - PUEBLO LIBRE - LIMA',
  'DATOS DEL SUMINISTRO',
  'Potencia Contratada 9.90 kW',
];

const luzSurLines = [
  'LUZ DEL SUR S.A.A.',
  'AGUIRRE AMORIN MARLENI ELIZABETH',
  'B MZ A LT 36 URB LAS TERRAZAS DE CARAPONGUILLO PRIMERA ETAPA',
  'ATE-VITARTE - LIMA',
  'DATOS DEL SUMINISTRO',
  'Potencia Contratada 6.00 kW',
];

async function runCase(name, lines, expected) {
  const buffer = await imageFromLines(lines);
  const result = await extractReceiptDataFromBuffer({ buffer, mimeType: 'image/jpeg', fileName: `${name}.jpg` });
  console.log(name, result.fields);
  assert.equal(result.ok, true);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(result.fields[key], value, `${name} ${key}`);
  }
}

await runCase('pluz', pluzLines, {
  titular: 'Euroamerica Contratistas Generales S A',
  direccion: 'JIRON HUARAZ 2096 DPTO 102 - PUEBLO LIBRE - LIMA',
  distrito: 'Pueblo Libre',
  provincia: 'Lima',
  potencia: 9.9,
});

await runCase('luzdelsur', luzSurLines, {
  titular: 'Aguirre Amorin Marleni Elizabeth',
  distrito: 'Ate-Vitarte',
  provincia: 'Lima',
  potencia: 6,
});

await shutdownReceiptOcrWorker();
console.log('ok');
