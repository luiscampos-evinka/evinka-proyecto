import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { extractReceiptDataFromBuffer, shutdownReceiptOcrWorker } from '../src/receiptOcr.mjs';

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '72 760 Td',
    ...lines.flatMap((line, index) => index === 0
      ? [`(${escapePdfText(line)}) Tj`]
      : ['0 -22 Td', `(${escapePdfText(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function buildReceiptImageBuffer() {
  const canvas = createCanvas(1600, 1000);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.font = '36px Arial';
  const lines = [
    'Titular: Andrea Lucia Paredes Nunez',
    'Direccion del suministro: Av. Guardia Civil 450',
    'Distrito: San Borja',
    'Provincia: Lima',
    'Potencia contratada: 9.9 kW',
  ];
  lines.forEach((line, index) => {
    ctx.fillText(line, 60, 100 + (index * 120));
  });
  return canvas.toBuffer('image/png');
}

async function main() {
  const imageBuffer = await buildReceiptImageBuffer();
  const imageResult = await extractReceiptDataFromBuffer({
    buffer: imageBuffer,
    mimeType: 'image/png',
    fileName: 'recibo.png',
  });

  assert.equal(imageResult.ok, true);
  assert.equal(imageResult.fields.distrito, 'San Borja');
  assert.equal(imageResult.fields.provincia, 'Lima');
  assert.equal(imageResult.fields.potencia, 9.9);

  const pdfBuffer = buildSimplePdf([
    'Titular: Andrea Lucia Paredes Nunez',
    'Direccion del suministro: Av. Guardia Civil 450',
    'Distrito: San Borja',
    'Provincia: Lima',
    'Potencia contratada: 9.9 kW',
  ]);

  const pdfResult = await extractReceiptDataFromBuffer({
    buffer: pdfBuffer,
    mimeType: 'application/pdf',
    fileName: 'recibo.pdf',
  });

  assert.equal(pdfResult.ok, true);
  assert.equal(pdfResult.fields.direccion, 'Av. Guardia Civil 450');
  assert.equal(pdfResult.fields.distrito, 'San Borja');
  assert.equal(pdfResult.fields.potencia, 9.9);

  console.log(JSON.stringify({
    image: imageResult.fields,
    pdf: pdfResult.fields,
  }, null, 2));
}

main()
  .finally(async () => {
    await shutdownReceiptOcrWorker();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
