import { createWorker, PSM } from 'tesseract.js';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import heicConvert from 'heic-convert';
import crypto from 'node:crypto';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf']);

let workerPromise = null;
const multimodalCache = new Map();

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function openAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-5-nano',
  };
}

function multimodalEnabled() {
  return String(process.env.OPENAI_RECEIPT_ENABLED || '0').toLowerCase() === '1';
}

function normalizeText(s = '') {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMultilineText(s = '') {
  return (s ?? '')
    .toString()
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeKey(s = '') {
  return normalizeText(s).toLowerCase();
}

function cleanValue(s = '') {
  return (s ?? '').toString().replace(/\s+/g, ' ').trim();
}

function looksMostlyUppercase(s = '') {
  const letters = (s.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) || []);
  if (!letters.length) return false;
  const uppers = letters.filter(ch => ch === ch.toUpperCase()).length;
  return uppers / letters.length >= 0.75;
}

function titleCaseName(s = '') {
  return cleanValue(s)
    .toLowerCase()
    .split(/\s+/)
    .map(part => part
      ? part.split('-').map(token => token ? token[0].toUpperCase() + token.slice(1) : token).join('-')
      : part)
    .join(' ');
}

function isLikelyJunkTitle(value = '') {
  const v = normalizeKey(value);
  if (!v) return true;
  if (/^\d+$/.test(v)) return true;
  const badPhrases = [
    'detalle de importes',
    'detalle del consumo',
    'datos del suministro',
    'numero de suministro',
    'consumo historico',
    'resumen del consumo',
    'informacion del cliente',
    'recibo de electricidad',
    'pluz energia peru',
    'luz del sur',
  ];
  return badPhrases.some(x => v.includes(x));
}

function isLikelyJunkAddress(value = '') {
  const v = cleanValue(value);
  if (!v) return true;
  if (/^\d{5,}$/.test(v)) return true;
  if (/^(detalle|datos|suministro|cliente|medidor|importe)/i.test(v)) return true;
  const hasStreetHint = /(JR|JIRON|AV|AV\.|CALLE|MZ|LT|URB|DPTO|PISO|ETAPA|PSJ|PASAJE|BLVD|BOULEVARD)\b/i.test(v);
  const hasEnoughChars = v.length >= 10;
  return !(hasStreetHint && hasEnoughChars);
}

function cleanPower(value) {
  if (!value) return null;
  const match = String(value).replace(/,/g, '.').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function clampReceiptFields(fields = {}) {
  const out = {
    titular: cleanValue(fields.titular || '') || null,
    direccion: cleanValue(fields.direccion || '') || null,
    distrito: cleanValue(fields.distrito || '') || null,
    provincia: cleanValue(fields.provincia || '') || null,
    potencia: cleanPower(fields.potencia),
  };

  if (out.titular) out.titular = titleCaseName(out.titular);
  if (out.direccion) out.direccion = cleanValue(out.direccion);
  if (out.distrito) out.distrito = titleCaseName(out.distrito.replace(/\s*[-–]\s*/g, '-'));
  if (out.provincia) out.provincia = titleCaseName(out.provincia);

  if (isLikelyJunkTitle(out.titular)) out.titular = null;
  if (isLikelyJunkAddress(out.direccion)) out.direccion = null;

  return out;
}

function countPresentFields(fields = {}) {
  return Object.values(fields).filter(Boolean).length;
}

async function callOpenAiReceiptExtractor({ buffer, mimeType, fileName }) {
  if (!multimodalEnabled()) return null;
  const cfg = openAiConfig();
  if (!cfg) return null;

  const cacheKey = `${cfg.model}:${sha256(buffer)}`;
  if (multimodalCache.has(cacheKey)) return multimodalCache.get(cacheKey);

  const isPdf = mimeType === 'application/pdf' || String(fileName || '').toLowerCase().endsWith('.pdf');
  const base64 = buffer.toString('base64');
  const content = [
    {
      type: 'input_text',
      text: [
        'Extrae del recibo eléctrico solo estos campos en JSON estricto:',
        '- direccion',
        '- distrito',
        '- provincia',
        '- potencia',
        '',
        'Reglas:',
        '- Si no estás seguro, usa null.',
        '- No inventes valores.',
        '- potencia debe ser número en kW si aparece.',
        '- Ignora encabezados, slogans, importes, números de suministro y texto corporativo.',
        '- Para recibos peruanos, prioriza dirección real del suministro y ubicación administrativa.',
        '- Devuelve solo JSON válido, sin markdown ni texto extra.',
        '- Usa exactamente estas claves: titular, direccion, distrito, provincia, potencia, confidence, notes.',
        '- titular debe ir siempre en null salvo que sea muy claro y explícito; no es un dato prioritario para este flujo.',
      ].join('\n'),
    },
  ];

  if (isPdf) {
    content.push({
      type: 'input_file',
      filename: fileName || 'recibo.pdf',
      file_data: `data:application/pdf;base64,${base64}`,
    });
  } else {
    content.push({
      type: 'input_image',
      image_url: `data:${mimeType || 'image/jpeg'};base64,${base64}`,
      detail: 'high',
    });
  }

  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI responses -> ${res.status} ${res.statusText}\n${body}`);
  }

  const data = await res.json();
  const rawJson = data?.output_text || data?.output?.[0]?.content?.[0]?.text || '{}';
  const parsed = JSON.parse(rawJson);
  const fields = clampReceiptFields(parsed);
  const result = {
    ok: true,
    source: isPdf ? 'openai_pdf_vision' : 'openai_image_vision',
    rawText: rawJson,
    fields,
    presentFields: countPresentFields(fields),
    lines: [],
    confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : null,
    notes: cleanValue(parsed?.notes || '') || null,
  };
  multimodalCache.set(cacheKey, result);
  return result;
}

function detectExtension(fileName = '', mimeType = '') {
  const fromName = fileName.toLowerCase().split('.').pop();
  if (SUPPORTED_EXTENSIONS.has(fromName)) return fromName;
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('heif')) return 'heif';
  return null;
}

export async function detectMediaKind({ buffer, mimeType, fileName }) {
  const detected = await fileTypeFromBuffer(buffer).catch(() => null);
  const finalMime = detected?.mime || mimeType || '';
  const ext = detected?.ext || detectExtension(fileName, finalMime);
  const supported = SUPPORTED_MIME_TYPES.has(finalMime) || SUPPORTED_EXTENSIONS.has(ext);
  const kind = finalMime === 'application/pdf' || ext === 'pdf' ? 'pdf' : 'image';
  return {
    mimeType: finalMime,
    ext,
    supported,
    kind,
  };
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['spa', 'eng'], 1, {
      logger: () => {},
    }).then(async worker => {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: String(PSM.AUTO),
      });
      return worker;
    });
  }
  return workerPromise;
}

async function baseImageBuffer(buffer, mimeType) {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return Buffer.from(await heicConvert({ buffer, format: 'PNG' }));
  }
  return buffer;
}

async function buildImageVariants(buffer, mimeType) {
  const input = await baseImageBuffer(buffer, mimeType);
  const original = await sharp(input)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true, fit: 'inside' })
    .png()
    .toBuffer();
  const normalized = await sharp(input)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true, fit: 'inside' })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
  const thresholded = await sharp(input)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true, fit: 'inside' })
    .grayscale()
    .normalize()
    .threshold(180)
    .png()
    .toBuffer();
  return [original, normalized, thresholded];
}

async function ocrImageBuffer(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer, {}, { text: true });
  return normalizeMultilineText(data?.text || '');
}

function findLineValue(lines, patterns) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const normalized = normalizeKey(line);
    for (const pattern of patterns) {
      if (!normalized.includes(pattern)) continue;
      const parts = line.split(/:\s*/);
      if (parts.length >= 2) {
        const candidate = cleanValue(parts.slice(1).join(':'));
        if (candidate) return candidate;
      }
      const inline = line.replace(/^.*?(titular|direccion del suministro|direccion|distrito|provincia|potencia contratada|potencia)\s*/i, '').trim();
      if (inline && inline !== line) return cleanValue(inline);
      const next = cleanValue(lines[i + 1] || '');
      if (next) return next;
    }
  }
  return null;
}

function parseReceiptFields(rawText) {
  const normalizedText = normalizeMultilineText(rawText);
  const lines = normalizedText
    .split(/\n+/)
    .map(line => cleanValue(line))
    .filter(Boolean);

  const fields = {
    titular: findLineValue(lines, ['titular', 'cliente', 'nombre del titular']),
    direccion: findLineValue(lines, ['direccion del suministro', 'dirección del suministro', 'direccion', 'suministro']),
    distrito: findLineValue(lines, ['distrito']),
    provincia: findLineValue(lines, ['provincia']),
    potencia: cleanPower(findLineValue(lines, ['potencia contratada', 'potencia'])),
  };

  const upperCandidates = lines.filter(line => looksMostlyUppercase(line) && line.length >= 12);
  const topCandidates = lines.slice(0, 14);

  if (!fields.titular) {
    const m = normalizedText.match(/titular\s*:?\s*([^\n]+)/i);
    if (m) fields.titular = cleanValue(m[1]);
  }
  if (!fields.titular) {
    const companyHints = ['PLUZ', 'LUZ DEL SUR', 'RUC', 'PAG.', 'NUMERO DE SUMINISTRO', 'CONSUMO HISTORICO', 'DETALLE DEL CONSUMO'];
    const candidate = topCandidates.find(line => looksMostlyUppercase(line)
      && !companyHints.some(hint => normalizeKey(line).includes(normalizeKey(hint)))
      && !/\d{5,}/.test(line)
      && !/(JR|JIRON|AV|AV\.|CALLE|MZ|LT|URB)\b/i.test(line));
    if (candidate) fields.titular = titleCaseName(candidate);
  }
  if (!fields.direccion) {
    const m = normalizedText.match(/direccion(?: del suministro)?\s*:?\s*([^\n]+)/i);
    if (m) fields.direccion = cleanValue(m[1]);
  }
  if (!fields.direccion) {
    const addressIndex = lines.findIndex(line => /(JR|JIRON|AV|AV\.|CALLE|MZ|LT|URB|DPTO|PISO|ETAPA)\b/i.test(line) && /\d/.test(line));
    if (addressIndex >= 0) {
      const addressCandidate = lines[addressIndex];
      const nextLine = lines[addressIndex + 1] || '';
      fields.direccion = cleanValue(/^[A-ZÁÉÍÓÚÑ\- ]{5,}$/.test(nextLine) && /-/.test(nextLine)
        ? `${addressCandidate} - ${nextLine}`
        : addressCandidate);
    }
  }
  if (!fields.distrito) {
    const m = normalizedText.match(/distrito\s*:?\s*([^\n]+)/i);
    if (m) fields.distrito = cleanValue(m[1]);
  }
  if (!fields.provincia) {
    const m = normalizedText.match(/provincia\s*:?\s*([^\n]+)/i);
    if (m) fields.provincia = cleanValue(m[1]);
  }
  if (fields.direccion && (!fields.distrito || !fields.provincia)) {
    const parts = fields.direccion.split(/\s+-\s+/).map(cleanValue).filter(Boolean);
    if (!fields.provincia && parts.length >= 2) fields.provincia = parts.at(-1);
    if (!fields.distrito && parts.length >= 2) fields.distrito = parts.at(-2);
    if (!fields.distrito) {
      const districtMatch = fields.direccion.match(/\b(PUEBLO LIBRE|SAN BORJA|SAN MIGUEL|MIRAFLORES|SANTIAGO DE SURCO|SURCO|ATE-VITARTE|ATE|LA MOLINA|CHORRILLOS|JESUS MARIA|LINCE|SURQUILLO|BARRANCO|BREÑA|MAGDALENA(?: DEL MAR)?|SAN ISIDRO|SAN LUIS|VILLA EL SALVADOR|VILLA MARIA DEL TRIUNFO|LOS OLIVOS|COMAS|CALLAO|LIMA)\b/i);
      if (districtMatch) fields.distrito = districtMatch[1];
    }
    if (!fields.provincia && /\bLIMA\b/i.test(fields.direccion)) fields.provincia = 'Lima';
  }
  if (!fields.potencia) {
    const m = normalizedText.match(/potencia(?: contratada)?\s*:?\s*([0-9]+(?:[.,][0-9]+)?)/i);
    if (m) fields.potencia = cleanPower(m[1]);
  }

  if (fields.direccion) fields.direccion = cleanValue(fields.direccion);
  if (fields.distrito) fields.distrito = titleCaseName(fields.distrito.replace(/\s*[-–]\s*/g, '-'));
  if (fields.provincia) fields.provincia = titleCaseName(fields.provincia);
  if (fields.titular) fields.titular = titleCaseName(fields.titular);

  if (isLikelyJunkTitle(fields.titular)) fields.titular = null;
  if (isLikelyJunkAddress(fields.direccion)) fields.direccion = null;

  const presentFields = Object.values(fields).filter(Boolean).length;
  return {
    fields,
    presentFields,
    normalizedText,
    lines,
  };
}

async function extractFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const extractedText = normalizeMultilineText(textResult?.text || '');
    const parsedText = parseReceiptFields(extractedText);
    if (parsedText.presentFields >= 4) {
      return {
        rawText: extractedText,
        parsed: parsedText,
        source: 'pdf_text',
        pageCount: textResult?.pages?.length || textResult?.total || 1,
      };
    }

    const shots = await parser.getScreenshot({ first: 2, desiredWidth: 1800, imageDataUrl: false, imageBuffer: true });
    const pageBuffers = (shots?.pages || []).map(p => Buffer.from(p.data));
    const ocrTexts = [];
    for (const pageBuffer of pageBuffers) {
      const variants = await buildImageVariants(pageBuffer, 'image/png');
      const variantTexts = [];
      for (const variant of variants) variantTexts.push(await ocrImageBuffer(variant));
      ocrTexts.push(normalizeMultilineText(variantTexts.filter(Boolean).join('\n\n')));
    }
    const mergedText = normalizeMultilineText([extractedText, ...ocrTexts].filter(Boolean).join('\n\n'));
    return {
      rawText: mergedText,
      parsed: parseReceiptFields(mergedText),
      source: 'pdf_ocr',
      pageCount: pageBuffers.length || 1,
    };
  } finally {
    await parser.destroy();
  }
}

async function extractFromImage(buffer, mimeType) {
  const variants = await buildImageVariants(buffer, mimeType);
  const texts = [];
  let bestParsed = null;
  let bestText = '';
  for (const variant of variants) {
    const text = await ocrImageBuffer(variant);
    const parsed = parseReceiptFields(text);
    texts.push(text);
    if (!bestParsed || parsed.presentFields > bestParsed.presentFields) {
      bestParsed = parsed;
      bestText = text;
    }
  }
  const mergedText = normalizeMultilineText(texts.filter(Boolean).join('\n\n'));
  const mergedParsed = parseReceiptFields(mergedText);
  const finalParsed = mergedParsed.presentFields >= (bestParsed?.presentFields || 0) ? mergedParsed : bestParsed;
  const finalText = mergedParsed.presentFields >= (bestParsed?.presentFields || 0) ? mergedText : bestText;
  return {
    rawText: finalText,
    parsed: finalParsed,
    source: 'image_ocr',
    pageCount: 1,
  };
}

export async function extractReceiptDataFromBuffer({ buffer, mimeType, fileName }) {
  const media = await detectMediaKind({ buffer, mimeType, fileName });
  if (!media.supported) {
    return {
      ok: false,
      reason: 'unsupported_type',
      media,
    };
  }

  let multimodalResult = null;
  try {
    multimodalResult = await callOpenAiReceiptExtractor({
      buffer,
      mimeType: media.mimeType || mimeType,
      fileName,
    });
  } catch (error) {
    multimodalResult = {
      ok: false,
      source: 'openai_failed',
      error: error.message,
    };
  }

  if (multimodalResult?.ok && multimodalResult.presentFields >= 3) {
    return {
      ok: true,
      media,
      source: multimodalResult.source,
      rawText: multimodalResult.rawText,
      fields: multimodalResult.fields,
      presentFields: multimodalResult.presentFields,
      lines: multimodalResult.lines,
      pageCount: media.kind === 'pdf' ? 1 : 1,
      multimodal: {
        confidence: multimodalResult.confidence,
        notes: multimodalResult.notes,
      },
    };
  }

  const result = media.kind === 'pdf'
    ? await extractFromPdf(buffer)
    : await extractFromImage(buffer, media.mimeType || mimeType || 'image/png');

  return {
    ok: true,
    media,
    source: result.source,
    rawText: result.rawText,
    fields: result.parsed.fields,
    presentFields: result.parsed.presentFields,
    lines: result.parsed.lines,
    pageCount: result.pageCount,
    multimodal: multimodalResult?.ok || multimodalResult?.error ? {
      source: multimodalResult?.source || null,
      error: multimodalResult?.error || null,
      presentFields: multimodalResult?.presentFields || 0,
    } : null,
  };
}

export function receiptDataLooksUseful(result) {
  return Boolean(result?.ok && result.presentFields >= 4 && result.fields?.direccion && result.fields?.distrito && result.fields?.provincia && result.fields?.potencia);
}

export async function shutdownReceiptOcrWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = null;
}
