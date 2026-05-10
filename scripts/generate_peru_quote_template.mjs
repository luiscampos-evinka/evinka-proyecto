import ExcelJS from 'exceljs';

const outputPath = '/root/.openclaw/workspace/Cotizador_EVINKA_Peru_v5.xlsx';
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Evi';
workbook.company = 'EVINKA';
workbook.created = new Date();
workbook.modified = new Date();
workbook.subject = 'Cotizador EVINKA Perú';
workbook.title = 'Cotizador EVINKA Perú';
workbook.description = 'Base maestra para visitas técnicas y cotizaciones EVINKA en Perú';
workbook.calcProperties.fullCalcOnLoad = true;

const COLORS = {
  bg: '0F0F10',
  panel: '1A1A1D',
  gold: 'C7A06A',
  goldSoft: 'EAD1A9',
  text: 'F4EFE7',
  muted: 'B8AB95',
  green: '25C27B',
  blue: '5E8CFF',
  red: 'D85D5D',
  yellow: 'F0C86F',
  white: 'FFFFFF',
  input: 'FFF7EA',
  grayFill: 'F5F1EA',
  softGold: 'F5E8D4',
  softBlue: 'EAF2FF',
  softGreen: 'EAF8F1',
  softRed: 'FCEBEB'
};

function applyPageSetup(ws) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  };
  ws.properties.defaultRowHeight = 22;
  ws.views = [{ state: 'frozen', ySplit: 3 }];
}

function setTitle(ws, title, subtitle = '') {
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = title;
  ws.getCell('A1').font = { size: 18, bold: true, color: { argb: COLORS.goldSoft } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bg } };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;
  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = subtitle;
  ws.getCell('A2').font = { size: 10, color: { argb: COLORS.muted } };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bg } };
  ws.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
}

function styleHeader(cell) {
  cell.font = { bold: true, color: { argb: COLORS.text } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.panel } };
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.gold } },
    left: { style: 'thin', color: { argb: COLORS.gold } },
    bottom: { style: 'thin', color: { argb: COLORS.gold } },
    right: { style: 'thin', color: { argb: COLORS.gold } },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

function styleSectionRow(ws, rowNumber, label) {
  ws.mergeCells(`A${rowNumber}:H${rowNumber}`);
  const c = ws.getCell(`A${rowNumber}`);
  c.value = label;
  c.font = { bold: true, color: { argb: COLORS.bg }, size: 11 };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gold } };
  c.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(rowNumber).height = 24;
}

function helperRow(ws, rowNumber, text, fill = COLORS.grayFill) {
  ws.mergeCells(`A${rowNumber}:H${rowNumber}`);
  const cell = ws.getCell(`A${rowNumber}`);
  cell.value = text;
  cell.font = { size: 10, italic: true, color: { argb: '6A5E51' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  cell.border = thinBorder();
  ws.getRow(rowNumber).height = 22;
}

function totalLabelCell(cell) {
  cell.font = { bold: true, color: { argb: COLORS.text }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.panel } };
  cell.border = thinBorder();
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function totalValueCell(cell) {
  moneyCell(cell);
  cell.font = { bold: true, color: { argb: COLORS.text }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.panel } };
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
}

function setColumns(ws, widths) {
  ws.columns = widths.map((width, i) => ({ key: `c${i+1}`, width }));
}

function moneyCell(cell, editable = false) {
  cell.numFmt = '"S/" #,##0.00';
  cell.border = thinBorder();
  if (editable) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.input } };
  }
}

function thinBorder() {
  return {
    top: { style: 'thin', color: { argb: 'D9C9AF' } },
    left: { style: 'thin', color: { argb: 'D9C9AF' } },
    bottom: { style: 'thin', color: { argb: 'D9C9AF' } },
    right: { style: 'thin', color: { argb: 'D9C9AF' } },
  };
}

function labelCell(cell) {
  cell.font = { bold: true, color: { argb: '4A4036' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.softGold } };
  cell.border = thinBorder();
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function inputCell(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.input } };
  cell.border = thinBorder();
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function noteCell(cell) {
  cell.font = { italic: true, color: { argb: COLORS.muted } };
}

function addTable(ws, startRow, headers, rows, options = {}) {
  const { currencyCols = [], editableCols = [], noteCols = [] } = options;
  headers.forEach((h, idx) => {
    const cell = ws.getCell(startRow, idx + 1);
    cell.value = h;
    styleHeader(cell);
  });
  rows.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      const cell = ws.getCell(startRow + 1 + rIdx, cIdx + 1);
      cell.value = val;
      cell.border = thinBorder();
      if (currencyCols.includes(cIdx + 1) && typeof val === 'number') moneyCell(cell, editableCols.includes(cIdx + 1));
      if (editableCols.includes(cIdx + 1) && !currencyCols.includes(cIdx + 1)) inputCell(cell);
      if (noteCols.includes(cIdx + 1)) noteCell(cell);
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', horizontal: 'left', wrapText: true };
      if (typeof val === 'string' && val.length > 70) {
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      }
    });
  });
}

function addValidationList(cell, formula) {
  cell.dataValidation = { type: 'list', allowBlank: true, formulae: [formula] };
}

// 00_LEEME
{
  const ws = workbook.addWorksheet('00_LEEME');
  applyPageSetup(ws);
  setColumns(ws, [22, 22, 22, 22, 22, 22, 22, 22]);
  setTitle(ws, 'EVINKA · Cotizador Maestro Perú', 'Borrador inicial ordenado para visitas, cálculo y cotización comercial.');
  styleSectionRow(ws, 4, 'OBJETIVO');
  ws.getCell('A5').value = 'Este archivo estandariza el flujo de cotización EVINKA para Perú. Se separa en entrada técnica, tablas maestras de precios, cálculo y plantilla comercial.';
  ws.getCell('A5').alignment = { wrapText: true };
  ws.mergeCells('A5:H6');
  styleSectionRow(ws, 8, 'CÓMO USARLO');
  const steps = [
    '1. Completar la hoja 04_INPUT_VISITA con la información del cliente y la visita técnica.',
    '2. Mantener actualizadas las hojas 02_PRECIOS_INSTALACION y 03_PRECIOS_COMPONENTES con precios oficiales de Perú.',
    '3. Revisar 05_CALCULO_COTIZACION para validar subtotales, IGV y adicionales de instalación.',
    '4. Copiar o automatizar la salida final desde 06_PLANTILLA_COTIZACION para generar el PDF comercial de instalación.'
  ];
  steps.forEach((s, i) => {
    ws.getCell(`A${9+i}`).value = s;
    ws.mergeCells(`A${9+i}:H${9+i}`);
  });
  styleSectionRow(ws, 15, 'REGLAS DE GOBIERNO');
  const rules = [
    ['País objetivo', 'Perú'],
    ['Moneda', 'Soles (S/)'],
    ['Impuesto base', 'IGV 18%'],
    ['Alcance de esta versión', 'Solo instalación, sin precio de cargador'],
    ['Dependencias pendientes', 'Cerrar precios manuales, pozo a tierra, tableros especiales y reglas comerciales finales']
  ];
  addTable(ws, 16, ['Campo', 'Valor'], rules);
}

// 01_PARAMETROS_PERU
{
  const ws = workbook.addWorksheet('01_PARAMETROS_PERU');
  applyPageSetup(ws);
  setColumns(ws, [30, 24, 46, 24, 24, 18, 18, 18]);
  setTitle(ws, 'Parámetros Generales Perú', 'Valores maestros para moneda, IGV, vigencia y condiciones comerciales.');
  addTable(ws, 4, ['Parámetro', 'Valor', 'Detalle'], [
    ['PAIS', 'Perú', 'No dejar compatibilidad Colombia en esta versión'],
    ['MONEDA', 'S/', 'Moneda oficial del cotizador'],
    ['IGV', 0.18, 'Impuesto general a las ventas'],
    ['VALIDEZ_COTIZACION_DIAS', 7, 'Editable según política comercial'],
    ['FORMA_PAGO_DEFAULT', 'Contado', 'Puede cambiarse por proyecto'],
    ['CIUDAD_BASE', 'Lima', 'Base operativa inicial'],
    ['TIEMPO_INSTALACION_DEFAULT', '1 - 2 días', 'Estimado base'],
    ['GARANTIA_DEFAULT', '1 año', 'Garantía referencial de instalación y materiales aplicables']
  ], { editableCols: [2], currencyCols: [] });
  ws.getCell('B6').numFmt = '0%';
  styleSectionRow(ws, 15, 'NORMALIZACIÓN DE LENGUAJE');
  addTable(ws, 16, ['Eliminar', 'Usar en Perú'], [
    ['Bogotá', 'Lima / ciudad del cliente en Perú'],
    ['RETIE 2024', 'Normativa y redacción técnica válida para Perú (por validar con ingeniería)'],
    ['NTC 2050', 'Terminología peruana / reglamento aplicable'],
    ['COP / $', 'S/'],
    ['B2C/B2B si confunde', 'Persona natural / empresa']
  ]);
}

const preciosInstalacion = [
  ['Tubería PVC para empotrado', 'metro', 18.5, 24.7, 'Validar si precio final será sin/ con margen oficial'],
  ['Tubería Conduit EMT', '3m', 13.1, 17.5, 'Revisar forma de compra y prorrateo'],
  ['Accesorios Conduit', 'metro', 2.62, 3.5, 'Variable por tramo'],
  ['Cable 4mm2', 'metro', 4.17, 5.6, 'Tierra hasta 39m'],
  ['Cable 6mm2', 'metro', 5.87, 7.9, 'Fuerza base / tierra >40m'],
  ['Cable 10mm2', 'metro', 10, 13.4, 'Fuerza >40m'],
  ['Cable 16mm2', 'metro', 15.6, 20.8, 'Proyecto especial'],
  ['Mano de obra 0-24.9m', 'GL', 525, 700, 'Cuadrilla base'],
  ['Mano de obra 25-39.9m', 'GL', 735, 980, 'Distancia media'],
  ['Mano de obra 40-50m', 'GL', 1049, 1398.7, 'Distancia alta'],
  ['Trabajo de altura', 'día', 600, 800, 'Solo si aplica'],
  ['Técnico certificado altura', 'día', 50, 66.7, 'Solo si aplica'],
  ['SSOMA', 'día', 350, 466.7, 'Validar cuándo es obligatorio'],
  ['Obra civil por día', 'día', 170, 226.7, 'Resane / corte de pared'],
  ['Materiales obra civil', 'día', 68, 90.7, 'Apoyo obra civil'],
  ['Transporte Lima 0-24.9m', 'GL', 120, 160, 'Base Lima'],
  ['Transporte Lima 25-39.9m', 'GL', 156, 208, 'Base Lima'],
  ['Transporte Lima 40-50m', 'GL', 240, 320, 'Base Lima'],
  ['Excavación pasto', 'metro', null, null, 'Pendiente de cerrar'],
  ['Excavación adoquín', 'metro', null, null, 'Pendiente de cerrar'],
  ['Pozo a tierra', 'proyecto', null, null, 'Pendiente de validar con responsable técnico']
];

{
  const ws = workbook.addWorksheet('02_PRECIOS_INSTALACION');
  applyPageSetup(ws);
  setColumns(ws, [40, 16, 18, 20, 44, 16, 16, 16]);
  setTitle(ws, 'Precios de Instalación Perú', 'Tabla maestra rescatada y ordenada desde “Precios a conocer”.');
  helperRow(ws, 3, 'Las fórmulas del cotizador usan como base principal la mano de obra 0-24.9 m y el transporte 0-24.9 m; luego aplican factor 1.4 o 2 según la distancia.');
  addTable(ws, 5, ['Concepto', 'Unidad', 'Costo base', 'Precio referencial', 'Nota'], preciosInstalacion, { currencyCols: [3,4], editableCols: [3,4], noteCols: [5] });
  [13,14,15].forEach((row)=>{
    ['A','B','C','D','E'].forEach((col)=>{
      ws.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.softBlue } };
    });
  });
  [21,22,23].forEach((row)=>{
    ['A','B','C','D','E'].forEach((col)=>{
      ws.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.softGreen } };
    });
  });
}

const preciosComponentes = [
  ['Interruptor termomagnético monofásico estándar', 'unidad', 20, 26.7, 'Revisar si aplica en Perú tal cual'],
  ['Interruptor termomagnético monofásico premium tipo A', 'unidad', 44, 58.7, ''],
  ['Interruptor diferencial estándar', 'unidad', 79, 105.4, ''],
  ['Interruptor diferencial premium tipo A', 'unidad', 318, 424, ''],
  ['Interruptor termomagnético trifásico estándar 40A', 'unidad', 35, 46.7, ''],
  ['Interruptor termomagnético trifásico premium 40A', 'unidad', 82, 109.4, ''],
  ['Breaker riel DIN trifásico premium 3x63A', 'unidad', 195, 260, ''],
  ['Breaker engrapable 50A', 'unidad', 120, 160, 'Monofásico'],
  ['Breaker riel DIN trifásico 3x63A', 'unidad', 22, 29.4, ''],
  ['Breaker engrapable trifásico 3x50A', 'unidad', 140, 186.7, ''],
  ['Tablero dedicado 6 polos', 'unidad', 123, 164, ''],
  ['Contómetro / medidor de energía', 'unidad', 55, 73.4, ''],
  ['Caja de pase eléctrica', 'unidad', 21, 28, ''],
  ['Pedestal', 'unidad', null, null, 'Definir costo oficial Perú'],
  ['Montaje del cargador - materiales', 'GL', 380, null, 'Revisar si queda como pack'],
  ['Adaptación de tablero general', 'proyecto', null, null, 'Manual por proyecto'],
  ['Fabricación nuevo tablero general', 'proyecto', null, null, 'Manual por proyecto'],
  ['Caja de seguridad', 'unidad', null, null, 'Pendiente'],
  ['Techo para cargador', 'unidad', null, null, 'Pendiente'],
  ['Rejillas / planchas', 'unidad', null, null, 'Pendiente']
];

{
  const ws = workbook.addWorksheet('03_PRECIOS_COMPONENTES');
  applyPageSetup(ws);
  setColumns(ws, [38, 14, 16, 18, 32, 16, 16, 16]);
  setTitle(ws, 'Precios de Componentes Perú', 'Componentes y adicionales que alimentan la cotización.');
  addTable(ws, 4, ['Componente', 'Unidad', 'Costo base', 'Precio referencial', 'Observación'], preciosComponentes, { currencyCols: [3,4], editableCols: [3,4], noteCols: [5] });
}

// 04_INPUT_VISITA
{
  const ws = workbook.addWorksheet('04_INPUT_VISITA');
  applyPageSetup(ws);
  setColumns(ws, [44, 34, 18, 18, 18, 18, 18, 24]);
  setTitle(ws, 'Input de Visita Técnica', 'Hoja editable para que el técnico o el formulario alimente los datos del proyecto.');
  helperRow(ws, 3, 'Completa solo las celdas claras. Usa esta hoja como entrada principal de la visita técnica.');

  styleSectionRow(ws, 5, 'DATOS DEL CLIENTE');
  const cliente = [
    ['Cliente', ''],
    ['Documento (DNI/RUC)', ''],
    ['Teléfono', ''],
    ['Correo', ''],
    ['Dirección', ''],
    ['Distrito', ''],
    ['Provincia', ''],
    ['Departamento', ''],
  ];
  let r = 6;
  cliente.forEach(([label, val]) => {
    labelCell(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = label;
    inputCell(ws.getCell(`B${r}`)); ws.getCell(`B${r}`).value = val;
    ws.mergeCells(`B${r}:E${r}`);
    ws.getRow(r).height = 24;
    r++;
  });

  styleSectionRow(ws, 16, 'DATOS DE LA VISITA');
  helperRow(ws, 17, 'La distancia de acometida define el tramo del cálculo. Si hay un cargo especial fuera de Lima, colócalo manualmente al final.');
  const visita = [
    ['Fecha visita', ''],
    ['Técnico', ''],
    ['Marca vehículo', ''],
    ['Modelo vehículo', ''],
    ['Referencia cargador (solo informativo)', ''],
    ['Tipo cliente', 'Persona natural'],
    ['Fase de instalación', 'Monofásico'],
    ['Voltaje (V)', 220],
    ['Corriente (A)', 32],
    ['Distancia acometida (m)', 20],
    ['Tipo de tubería', 'EMT'],
    ['Puesta a tierra real', 'NO'],
    ['Adicional fuera de Lima (opcional)', 0]
  ];
  r = 18;
  visita.forEach(([label, val]) => {
    labelCell(ws.getCell(`A${r}`)); ws.getCell(`A${r}`).value = label;
    inputCell(ws.getCell(`B${r}`)); ws.getCell(`B${r}`).value = val;
    ws.mergeCells(`B${r}:E${r}`);
    ws.getRow(r).height = 24;
    r++;
  });

  addValidationList(ws.getCell('B23'), '"Persona natural,Empresa"');
  addValidationList(ws.getCell('B24'), '"Monofásico,Trifásico"');
  addValidationList(ws.getCell('B28'), '"EMT,PVC"');
  addValidationList(ws.getCell('B29'), '"SI,NO"');

  styleSectionRow(ws, 33, 'ADICIONALES Y OBRA CIVIL');
  helperRow(ws, 34, 'En cantidad coloca 0 si el adicional no aplica. Puedes ajustar el precio unitario si hace falta.');
  const adds = [
    ['Pedestal interior', 0, 550],
    ['Pedestal exterior', 0, 1350],
    ['Platina pared protección', 0, 0],
    ['Caja de paso', 0, 30],
    ['Caja metálica con chapa', 0, 100],
    ['Obra civil básica interior', 0, 170],
    ['Obra civil intermedia interior', 0, 340],
    ['Excavación exterior pasto', 0, 0],
    ['Excavación exterior adoquín', 0, 0],
    ['Pase de muro', 0, 50],
    ['SSOMA', 0, 350],
    ['Contómetro', 0, 74],
  ];
  addTable(ws, 35, ['Concepto', 'Cantidad', 'Precio unitario'], adds, { currencyCols: [3], editableCols: [2,3] });

  styleSectionRow(ws, 50, 'OBSERVACIÓN TÉCNICA E INSUMOS FOTOGRÁFICOS');
  helperRow(ws, 51, 'Agrega aquí el resumen técnico de la visita y las referencias de fotos si ya las tienes.');
  labelCell(ws.getCell('A52')); ws.getCell('A52').value = 'Descripción técnica de la instalación';
  ws.getRow(52).height = 30;
  inputCell(ws.getCell('B52')); ws.mergeCells('B52:H55');
  ws.getCell('B52').alignment = { wrapText: true, vertical: 'top' };
  labelCell(ws.getCell('A56')); ws.getCell('A56').value = 'URL / referencia foto tablero'; inputCell(ws.getCell('B56')); ws.mergeCells('B56:H56');
  labelCell(ws.getCell('A57')); ws.getCell('A57').value = 'URL / referencia foto punto de carga'; inputCell(ws.getCell('B57')); ws.mergeCells('B57:H57');
  labelCell(ws.getCell('A58')); ws.getCell('A58').value = 'URL / referencia foto general'; inputCell(ws.getCell('B58')); ws.mergeCells('B58:H58');
}

// 05_CALCULO_COTIZACION
{
  const ws = workbook.addWorksheet('05_CALCULO_COTIZACION');
  applyPageSetup(ws);
  setColumns(ws, [44, 16, 20, 22, 18, 18, 18, 18]);
  setTitle(ws, 'Cálculo de Cotización', 'Hoja de trabajo para subtotales, instalación e IGV.');
  helperRow(ws, 3, 'Aquí no necesitas escribir mucho: el total sale desde los datos de la hoja 04_INPUT_VISITA.');
  addTable(ws, 5, ['Concepto', 'Cantidad', 'Precio unitario', 'Total'], [
    ['Mano de obra técnica', 1, { formula: 'IF(\'04_INPUT_VISITA\'!B27<25,\'02_PRECIOS_INSTALACION\'!C12,IF(\'04_INPUT_VISITA\'!B27<40,\'02_PRECIOS_INSTALACION\'!C12*1.4,\'02_PRECIOS_INSTALACION\'!C12*2))' }, { formula: 'B6*C6' }],
    ['Visita técnica e ingeniería', 1, 110, { formula: 'B7*C7' }],
    ['Transporte y herramientas', 1, { formula: 'IF(\'04_INPUT_VISITA\'!B27<25,\'02_PRECIOS_INSTALACION\'!C20,IF(\'04_INPUT_VISITA\'!B27<40,\'02_PRECIOS_INSTALACION\'!C20*1.4,\'02_PRECIOS_INSTALACION\'!C20*2))' }, { formula: 'B8*C8' }],
    ['Adicionales / obra civil', 1, { formula: 'SUMPRODUCT(\'04_INPUT_VISITA\'!B36:B47,\'04_INPUT_VISITA\'!C36:C47)' }, { formula: 'B9*C9' }],
    ['Adicional fuera de Lima (opcional)', 1, { formula: 'IFERROR(VALUE(\'04_INPUT_VISITA\'!B30),0)' }, { formula: 'B10*C10' }],
    ['Contingencia técnica', 1, 0, { formula: 'B11*C11' }],
  ], { currencyCols: [3,4], editableCols: [3] });

  labelCell(ws.getCell('A14')); ws.getCell('A14').value = 'Distancia considerada (m)';
  ws.getCell('D14').value = { formula: '\'04_INPUT_VISITA\'!B27' }; moneyCell(ws.getCell('D14'));
  ws.getCell('D14').numFmt = '0.0';
  labelCell(ws.getCell('A15')); ws.getCell('A15').value = 'Factor aplicado';
  ws.getCell('D15').value = { formula: 'IF(\'04_INPUT_VISITA\'!B27<25,1,IF(\'04_INPUT_VISITA\'!B27<40,1.4,2))' };
  ws.getCell('D15').border = thinBorder();
  ws.getCell('D15').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.softBlue } };

  totalLabelCell(ws.getCell('A17')); ws.getCell('A17').value = 'Subtotal instalación';
  ws.getCell('D17').value = { formula: 'SUM(D6:D11)' }; totalValueCell(ws.getCell('D17'));
  totalLabelCell(ws.getCell('A18')); ws.getCell('A18').value = 'IGV instalación';
  ws.getCell('D18').value = { formula: 'D17*\'01_PARAMETROS_PERU\'!B7' }; totalValueCell(ws.getCell('D18'));
  totalLabelCell(ws.getCell('A19')); ws.getCell('A19').value = 'Total instalación con IGV';
  ws.getCell('D19').value = { formula: 'D17+D18' }; totalValueCell(ws.getCell('D19'));

  styleSectionRow(ws, 22, 'TOTAL COMERCIAL');
  totalLabelCell(ws.getCell('A23')); ws.getCell('A23').value = 'Subtotal instalación'; ws.getCell('D23').value = { formula: 'D17' }; totalValueCell(ws.getCell('D23'));
  totalLabelCell(ws.getCell('A24')); ws.getCell('A24').value = 'IGV'; ws.getCell('D24').value = { formula: 'D18' }; totalValueCell(ws.getCell('D24'));
  totalLabelCell(ws.getCell('A25')); ws.getCell('A25').value = 'TOTAL PROPUESTA'; ws.getCell('D25').value = { formula: 'D19' }; totalValueCell(ws.getCell('D25'));
  helperRow(ws, 27, 'Esta versión del cotizador considera solo instalación. El precio del cargador no se incluye.');
}

// 06_PLANTILLA_COTIZACION
{
  const ws = workbook.addWorksheet('06_PLANTILLA_COTIZACION');
  ws.properties.defaultRowHeight = 22;
  setColumns(ws, [6, 18, 18, 18, 18, 18, 18, 18]);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  ws.mergeCells('B2:H2');
  ws.getCell('B2').value = 'EVINKA · Cotización de instalación de cargador vehicular';
  ws.getCell('B2').font = { bold: true, size: 16, color: { argb: COLORS.goldSoft } };
  ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bg } };

  ws.mergeCells('B4:D4'); labelCell(ws.getCell('B4')); ws.getCell('B4').value = 'Cliente';
  ws.mergeCells('E4:H4'); inputCell(ws.getCell('E4')); ws.getCell('E4').value = { formula: '\'04_INPUT_VISITA\'!B6' };
  ws.mergeCells('B5:D5'); labelCell(ws.getCell('B5')); ws.getCell('B5').value = 'Dirección';
  ws.mergeCells('E5:H5'); inputCell(ws.getCell('E5')); ws.getCell('E5').value = { formula: '\'04_INPUT_VISITA\'!B10' };
  ws.mergeCells('B6:D6'); labelCell(ws.getCell('B6')); ws.getCell('B6').value = 'Ciudad / Provincia';
  ws.mergeCells('E6:H6'); inputCell(ws.getCell('E6')); ws.getCell('E6').value = { formula: 'CONCAT(\'04_INPUT_VISITA\'!B11," / ",\'04_INPUT_VISITA\'!B12)' };
  ws.mergeCells('B7:D7'); labelCell(ws.getCell('B7')); ws.getCell('B7').value = 'Fecha';
  ws.mergeCells('E7:H7'); inputCell(ws.getCell('E7')); ws.getCell('E7').value = { formula: '\'04_INPUT_VISITA\'!B18' };

  styleSectionRow(ws, 10, 'ALCANCE Y CONDICIONES');
  ws.mergeCells('B11:H13'); inputCell(ws.getCell('B11')); ws.getCell('B11').value = { formula: '\'04_INPUT_VISITA\'!B52' }; ws.getCell('B11').alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells('B15:H15'); ws.getCell('B15').value = 'La propuesta corresponde a una instalación en Perú y debe validarse con ingeniería EVINKA antes del envío final al cliente.'; noteCell(ws.getCell('B15'));

  styleSectionRow(ws, 18, 'RESUMEN ECONÓMICO');
  addTable(ws, 19, ['Concepto', 'Monto'], [
    ['Subtotal instalación', { formula: '\'05_CALCULO_COTIZACION\'!D23' }],
    ['IGV', { formula: '\'05_CALCULO_COTIZACION\'!D24' }],
    ['Total propuesta', { formula: '\'05_CALCULO_COTIZACION\'!D25' }],
  ], { currencyCols: [2] });

  styleSectionRow(ws, 25, 'CONDICIONES COMERCIALES');
  addTable(ws, 26, ['Ítem', 'Valor'], [
    ['Validez de la cotización', { formula: '\'01_PARAMETROS_PERU\'!B7 & " días"' }],
    ['Forma de pago', { formula: '\'01_PARAMETROS_PERU\'!B8' }],
    ['Tiempo estimado instalación', { formula: '\'01_PARAMETROS_PERU\'!B9' }],
    ['Garantía', { formula: '\'01_PARAMETROS_PERU\'!B10' }],
    ['Alcance', 'Solo instalación, sin incluir precio del cargador'],
  ]);
}

await workbook.xlsx.writeFile(outputPath);
console.log(`OK ${outputPath}`);
