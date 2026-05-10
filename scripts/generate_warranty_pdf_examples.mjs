import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const workspace = '/root/.openclaw/workspace';
const outDir = path.join(workspace, 'deliverables', 'garantias-pdf-v1');
fs.mkdirSync(outDir, { recursive: true });

const colors = {
  navy: '#111C36',
  navySoft: '#1B2A4D',
  gold: '#C89A5D',
  goldSoft: '#E8D1B2',
  cyan: '#16D8E2',
  text: '#182033',
  muted: '#667085',
  line: '#D9E1EC',
  panel: '#F6F8FC',
  white: '#FFFFFF',
  successBg: '#F3FBF8',
  dangerBg: '#FFF7F5',
  success: '#1D6F52',
  danger: '#A63D32',
};

const assets = {
  logo: path.join(workspace, 'integration-app', 'assets', 'logo.png'),
  watermark: path.join(workspace, 'integration-app', 'assets', 'watermark.jpeg'),
  minibox: '/root/.openclaw/media/inbound/f3d3fbb9-387d-4dd9-97c7-572e7830eca0.png',
  alienx: '/root/.openclaw/media/inbound/e4eac93c-4f64-49e8-9dca-432d042fd9da.png',
};

const docs = [
  {
    slug: 'minibox',
    file: 'evinka-garantia-oficial-v16-minibox.pdf',
    productName: 'EVINKA MiniBox',
    model: 'MiniBox Smart AC 7.4 kW',
    serial: 'EVK-MBX-2026-00124',
    warrantyCode: 'EVK-GAR-2026-00124',
    customer: 'Luis Campos',
    document: 'DNI 904432138',
    address: 'Av. Arequipa 2220, Lince, Lima',
    installationDate: '09/05/2026',
    validUntil: '09/05/2027',
    issuedCity: 'Lima, Perú',
    installedBy: 'EVINKA · Unidad técnica certificada',
    supportEmail: 'soporte@evinka.tech',
    supportPhone: '+51 999 999 999',
    image: assets.minibox,
    coverages: [
      'Defectos de fabricación del cargador y de sus componentes electrónicos principales.',
      'Fallas funcionales del equipo bajo uso normal y dentro de las condiciones eléctricas recomendadas por EVINKA.',
      'Evaluación técnica inicial y validación del diagnóstico durante la vigencia de la garantía.',
    ],
    exclusions: [
      'Daños causados por golpes, humedad, vandalismo, apertura no autorizada o intervención de terceros.',
      'Averías derivadas de sobretensión, acometida deficiente, ausencia de protecciones o instalación modificada.',
      'Consumibles, accesorios ajenos a EVINKA y cualquier alteración no aprobada por escrito por la marca.',
    ],
  },
  {
    slug: 'alienx',
    file: 'evinka-garantia-oficial-v16-alienx.pdf',
    productName: 'EVINKA Alien X',
    model: 'Alien X Smart AC 22 kW',
    serial: 'EVK-ALX-2026-00038',
    warrantyCode: 'EVK-GAR-2026-00038',
    customer: 'Julio Campos',
    document: 'RUC 20604567891',
    address: 'Jr. Los Tulipanes 184, Surco, Lima',
    installationDate: '09/05/2026',
    validUntil: '09/05/2027',
    issuedCity: 'Lima, Perú',
    installedBy: 'EVINKA · Unidad técnica certificada',
    supportEmail: 'soporte@evinka.tech',
    supportPhone: '+51 999 999 999',
    image: assets.alienx,
    coverages: [
      'Defectos de fabricación del cargador, tarjeta de control, pantalla e interfaz principal.',
      'Fallas de operación del equipo bajo uso normal conforme a la ficha técnica y protocolo de instalación EVINKA.',
      'Diagnóstico técnico, validación de serie y atención inicial de postventa dentro del periodo de vigencia.',
    ],
    exclusions: [
      'Daños por manipulación interna no autorizada, apertura del equipo o modificación del sistema eléctrico.',
      'Daños ocasionados por variaciones severas de voltaje, inundación, incendio o agentes externos no controlados.',
      'Uso indebido, accesorios incompatibles o incumplimiento de recomendaciones básicas de operación y cuidado.',
    ],
  },
];

function roundRect(doc, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
  doc.save();
  doc.roundedRect(x, y, w, h, r);
  if (fill) doc.fillAndStroke(fill, stroke || fill);
  else if (stroke) {
    doc.lineWidth(lineWidth).strokeColor(stroke).stroke();
  }
  doc.restore();
}

function labelValue(doc, { x, y, label, value, width, valueSize = 11, labelColor = colors.muted, gap = 13 }) {
  doc.fillColor(labelColor).font('Helvetica-Bold').fontSize(8.7).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(colors.text).font('Helvetica').fontSize(valueSize).text(value, x, y + gap, { width });
}

function measureLabelValue(doc, { label, value, width, valueSize = 11, gap = 13 }) {
  doc.font('Helvetica-Bold').fontSize(8.7);
  const labelHeight = doc.heightOfString(label.toUpperCase(), { width });
  doc.font('Helvetica').fontSize(valueSize);
  const valueHeight = doc.heightOfString(value, { width });
  return labelHeight + gap + valueHeight;
}

function textBox(doc, { x, y, width, text, fontSize = 10.2, lineGap = 3, padding = 18, fill = colors.white, stroke = '#E4EAF2', radius = 18, textColor = colors.text, align = 'justify' }) {
  doc.font('Helvetica').fontSize(fontSize);
  const textHeight = doc.heightOfString(text, { width: width - padding * 2, lineGap, align });
  const height = textHeight + padding * 2;
  roundRect(doc, x, y, width, height, radius, fill, stroke);
  doc.fillColor(textColor).font('Helvetica').fontSize(fontSize).text(text, x + padding, y + padding, {
    width: width - padding * 2,
    align,
    lineGap,
  });
  return height;
}

function sectionTitle(doc, n, title, x, y, width = 260) {
  doc.save();
  const number = String(n);
  const badgeWidth = number.length > 1 ? 30 : 22;
  doc.roundedRect(x, y + 4, badgeWidth, 22, 7).fill(colors.gold);
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(number.length > 1 ? 10 : 11).text(number, x, y + 9, { width: badgeWidth, align: 'center' });
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(14).text(title, x + badgeWidth + 8, y + 5, { width });
  doc.restore();
}

function measureBulletCardHeight(doc, { width, items }) {
  const textWidth = width - 48;
  doc.font('Helvetica').fontSize(9.7);
  const itemHeights = items.map((item) =>
    doc.heightOfString(item, {
      width: textWidth,
      lineGap: 2,
    }),
  );
  const contentHeight = itemHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, items.length - 1) * 12;
  return Math.max(136, 52 + contentHeight + 18);
}

function bulletCard(doc, { x, y, width, title, items, tone }) {
  const isSuccess = tone === 'success';
  const bg = isSuccess ? colors.successBg : colors.dangerBg;
  const accent = isSuccess ? colors.success : colors.danger;
  const textWidth = width - 48;

  doc.font('Helvetica').fontSize(9.7);
  const itemHeights = items.map((item) =>
    doc.heightOfString(item, {
      width: textWidth,
      lineGap: 2,
    }),
  );

  const height = measureBulletCardHeight(doc, { width, items });

  roundRect(doc, x, y, width, height, 16, bg, '#E7ECF3');
  doc.rect(x, y, 6, height).fill(accent);
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(12).text(title, x + 18, y + 16, { width: width - 32 });

  let cursorY = y + 42;
  items.forEach((item, index) => {
    const textHeight = itemHeights[index];
    doc.circle(x + 20, cursorY + 5, 3).fill(accent);
    doc.fillColor(colors.text).font('Helvetica').fontSize(9.7).text(item, x + 32, cursorY, {
      width: textWidth,
      lineGap: 2,
    });
    cursorY += textHeight + 12;
  });

  return height;
}

function drawContinuationHeader(doc, { pageWidth, margin, title, subtitle }) {
  doc.rect(0, 0, pageWidth, 10).fill(colors.gold);
  doc.rect(0, 10, pageWidth, 78).fill(colors.navy);
  doc.image(assets.logo, margin, 30, { width: 30, height: 30 });
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(18).text(title, margin + 42, 34);
  doc.fillColor('#D6DDE8').font('Helvetica').fontSize(9.6).text(subtitle, margin + 42, 57);
}

function drawMainHeader(doc, { pageWidth, margin, warrantyCode, issuedCity, validUntil }) {
  doc.rect(0, 0, pageWidth, 12).fill(colors.gold);
  doc.rect(0, 12, pageWidth, 120).fill(colors.navy);

  roundRect(doc, margin, 34, 56, 56, 18, colors.white);
  doc.image(assets.logo, margin + 11, 45, { width: 34, height: 34 });

  const boxW = 176;
  const boxH = 58;
  const boxX = pageWidth - margin - boxW;
  const boxY = 43;
  const textX = margin + 72;
  const titleWidth = boxX - textX - 22;

  doc.font('Helvetica-Bold').fontSize(22);
  const title = 'CERTIFICADO DE GARANTÍA';
  const titleHeight = doc.heightOfString(title, { width: titleWidth, lineGap: 1 });
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(22).text(title, textX, 34, { width: titleWidth, lineGap: 1 });

  const subtitleY = 34 + titleHeight + 4;
  doc.fillColor('#D6DDE8').font('Helvetica').fontSize(10.5).text('Documento oficial de respaldo comercial y técnico EVINKA', textX, subtitleY, { width: titleWidth });
  doc.fillColor(colors.gold).font('Helvetica-Bold').fontSize(10).text(`CÓDIGO ${warrantyCode}`, textX, subtitleY + 21, { width: titleWidth });

  roundRect(doc, boxX, boxY, boxW, boxH, 14, colors.navySoft, colors.goldSoft);
  doc.fillColor(colors.goldSoft).font('Helvetica-Bold').fontSize(8.2).text('EMISIÓN Y VIGENCIA', boxX + 14, boxY + 10, { width: boxW - 28, align: 'left' });
  doc.fillColor(colors.white).font('Helvetica').fontSize(9.6).text(`Emitido en ${issuedCity}`, boxX + 14, boxY + 26, { width: boxW - 28, align: 'left' });
  doc.text(`Vigencia hasta ${validUntil}`, boxX + 14, boxY + 40, { width: boxW - 28, align: 'left' });
}

async function fitImage(file, maxWidth, maxHeight) {
  const meta = await sharp(file).metadata();
  const ratio = Math.min(maxWidth / meta.width, maxHeight / meta.height);
  return { width: meta.width * ratio, height: meta.height * ratio };
}

function drawSignature(doc, x, y, label) {
  doc.moveTo(x, y).lineTo(x + 180, y).lineWidth(1).strokeColor('#9AA8BC').stroke();
  doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(9).text(label, x + 35, y + 8, { width: 110, align: 'center' });
}

async function generateWarrantyPdf(config) {
  const target = path.join(outDir, config.file);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(target);
  doc.pipe(stream);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 38;
  const gap = 16;
  const contentWidth = pageWidth - margin * 2;

  // PAGE 1
  doc.rect(0, 0, pageWidth, pageHeight).fill(colors.white);
  doc.save();
  doc.opacity(0.05).image(assets.watermark, 180, 220, { width: 260 });
  doc.restore();

  drawMainHeader(doc, {
    pageWidth,
    margin,
    warrantyCode: config.warrantyCode,
    issuedCity: config.issuedCity,
    validUntil: config.validUntil,
  });

  let y = 146;

  const leftColWidth = 280;
  const rightColWidth = contentWidth - leftColWidth - gap;

  const eq1 = measureLabelValue(doc, { label: 'Producto', value: config.productName, width: 140, valueSize: 12.2 });
  const eq2 = measureLabelValue(doc, { label: 'Modelo', value: config.model, width: 134, valueSize: 11.2 });
  const eq3 = measureLabelValue(doc, { label: 'Serie', value: config.serial, width: 140, valueSize: 11.4 });
  const eq4 = measureLabelValue(doc, { label: 'Instalación', value: config.installationDate, width: 134, valueSize: 11.4 });
  const eq5 = measureLabelValue(doc, { label: 'Vigencia', value: `Hasta ${config.validUntil}`, width: 280, valueSize: 11.4 });
  const leftRowsHeight = Math.max(eq1, eq2) + 12 + Math.max(eq3, eq4) + 12 + eq5;
  const leftCardHeight = Math.max(142, 52 + leftRowsHeight + 18);

  const hero = await fitImage(config.image, rightColWidth - 26, 150);
  doc.font('Helvetica-Bold').fontSize(10.2);
  const heroTitleHeight = doc.heightOfString('Equipo certificado EVINKA', { width: rightColWidth - 34, align: 'center' });
  doc.font('Helvetica').fontSize(8.5);
  const heroSubtitleHeight = doc.heightOfString('Referencia visual validada para esta garantía', { width: rightColWidth - 34, align: 'center' });
  const rightCardHeight = Math.max(142, 24 + hero.height + 12 + heroTitleHeight + 6 + heroSubtitleHeight + 18);

  const heroSectionHeight = Math.max(leftCardHeight, rightCardHeight) + 32;
  roundRect(doc, margin, y, contentWidth, heroSectionHeight, 20, colors.panel, '#E4EAF2');
  roundRect(doc, margin + 16, y + 16, leftColWidth, heroSectionHeight - 32, 18, colors.white, '#E4EAF2');
  roundRect(doc, margin + 16 + leftColWidth + gap, y + 16, rightColWidth, heroSectionHeight - 32, 18, '#F3F7FC', '#DCE6F1');

  sectionTitle(doc, '1', 'Identificación del equipo', margin + 18, y + 23, 240);
  const leftY = y + 56;
  labelValue(doc, { x: margin + 22, y: leftY, label: 'Producto', value: config.productName, width: 140, valueSize: 12.2 });
  labelValue(doc, { x: margin + 168, y: leftY, label: 'Modelo', value: config.model, width: 134, valueSize: 11.2 });
  const row2Y = leftY + Math.max(eq1, eq2) + 12;
  labelValue(doc, { x: margin + 22, y: row2Y, label: 'Serie', value: config.serial, width: 140, valueSize: 11.4 });
  labelValue(doc, { x: margin + 168, y: row2Y, label: 'Instalación', value: config.installationDate, width: 134, valueSize: 11.4 });
  const row3Y = row2Y + Math.max(eq3, eq4) + 12;
  labelValue(doc, { x: margin + 22, y: row3Y, label: 'Vigencia', value: `Hasta ${config.validUntil}`, width: 280, valueSize: 11.4 });

  const heroX = margin + 16 + leftColWidth + gap;
  const heroY = y + 16;
  const imageY = heroY + 16;
  doc.image(config.image, heroX + (rightColWidth - hero.width) / 2, imageY, { width: hero.width, height: hero.height });
  const heroTextY = imageY + hero.height + 12;
  doc.fillColor(colors.navySoft).font('Helvetica-Bold').fontSize(10.2).text('Equipo certificado EVINKA', heroX + 14, heroTextY, { width: rightColWidth - 28, align: 'center' });
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text('Referencia visual validada para esta garantía', heroX + 14, heroTextY + heroTitleHeight + 6, { width: rightColWidth - 28, align: 'center' });

  y += heroSectionHeight + 12;

  sectionTitle(doc, '2', 'Titular y ubicación de instalación', margin, y, 300);
  y += 32;
  const holder1 = measureLabelValue(doc, { label: 'Titular', value: config.customer, width: 160, valueSize: 12 });
  const holder2 = measureLabelValue(doc, { label: 'Documento', value: config.document, width: 120, valueSize: 11.5 });
  const holder3 = measureLabelValue(doc, { label: 'Instalado por', value: config.installedBy, width: 180, valueSize: 10.7 });
  const holderTopRow = Math.max(holder1, holder2, holder3);
  const holderAddress = measureLabelValue(doc, { label: 'Dirección de instalación', value: config.address, width: 500, valueSize: 11.3 });
  const holderBoxHeight = 18 + holderTopRow + 14 + holderAddress + 18;
  roundRect(doc, margin, y, contentWidth, holderBoxHeight, 18, colors.white, '#E4EAF2');
  labelValue(doc, { x: margin + 18, y: y + 18, label: 'Titular', value: config.customer, width: 160, valueSize: 12 });
  labelValue(doc, { x: margin + 200, y: y + 18, label: 'Documento', value: config.document, width: 120, valueSize: 11.5 });
  labelValue(doc, { x: margin + 340, y: y + 18, label: 'Instalado por', value: config.installedBy, width: 180, valueSize: 10.7 });
  labelValue(doc, { x: margin + 18, y: y + 18 + holderTopRow + 14, label: 'Dirección de instalación', value: config.address, width: 500, valueSize: 11.3 });

  y += holderBoxHeight + 14;

  sectionTitle(doc, '3', 'Validación inicial de seguridad', margin, y, 300);
  y += 32;
  const page1SafetyLeft = 'Previo a la emisión del certificado, EVINKA valida la identificación visible del equipo, la correspondencia de serie, el punto de instalación y la revisión visual inicial de energización, fijación, entorno y cableado accesible.';
  const page1SafetyRight = 'La operación segura del equipo exige uso conforme a la capacidad instalada, área libre de manipulación indebida, ausencia de humedad directa, acceso razonable para mantenimiento y conservación del presente certificado para trazabilidad futura.';
  const page1CardWidth = (contentWidth - 16) / 2;
  const page1SafetyLeftHeight = textBox(doc, {
    x: margin,
    y,
    width: page1CardWidth,
    text: page1SafetyLeft,
    fontSize: 9.45,
    lineGap: 3,
    padding: 18,
    fill: '#F8FBFF',
    stroke: '#DCE8F4',
    radius: 18,
    align: 'justify',
  });
  const page1SafetyRightHeight = textBox(doc, {
    x: margin + page1CardWidth + 16,
    y,
    width: page1CardWidth,
    text: page1SafetyRight,
    fontSize: 9.45,
    lineGap: 3,
    padding: 18,
    fill: '#FFF9F2',
    stroke: '#F0DDC6',
    radius: 18,
    align: 'justify',
  });

  const footerY = y + Math.max(page1SafetyLeftHeight, page1SafetyRightHeight) + 14;
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8.8).text(
    'EVINKA · Documento emitido para control de garantía y trazabilidad del equipo instalado.',
    margin,
    footerY,
    { width: contentWidth, align: 'center' },
  );

  // PAGE 2
  doc.addPage({ size: 'A4', margin: 0 });
  doc.rect(0, 0, pageWidth, pageHeight).fill(colors.white);
  drawContinuationHeader(doc, {
    pageWidth,
    margin,
    title: 'ALCANCE Y SEGURIDAD',
    subtitle: config.productName,
  });

  let y2 = 110;
  const section3Text = 'EVINKA certifica que el equipo identificado en este documento cuenta con cobertura de garantía comercial limitada, válida desde la fecha de instalación y sujeta al cumplimiento de las condiciones técnicas, eléctricas, operativas y de seguridad establecidas por la marca.';
  const noteText = 'La cobertura aplica al equipo individualizado en este certificado. Para atención, el titular debe conservar identificación del producto, registro de instalación y permitir la validación técnica previa de EVINKA.';

  sectionTitle(doc, '4', 'Alcance oficial de la garantía', margin, y2, 300);
  y2 += 32;
  const introHeight = textBox(doc, {
    x: margin,
    y: y2,
    width: contentWidth,
    text: section3Text,
    fontSize: 10.1,
    lineGap: 3,
    padding: 18,
    fill: '#FFF9F2',
    stroke: '#F0DDC6',
    radius: 18,
    align: 'justify',
  });

  y2 += introHeight + 14;
  const coverageHeight = bulletCard(doc, {
    x: margin,
    y: y2,
    width: 250,
    title: 'Cobertura incluida',
    items: config.coverages,
    tone: 'success',
  });
  const exclusionsHeight = bulletCard(doc, {
    x: margin + 250 + gap,
    y: y2,
    width: 250,
    title: 'Exclusiones principales',
    items: config.exclusions,
    tone: 'danger',
  });

  const cardsBottomY = y2 + Math.max(coverageHeight, exclusionsHeight);
  const noteBoxHeight = textBox(doc, {
    x: margin,
    y: cardsBottomY + 14,
    width: contentWidth,
    text: noteText,
    fontSize: 9.2,
    lineGap: 3,
    padding: 18,
    fill: '#F8FBFF',
    stroke: '#DCE8F4',
    radius: 18,
    align: 'justify',
  });

  y2 = cardsBottomY + 14 + noteBoxHeight + 14;
  sectionTitle(doc, '5', 'Condiciones de validez', margin, y2, 240);
  y2 += 32;
  const validityHeight = textBox(doc, {
    x: margin,
    y: y2,
    width: contentWidth,
    text: 'La presente garantía aplica únicamente al equipo cuyo número de serie figura en este certificado. Para su validez, el cargador debe conservar identificación legible, haber sido instalado por EVINKA o por personal autorizado y operar dentro de los parámetros eléctricos recomendados. La cobertura no sustituye daños causados por terceros, alteraciones posteriores de la instalación, uso inadecuado ni eventos externos fuera del control de la marca.',
    fontSize: 10.2,
    lineGap: 4,
    padding: 18,
    fill: colors.white,
    stroke: '#E4EAF2',
    radius: 18,
    align: 'justify',
  });

  y2 += validityHeight + 14;
  sectionTitle(doc, '6', 'Condiciones específicas de seguridad', margin, y2, 300);
  y2 += 32;
  const safetyHeight = textBox(doc, {
    x: margin,
    y: y2,
    width: contentWidth,
    text: 'Para preservar la cobertura, el equipo debe operar con protecciones eléctricas acordes a la instalación, puesta a tierra funcional, ausencia de humedad directa, ventilación razonable y sin intervención interna no autorizada. EVINKA podrá observar como condición de seguridad la integridad visible del gabinete, conectores, fijaciones, acometida, entorno inmediato de uso y evidencias de manipulación o sobrecarga.',
    fontSize: 9.9,
    lineGap: 3,
    padding: 18,
    fill: '#F8FBFF',
    stroke: '#DCE8F4',
    radius: 18,
    align: 'justify',
  });

  const page2FooterY = pageHeight - 28;
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8.7).text(
    'EVINKA · Página de alcance, seguridad y condiciones técnicas de cobertura.',
    margin,
    page2FooterY,
    { width: contentWidth, align: 'center' },
  );

  // PAGE 3
  doc.addPage({ size: 'A4', margin: 0 });
  doc.rect(0, 0, pageWidth, pageHeight).fill(colors.white);
  drawContinuationHeader(doc, {
    pageWidth,
    margin,
    title: 'ATENCIÓN Y DISPOSICIONES',
    subtitle: config.productName,
  });

  let y3 = 110;
  sectionTitle(doc, '7', 'Procedimiento de atención', margin, y3, 250);
  y3 += 32;
  const steps = [
    'El cliente reporta la incidencia indicando el código de garantía, número de serie y descripción concreta del evento observado.',
    'EVINKA valida antecedentes, evidencia fotográfica, condiciones de seguridad y consistencia entre equipo, dirección e instalación registrada.',
    'De corresponder cobertura, se coordina diagnóstico, reparación, reposición de componente o solución técnica equivalente según evaluación.',
  ];
  const stepsTextWidth = contentWidth - 72;
  doc.font('Helvetica').fontSize(10);
  const stepHeights = steps.map((step) => doc.heightOfString(step, { width: stepsTextWidth, lineGap: 3 }));
  const stepsBoxHeight = 22 + stepHeights.reduce((sum, h) => sum + h, 0) + (steps.length - 1) * 12 + 16;
  roundRect(doc, margin, y3, contentWidth, stepsBoxHeight, 18, '#F5FAFF', '#DCE8F4');
  let stepY = y3 + 22;
  steps.forEach((step, index) => {
    roundRect(doc, margin + 18, stepY - 2, 22, 22, 7, colors.navy);
    doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10).text(String(index + 1), margin + 25, stepY + 4, { width: 8, align: 'center' });
    doc.fillColor(colors.text).font('Helvetica').fontSize(10).text(step, margin + 52, stepY, { width: stepsTextWidth, lineGap: 3 });
    stepY += stepHeights[index] + 12;
  });

  y3 += stepsBoxHeight + 12;
  sectionTitle(doc, '8', 'Registro técnico resumido', margin, y3, 250);
  y3 += 32;
  const reg1 = measureLabelValue(doc, { label: 'Código de garantía', value: config.warrantyCode, width: 160, valueSize: 11.1 });
  const reg2 = measureLabelValue(doc, { label: 'Serie', value: config.serial, width: 150, valueSize: 11.1 });
  const reg3 = measureLabelValue(doc, { label: 'Ciudad de emisión', value: config.issuedCity, width: 150, valueSize: 11 });
  const reg4 = measureLabelValue(doc, { label: 'Titular', value: config.customer, width: 160, valueSize: 11.1 });
  const reg5 = measureLabelValue(doc, { label: 'Contacto soporte', value: config.supportEmail, width: 150, valueSize: 10.2 });
  const reg6 = measureLabelValue(doc, { label: 'Teléfono', value: config.supportPhone, width: 150, valueSize: 11 });
  const regRow1 = Math.max(reg1, reg2, reg3);
  const regRow2 = Math.max(reg4, reg5, reg6);
  const registerHeight = 16 + regRow1 + 12 + regRow2 + 16;
  roundRect(doc, margin, y3, contentWidth, registerHeight, 18, colors.panel, '#E4EAF2');
  labelValue(doc, { x: margin + 18, y: y3 + 16, label: 'Código de garantía', value: config.warrantyCode, width: 160, valueSize: 11.1 });
  labelValue(doc, { x: margin + 200, y: y3 + 16, label: 'Serie', value: config.serial, width: 150, valueSize: 11.1 });
  labelValue(doc, { x: margin + 370, y: y3 + 16, label: 'Ciudad de emisión', value: config.issuedCity, width: 150, valueSize: 11 });
  labelValue(doc, { x: margin + 18, y: y3 + 16 + regRow1 + 12, label: 'Titular', value: config.customer, width: 160, valueSize: 11.1 });
  labelValue(doc, { x: margin + 200, y: y3 + 16 + regRow1 + 12, label: 'Contacto soporte', value: config.supportEmail, width: 150, valueSize: 10.2 });
  labelValue(doc, { x: margin + 370, y: y3 + 16 + regRow1 + 12, label: 'Teléfono', value: config.supportPhone, width: 150, valueSize: 11 });

  y3 += registerHeight + 12;
  sectionTitle(doc, '9', 'Validación y conformidad', margin, y3, 250);
  y3 += 32;
  const validationText = 'Este certificado acredita la emisión de garantía del equipo descrito y forma parte del expediente documental de instalación EVINKA.';
  doc.font('Helvetica').fontSize(9.8);
  const validationTextHeight = doc.heightOfString(validationText, { width: contentWidth - 36, align: 'center', lineGap: 3 });
  const validationBoxHeight = 18 + validationTextHeight + 30 + 30;
  roundRect(doc, margin, y3, contentWidth, validationBoxHeight, 18, '#FFF9F2', '#F0DDC6');
  doc.fillColor(colors.text).font('Helvetica').fontSize(9.8).text(validationText, margin + 18, y3 + 16, {
    width: contentWidth - 36,
    align: 'center',
    lineGap: 3,
  });
  const signY = y3 + 18 + validationTextHeight + 18;
  drawSignature(doc, margin + 20, signY, 'EVINKA · Sello y validación');
  drawSignature(doc, pageWidth - margin - 200, signY, 'Cliente / titular');

  y3 += validationBoxHeight + 12;
  const legalA = 'La atención de garantía podrá requerir validación del código de garantía, número de serie legible, evidencia fotográfica y verificación de las condiciones de instalación.';
  const legalB = 'La garantía comercial EVINKA no limita los derechos reconocidos al consumidor por la normativa aplicable y excluye manipulación no autorizada, terceros y eventos externos ajenos al control de la marca.';
  const channelsText = 'Canales de atención sugeridos: soporte EVINKA, validación de serie, registro fotográfico del equipo, dirección de instalación, fecha de puesta en servicio y evidencia de la incidencia reportada por el titular.';

  sectionTitle(doc, '10', 'Disposiciones complementarias', margin, y3, 280);
  y3 += 32;
  const legalCardWidth = (contentWidth - 16) / 2;
  const legalLeftHeight = textBox(doc, {
    x: margin,
    y: y3,
    width: legalCardWidth,
    text: legalA,
    fontSize: 9.2,
    lineGap: 3,
    padding: 16,
    fill: '#F8FBFF',
    stroke: '#DCE8F4',
    radius: 18,
    align: 'justify',
  });
  const legalRightHeight = textBox(doc, {
    x: margin + legalCardWidth + 16,
    y: y3,
    width: legalCardWidth,
    text: legalB,
    fontSize: 9.2,
    lineGap: 3,
    padding: 16,
    fill: '#FFF9F2',
    stroke: '#F0DDC6',
    radius: 18,
    align: 'justify',
  });

  y3 += Math.max(legalLeftHeight, legalRightHeight) + 12;
  const channelsBoxHeight = textBox(doc, {
    x: margin,
    y: y3,
    width: contentWidth,
    text: channelsText,
    fontSize: 9.1,
    lineGap: 3,
    padding: 16,
    fill: colors.panel,
    stroke: '#E4EAF2',
    radius: 18,
    align: 'justify',
  });

  const page3FooterY = Math.min(pageHeight - 26, y3 + channelsBoxHeight + 12);
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(
    'EVINKA · Garantía corporativa en 3 páginas con estructura documental estable.',
    margin,
    page3FooterY,
    { width: contentWidth, align: 'center' },
  );

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return target;
}

for (const cfg of docs) {
  const file = await generateWarrantyPdf(cfg);
  console.log(file);
}
