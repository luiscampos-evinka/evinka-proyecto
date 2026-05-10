import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requiredEnv } from '../src/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
loadEnv(path.join(ROOT, '.env'));

const OUTPUT_NAME = 'Cotizador_EVINKA_validacion_v2.xlsx';
const OUTPUT_PATH = path.join(ROOT, OUTPUT_NAME);
const STORAGE_BUCKET = 'EVINKA';
const STORAGE_OBJECT = `cotizaciones/${OUTPUT_NAME}`;

const theme = {
  green: '0F766E',
  greenLight: 'CCFBF1',
  dark: '0F172A',
  gray: 'E5E7EB',
  gray2: 'F8FAFC',
  gold: 'C6A15B',
  white: 'FFFFFF',
  red: 'B91C1C',
  yellow: 'FEF3C7',
};

function moneyFmt(cell) {
  cell.numFmt = '"S/" #,##0.00';
}
function qtyFmt(cell) {
  cell.numFmt = '#,##0.00';
}
function percentFmt(cell) {
  cell.numFmt = '0.00%';
}
function styleHeader(row, fill = theme.green) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: theme.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.border = { top: { style: 'thin', color: { argb: theme.gray } }, left: { style: 'thin', color: { argb: theme.gray } }, bottom: { style: 'thin', color: { argb: theme.gray } }, right: { style: 'thin', color: { argb: theme.gray } } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}
function styleTable(ws, fromRow, toRow, cols) {
  for (let r = fromRow; r <= toRow; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = { top: { style: 'thin', color: { argb: theme.gray } }, left: { style: 'thin', color: { argb: theme.gray } }, bottom: { style: 'thin', color: { argb: theme.gray } }, right: { style: 'thin', color: { argb: theme.gray } } };
      if (r !== fromRow) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? theme.gray2 : theme.white } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    }
  }
}

function setTitle(ws, text) {
  ws.mergeCells('A1:J1');
  const c = ws.getCell('A1');
  c.value = text;
  c.font = { size: 16, bold: true, color: { argb: theme.dark } };
  c.alignment = { vertical: 'middle', horizontal: 'left' };
}

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OpenClaw';
  wb.lastModifiedBy = 'OpenClaw';
  wb.created = new Date();
  wb.modified = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const ws0 = wb.addWorksheet('RESUMEN', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws0.columns = [
    { width: 24 }, { width: 90 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];
  setTitle(ws0, 'EVINKA · Cotizador de validación v2');
  ws0.getCell('A3').value = 'Fase actual';
  ws0.getCell('B3').value = 'Validar la lógica comercial en Excel antes de tocar código.';
  ws0.getCell('A4').value = 'Objetivo';
  ws0.getCell('B4').value = 'Separar obligatorios y condicionales, con reglas de distancia y total comercial /0.75.';
  ws0.getCell('A6').value = 'Reglas confirmadas por Luis';
  ws0.getCell('B6').value = '0–25m = base · 25–40m = x1.4 · 40–50m = x2 · 50m+ = x3 para mano de obra base y transporte.';
  ws0.getCell('B7').value = 'Cable 6mm = distancia × 1.1 × 2.';
  ws0.getCell('B8').value = 'Cable 4mm = distancia × 1.1.';
  ws0.getCell('B9').value = 'Subtotal = Mano de obra + Materiales.';
  ws0.getCell('B10').value = 'Total comercial = Subtotal / 0.75.';
  ws0.getCell('B11').value = 'Los condicionales solo aplican si el técnico los activa en FORM_VISITA.';
  ws0.getCell('A13').value = 'Qué revisar';
  ws0.getCell('B13').value = '1) Qué filas son obligatorias. 2) Qué filas son condicionales. 3) Nombres finales. 4) Precios base.';
  ws0.getColumn(1).font = { bold: true, color: { argb: theme.dark } };

  const ws1 = wb.addWorksheet('FORM_VISITA', { views: [{ state: 'frozen', ySplit: 19 }] });
  ws1.columns = [
    { width: 18 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 40 },
  ];
  setTitle(ws1, 'FORM_VISITA · Datos base y activación de condicionales');
  const baseRows = [
    ['Cliente', 'Cliente demo'],
    ['Ciudad', 'Lima'],
    ['Fecha visita', new Date('2026-04-29')],
    ['Tipo instalación', 'Monofásico'],
    ['Tipo cliente', 'B2C'],
    ['Distancia instalación (m)', 35],
    ['Tipo tubería', 'EMT'],
    ['Voltaje (V)', 220],
    ['Corriente (A)', 32],
    ['Puesta a tierra real (SI/NO)', 'NO'],
    ['Fuera de la ciudad (SI/NO)', 'NO'],
    ['Factor comercial', 0.75],
    ['Observación técnica', 'Completar con la observación validada por el técnico.'],
  ];
  let row = 3;
  for (const [label, value] of baseRows) {
    ws1.getCell(`A${row}`).value = label;
    ws1.getCell(`A${row}`).font = { bold: true };
    ws1.getCell(`B${row}`).value = value;
    row += 1;
  }
  ws1.getCell('B5').numFmt = 'yyyy-mm-dd';
  percentFmt(ws1.getCell('B14'));

  ws1.getRow(19).values = ['Código', 'Sección', 'Descripción', 'Activar', 'Cantidad', 'Precio base', 'Observación'];
  styleHeader(ws1.getRow(19));

  const conditionalRows = [
    ['0070001', 'MANO_OBRA', 'Fuera de la ciudad', { formula: 'IF(B13="SI",1,0)', result: 0 }, { formula: 'IF(D20=1,1,0)', result: 0 }, 200, 'Automático por ciudad'],
    ['0070002', 'MANO_OBRA', 'Pedestal interior', 0, 0, 550, 'Manual'],
    ['0070003', 'MANO_OBRA', 'Pedestal exterior', 0, 0, 1350, 'Manual'],
    ['0070004', 'MANO_OBRA', 'Platina pared protección', 0, 0, 0.1, 'Pendiente validar precio final'],
    ['0070005', 'MANO_OBRA', 'Caja de paso', 0, 0, 30, 'Manual'],
    ['0070006', 'MANO_OBRA', 'Caja de protección metálica con chapa', 0, 0, 100, 'Manual'],
    ['0070007', 'MANO_OBRA', 'Obra civil básica interior regata resane pintura', 0, 0, 170, 'Manual'],
    ['0070008', 'MANO_OBRA', 'Obra civil intermedia interior regata resane pintura', 0, 0, 340, 'Manual'],
    ['0070009', 'MANO_OBRA', 'Obra civil exterior excavación pasto metro lineal', 0, 0, 200, 'Manual'],
    ['0070010', 'MANO_OBRA', 'Obra civil exterior excavación adoquín', 0, 0, 400, 'Manual'],
    ['0070011', 'MANO_OBRA', 'Pase placa (perforado de pared)', 0, 0, 50, 'Manual'],
    ['0070012', 'MANO_OBRA', 'SSOMA', 0, 0, 350, 'Manual'],
    ['0070013', 'MATERIAL', 'Contómetro - Medidor de Energía Eléctrica', 0, 0, 74, 'Manual'],
    ['0070014', 'MATERIAL', 'Breaker engrapable 3x50A', 0, 0, 186.7, 'Manual'],
    ['0070015', 'MATERIAL', 'Breaker atornillable 3x50A', 0, 0, 30, 'Manual'],
    ['0070016', 'MATERIAL', 'Breaker de riel din 3x63A', 0, 0, 260, 'Manual'],
    ['0070017', 'MATERIAL', 'Breaker engrapable 1x50A', 0, 0, 160, 'Manual'],
    ['0070018', 'MATERIAL', 'Breaker de riel din 1x63A', 0, 0, 260, 'Manual'],
  ];
  let condStart = 20;
  for (const item of conditionalRows) {
    const [code, section, desc, activate, qty, price, note] = item;
    ws1.getCell(`A${condStart}`).value = code;
    ws1.getCell(`B${condStart}`).value = section;
    ws1.getCell(`C${condStart}`).value = desc;
    ws1.getCell(`D${condStart}`).value = typeof activate === 'object' ? activate : activate;
    ws1.getCell(`E${condStart}`).value = typeof qty === 'object' ? qty : qty;
    ws1.getCell(`F${condStart}`).value = price;
    ws1.getCell(`G${condStart}`).value = note;
    moneyFmt(ws1.getCell(`F${condStart}`));
    qtyFmt(ws1.getCell(`E${condStart}`));
    condStart += 1;
  }
  styleTable(ws1, 19, condStart - 1, 7);

  const ws2 = wb.addWorksheet('CATALOGO', { views: [{ state: 'frozen', ySplit: 2 }] });
  ws2.columns = [
    { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 52 }, { width: 14 }, { width: 42 },
  ];
  setTitle(ws2, 'CATALOGO · Base para validar obligatorios y condicionales');
  ws2.getRow(3).values = ['Código', 'Sección', 'Naturaleza', 'Etiqueta', 'Unidad', 'Descripción', 'Precio base', 'Regla'];
  styleHeader(ws2.getRow(3));
  const catalog = [
    ['0060001', 'MANO_OBRA', 'OBLIGATORIO', 'Sí', 'ZZ', 'Servicio de instalación estándar', 525, 'Factor distancia: base / x1.4 / x2 / x3'],
    ['0060002', 'MANO_OBRA', 'OBLIGATORIO', 'Sí', 'ZZ', 'Visita técnica e ingeniería', 110, 'Siempre 1'],
    ['0060003', 'MANO_OBRA', 'OBLIGATORIO', 'Sí', 'ZZ', 'Transporte y herramientas', 120, 'Factor distancia: base / x1.4 / x2 / x3'],
    ['0060101', 'MATERIAL', 'OBLIGATORIO', 'Sí', 'UND', 'Tablero eléctrico 6p', 164, 'Siempre 1'],
    ['0060102', 'MATERIAL', 'OBLIGATORIO', 'Sí', 'M', 'Cable 6mm', 7.9, 'Cantidad = distancia × 1.1 × 2'],
    ['0060103', 'MATERIAL', 'OBLIGATORIO', 'Sí', 'M', 'Cable 4mm', 5.6, 'Cantidad = distancia × 1.1'],
    ['0060104', 'MATERIAL', 'OBLIGATORIO_REGLA', 'Sí', 'UND', 'Tubería PVC', 24.7, 'Si tipo tubería = PVC; cantidad = redondeo distancia/3'],
    ['0060105', 'MATERIAL', 'OBLIGATORIO_REGLA', 'Sí', 'UND', 'Tubería EMT 3m 3/4', 17.5, 'Si tipo tubería = EMT; cantidad = redondeo distancia/3'],
    ['0060106', 'MATERIAL', 'OBLIGATORIO', 'Sí', 'UND', 'Interruptor termomagnético', 26.7, 'Depende de instalación y cliente'],
    ['0060107', 'MATERIAL', 'OBLIGATORIO', 'Sí', 'UND', 'Interruptor diferencial', 105.4, 'Depende de tipo cliente'],
    ['0060108', 'MATERIAL', 'OBLIGATORIO_REGLA', 'Sí', 'UND', 'Accesorios EMT Conduit', 3.5, 'Solo si tubería = EMT; cantidad = tubos EMT'],
    ['0060109', 'MATERIAL', 'CONDICIONAL_REGLA', 'No', 'GL', 'Materiales obra civil', 0, '40% de la mano de obra civil activa'],
    ['0070001', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Fuera de la ciudad', 200, 'Según técnico'],
    ['0070002', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Pedestal interior', 550, 'Según técnico'],
    ['0070003', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Pedestal exterior', 1350, 'Según técnico'],
    ['0070004', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Platina pared protección', 0.1, 'Según técnico'],
    ['0070005', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Caja de paso', 30, 'Según técnico'],
    ['0070006', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Caja de protección metálica con chapa', 100, 'Según técnico'],
    ['0070007', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Obra civil básica interior regata resane pintura', 170, 'Según técnico'],
    ['0070008', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Obra civil intermedia interior regata resane pintura', 340, 'Según técnico'],
    ['0070009', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ML', 'Obra civil exterior excavación pasto metro lineal', 200, 'Según técnico'],
    ['0070010', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ML', 'Obra civil exterior excavación adoquín', 400, 'Según técnico'],
    ['0070011', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'Pase placa (perforado de pared)', 50, 'Según técnico'],
    ['0070012', 'MANO_OBRA', 'CONDICIONAL', 'No', 'ZZ', 'SSOMA', 350, 'Según técnico'],
    ['0070013', 'MATERIAL', 'CONDICIONAL', 'No', 'UND', 'Contómetro - Medidor de Energía Eléctrica', 74, 'Según técnico'],
    ['0070014', 'MATERIAL', 'CONDICIONAL', 'No', 'UND', 'Breaker engrapable 3x50A', 186.7, 'Según técnico'],
    ['0070015', 'MATERIAL', 'CONDICIONAL', 'No', 'UND', 'Breaker atornillable 3x50A', 30, 'Según técnico'],
    ['0070016', 'MATERIAL', 'CONDICIONAL', 'No', 'UND', 'Breaker de riel din 3x63A', 260, 'Según técnico'],
    ['0070017', 'MATERIAL', 'CONDICIONAL', 'No', 'UND', 'Breaker engrapable 1x50A', 160, 'Según técnico'],
    ['0070018', 'MATERIAL', 'CONDICIONAL', 'No', 'UND', 'Breaker de riel din 1x63A', 260, 'Según técnico'],
  ];
  let catRow = 4;
  for (const item of catalog) {
    ws2.getRow(catRow).values = item;
    moneyFmt(ws2.getCell(`G${catRow}`));
    catRow += 1;
  }
  styleTable(ws2, 3, catRow - 1, 8);

  const ws3 = wb.addWorksheet('COTIZADOR', { views: [{ state: 'frozen', ySplit: 10 }] });
  ws3.columns = [
    { width: 16 }, { width: 18 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 48 }, { width: 16 }, { width: 16 }, { width: 30 },
  ];
  setTitle(ws3, 'COTIZADOR · Validación comercial EVINKA');
  ws3.getCell('A3').value = 'Cliente'; ws3.getCell('B3').value = { formula: 'FORM_VISITA!B3', result: 'Cliente demo' };
  ws3.getCell('D3').value = 'Fecha'; ws3.getCell('E3').value = { formula: 'FORM_VISITA!B5', result: new Date('2026-04-29') }; ws3.getCell('E3').numFmt = 'yyyy-mm-dd';
  ws3.getCell('A4').value = 'Tipo instalación'; ws3.getCell('B4').value = { formula: 'FORM_VISITA!B6', result: 'Monofásico' };
  ws3.getCell('D4').value = 'Tipo cliente'; ws3.getCell('E4').value = { formula: 'FORM_VISITA!B7', result: 'B2C' };
  ws3.getCell('A5').value = 'Distancia'; ws3.getCell('B5').value = { formula: 'FORM_VISITA!B8', result: 35 };
  ws3.getCell('D5').value = 'Tipo tubería'; ws3.getCell('E5').value = { formula: 'FORM_VISITA!B9', result: 'EMT' };
  ws3.getCell('A6').value = 'Regla comercial'; ws3.getCell('B6').value = 'Total final = Subtotal / 0.75';
  ws3.getCell('A8').value = 'Sección';
  ws3.getCell('B8').value = 'Naturaleza';
  ws3.getCell('C8').value = 'Activo';
  ws3.getCell('D8').value = 'Cantidad';
  ws3.getCell('E8').value = 'Unidad';
  ws3.getCell('F8').value = 'Código';
  ws3.getCell('G8').value = 'Descripción';
  ws3.getCell('H8').value = 'P. Unitario';
  ws3.getCell('I8').value = 'Total';
  ws3.getCell('J8').value = 'Regla';
  styleHeader(ws3.getRow(8), theme.dark);

  const detailRows = [
    ['MANO_OBRA', 'OBLIGATORIO', 1, 1, 'ZZ', '0060001', 'Servicio de instalación estándar', { formula: 'IF(FORM_VISITA!B8<25,525,IF(FORM_VISITA!B8<40,525*1.4,IF(FORM_VISITA!B8<50,525*2,525*3)))', result: 735 }, null, 'Factor por distancia'],
    ['MANO_OBRA', 'OBLIGATORIO', 1, 1, 'ZZ', '0060002', 'Visita técnica e ingeniería', 110, null, 'Siempre incluida'],
    ['MANO_OBRA', 'OBLIGATORIO', 1, 1, 'ZZ', '0060003', 'Transporte y herramientas', { formula: 'IF(FORM_VISITA!B8<25,120,IF(FORM_VISITA!B8<40,120*1.4,IF(FORM_VISITA!B8<50,120*2,120*3)))', result: 168 }, null, 'Factor por distancia'],
    ['MATERIAL', 'OBLIGATORIO', 1, 1, 'UND', '0060101', 'Tablero eléctrico 6p', 164, null, 'Siempre incluido'],
    ['MATERIAL', 'OBLIGATORIO', 1, { formula: 'FORM_VISITA!B8*1.1*2', result: 77 }, 'M', '0060102', 'Cable 6mm', 7.9, null, 'Distancia × 1.1 × 2'],
    ['MATERIAL', 'OBLIGATORIO', 1, { formula: 'FORM_VISITA!B8*1.1', result: 38.5 }, 'M', '0060103', 'Cable 4mm', 5.6, null, 'Distancia × 1.1'],
    ['MATERIAL', 'OBLIGATORIO_REGLA', { formula: 'IF(FORM_VISITA!B9="PVC",1,0)', result: 0 }, { formula: 'IF(C17=1,ROUNDUP(FORM_VISITA!B8/3,0),0)', result: 0 }, 'UND', '0060104', 'Tubería PVC', 24.7, null, 'Solo si tubería = PVC'],
    ['MATERIAL', 'OBLIGATORIO_REGLA', { formula: 'IF(FORM_VISITA!B9="EMT",1,0)', result: 1 }, { formula: 'IF(C18=1,ROUNDUP(FORM_VISITA!B8/3,0),0)', result: 12 }, 'UND', '0060105', 'Tubería EMT 3m 3/4', 17.5, null, 'Solo si tubería = EMT'],
    ['MATERIAL', 'OBLIGATORIO', 1, 1, 'UND', '0060106', 'Interruptor termomagnético', { formula: 'IF(FORM_VISITA!B6="Monofásico",IF(FORM_VISITA!B7="B2C",26.7,58.7),IF(FORM_VISITA!B7="B2C",46.7,109.4))', result: 26.7 }, null, 'Depende de instalación/cliente'],
    ['MATERIAL', 'OBLIGATORIO', 1, 1, 'UND', '0060107', 'Interruptor diferencial', { formula: 'IF(FORM_VISITA!B7="B2C",105.4,424)', result: 105.4 }, null, 'Depende de cliente'],
    ['MATERIAL', 'OBLIGATORIO_REGLA', { formula: 'IF(FORM_VISITA!B9="EMT",1,0)', result: 1 }, { formula: 'IF(C21=1,ROUNDUP(FORM_VISITA!B8/3,0),0)', result: 12 }, 'UND', '0060108', 'Accesorios EMT Conduit', 3.5, null, 'Solo si tubería = EMT'],
  ];
  let detailStart = 9;
  for (const item of detailRows) {
    const [section, nature, active, qty, unit, code, desc, price, _total, rule] = item;
    ws3.getCell(`A${detailStart}`).value = section;
    ws3.getCell(`B${detailStart}`).value = nature;
    ws3.getCell(`C${detailStart}`).value = active;
    ws3.getCell(`D${detailStart}`).value = qty;
    ws3.getCell(`E${detailStart}`).value = unit;
    ws3.getCell(`F${detailStart}`).value = code;
    ws3.getCell(`G${detailStart}`).value = desc;
    ws3.getCell(`H${detailStart}`).value = price;
    ws3.getCell(`I${detailStart}`).value = { formula: `C${detailStart}*D${detailStart}*H${detailStart}`, result: 0 };
    ws3.getCell(`J${detailStart}`).value = rule;
    qtyFmt(ws3.getCell(`D${detailStart}`));
    moneyFmt(ws3.getCell(`H${detailStart}`));
    moneyFmt(ws3.getCell(`I${detailStart}`));
    detailStart += 1;
  }

  const condMap = [
    [20, 'MANO_OBRA'], [21, 'MANO_OBRA'], [22, 'MANO_OBRA'], [23, 'MANO_OBRA'], [24, 'MANO_OBRA'], [25, 'MANO_OBRA'],
    [26, 'MANO_OBRA'], [27, 'MANO_OBRA'], [28, 'MANO_OBRA'], [29, 'MANO_OBRA'], [30, 'MANO_OBRA'], [31, 'MANO_OBRA'],
    [32, 'MATERIAL'], [33, 'MATERIAL'], [34, 'MATERIAL'], [35, 'MATERIAL'], [36, 'MATERIAL'], [37, 'MATERIAL'],
  ];
  for (let i = 0; i < condMap.length; i += 1) {
    const sourceRow = condMap[i][0];
    const section = condMap[i][1];
    const target = 20 + i;
    ws3.getCell(`A${target}`).value = section;
    ws3.getCell(`B${target}`).value = 'CONDICIONAL';
    ws3.getCell(`C${target}`).value = { formula: `FORM_VISITA!D${sourceRow}`, result: 0 };
    ws3.getCell(`D${target}`).value = { formula: `IF(C${target}=1,FORM_VISITA!E${sourceRow},0)`, result: 0 };
    ws3.getCell(`E${target}`).value = { formula: `IF(FORM_VISITA!A${sourceRow}="", "", INDEX({"ZZ","ZZ","ZZ","ZZ","ZZ","ZZ","ZZ","ZZ","ML","ML","ZZ","ZZ","UND","UND","UND","UND","UND","UND"},ROW()-19))`, result: '' };
    ws3.getCell(`F${target}`).value = { formula: `FORM_VISITA!A${sourceRow}`, result: '' };
    ws3.getCell(`G${target}`).value = { formula: `FORM_VISITA!C${sourceRow}`, result: '' };
    ws3.getCell(`H${target}`).value = { formula: `FORM_VISITA!F${sourceRow}`, result: 0 };
    ws3.getCell(`I${target}`).value = { formula: `C${target}*D${target}*H${target}`, result: 0 };
    ws3.getCell(`J${target}`).value = 'Solo suma si técnico lo activa';
    qtyFmt(ws3.getCell(`D${target}`));
    moneyFmt(ws3.getCell(`H${target}`));
    moneyFmt(ws3.getCell(`I${target}`));
  }

  ws3.getCell('A39').value = 'MATERIAL';
  ws3.getCell('B39').value = 'CONDICIONAL_REGLA';
  ws3.getCell('C39').value = { formula: 'IF(SUM(I26:I29)>0,1,0)', result: 0 };
  ws3.getCell('D39').value = 1;
  ws3.getCell('E39').value = 'GL';
  ws3.getCell('F39').value = '0060109';
  ws3.getCell('G39').value = 'Materiales obra civil';
  ws3.getCell('H39').value = { formula: 'ROUND(SUM(I26:I29)*0.4,2)', result: 0 };
  ws3.getCell('I39').value = { formula: 'C39*D39*H39', result: 0 };
  ws3.getCell('J39').value = '40% de MO civil activa';
  moneyFmt(ws3.getCell('H39')); moneyFmt(ws3.getCell('I39'));

  styleTable(ws3, 8, 39, 10);
  ws3.getCell('G41').value = 'Total mano de obra';
  ws3.getCell('I41').value = { formula: 'SUM(I9:I11)+SUM(I20:I31)', result: 0 };
  ws3.getCell('G42').value = 'Total materiales';
  ws3.getCell('I42').value = { formula: 'SUM(I12:I19)+SUM(I32:I39)', result: 0 };
  ws3.getCell('G43').value = 'Subtotal antes de IGV/comercial';
  ws3.getCell('I43').value = { formula: 'I41+I42', result: 0 };
  ws3.getCell('G44').value = 'Total comercial (/0.75)';
  ws3.getCell('I44').value = { formula: 'I43/FORM_VISITA!B14', result: 0 };
  ws3.getCell('G45').value = 'Margen comercial aplicado';
  ws3.getCell('I45').value = { formula: 'I44-I43', result: 0 };
  for (const cell of ['I41','I42','I43','I44','I45']) moneyFmt(ws3.getCell(cell));
  ['G41','G42','G43','G44','G45'].forEach((addr) => {
    ws3.getCell(addr).font = { bold: true, color: { argb: theme.dark } };
  });
  ws3.getCell('G44').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.yellow } };
  ws3.getCell('I44').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.yellow } };

  for (const ws of [ws0, ws1, ws2, ws3]) {
    ws.eachRow((r) => { r.height = 20; });
  }

  await wb.xlsx.writeFile(OUTPUT_PATH);
  return OUTPUT_PATH;
}

async function uploadToSupabase(localPath) {
  const base = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const body = await fs.readFile(localPath);
  const res = await fetch(`${base}/storage/v1/object/${STORAGE_BUCKET}/${STORAGE_OBJECT}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'x-upsert': 'true',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload Supabase falló: ${res.status} ${res.statusText} :: ${text}`);
  return { bucket: STORAGE_BUCKET, object: STORAGE_OBJECT, raw: text };
}

const localPath = await buildWorkbook();
const upload = await uploadToSupabase(localPath);
console.log(JSON.stringify({ localPath, ...upload }, null, 2));
