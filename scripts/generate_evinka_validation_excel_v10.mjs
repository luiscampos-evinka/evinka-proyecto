import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, requiredEnv } from '../src/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
loadEnv(path.join(ROOT, '.env'));

const OUTPUT_NAME = 'Cotizador_EVINKA_validacion_v10.xlsx';
const OUTPUT_PATH = path.join(ROOT, OUTPUT_NAME);
const STORAGE_BUCKET = 'EVINKA';
const STORAGE_OBJECT = `cotizaciones/${OUTPUT_NAME}`;

const C = { black:'0F0F10', black2:'1A1A1D', gold:'C7A06A', goldText:'0F0F10', title:'EAD1A9', subtitle:'B8AB95', line:'D9D2C7', note:'F5F1EA', label:'F5E8D4', input:'FFF7EA', white:'FFFFFF', total:'F3E2B8' };
const borderAll = () => ({ top:{style:'thin',color:{argb:C.line}}, left:{style:'thin',color:{argb:C.line}}, right:{style:'thin',color:{argb:C.line}}, bottom:{style:'thin',color:{argb:C.line}} });
const money = (c) => c.numFmt = '"S/" #,##0.00';
const qty = (c) => c.numFmt = '#,##0.00';
const pct = (c) => c.numFmt = '0.00%';
function setPage(ws, landscape = true) { ws.pageSetup = { paperSize:9, orientation: landscape ? 'landscape':'portrait', fitToPage:true, fitToWidth:1, fitToHeight:0, margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.2,footer:0.2} }; ws.views = [{ state:'frozen', ySplit:4 }]; }
function titleBlock(ws, title, subtitle, end='H') { ws.mergeCells(`A1:${end}1`); ws.mergeCells(`A2:${end}2`); ws.getCell('A1').value=title; ws.getCell('A2').value=subtitle; for (const a of ['A1','A2']) { const c=ws.getCell(a); c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.black}}; c.alignment={horizontal:'left',vertical:'middle'}; } ws.getCell('A1').font={bold:true,size:18,color:{argb:C.title}}; ws.getCell('A2').font={size:10,color:{argb:C.subtitle}}; ws.getRow(1).height=28; ws.getRow(2).height=22; }
function sectionBand(ws, row, text, end='H') { ws.mergeCells(`A${row}:${end}${row}`); const c=ws.getCell(`A${row}`); c.value=text; c.font={bold:true,size:11,color:{argb:C.goldText}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.gold}}; c.alignment={horizontal:'left',vertical:'middle'}; ws.getRow(row).height=24; }
function noteBand(ws, row, text, end='H') { ws.mergeCells(`A${row}:${end}${row}`); const c=ws.getCell(`A${row}`); c.value=text; c.font={italic:true,size:10,color:{argb:'6A5E51'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.note}}; c.alignment={horizontal:'left',vertical:'middle',wrapText:true}; c.border=borderAll(); ws.getRow(row).height=22; }
function tableHeader(ws, row, labels) { ws.getRow(row).values=labels; ws.getRow(row).eachCell((c)=>{ c.font={bold:true,color:{argb:'F4EFE7'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.black2}}; c.alignment={horizontal:'center',vertical:'middle',wrapText:true}; c.border=borderAll(); }); ws.getRow(row).height=26; }
function dataCell(cell, kind='plain') { cell.border=borderAll(); cell.alignment={horizontal:'left',vertical:'middle',wrapText:true}; if (kind==='label') { cell.font={bold:true,color:{argb:'4A4036'}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.label}}; } else if (kind==='input') { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.input}}; } else if (kind==='dark-total') { cell.font={bold:true,color:{argb:'F4EFE7'},size:11}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.black2}}; } else if (kind==='gold-total') { cell.font={bold:true,color:{argb:C.goldText},size:11}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:C.total}}; } }
function zebra(ws, fromRow, toRow, fromCol, toCol) { for (let r=fromRow;r<=toRow;r++) { for (let c=fromCol;c<=toCol;c++) { const cell=ws.getRow(r).getCell(c); if (!cell.fill || cell.fill.pattern==='none') cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r%2===0?'FCFBF8':C.white}}; if (!cell.border || !cell.border.top) cell.border=borderAll(); if (!cell.alignment) cell.alignment={horizontal:'left',vertical:'middle',wrapText:true}; } ws.getRow(r).height=Math.max(ws.getRow(r).height||0,24); } }

const CATALOG_ROWS = [
['0060001','MANO_OBRA','OBLIGATORIO','Sí','ZZ','Servicio de instalación estándar',393.75,'Factor por distancia'],
['0060002','MANO_OBRA','OBLIGATORIO','Sí','ZZ','Visita técnica e ingeniería',82.50,'Siempre incluida'],
['0060003','MANO_OBRA','OBLIGATORIO','Sí','ZZ','Transporte y herramientas',90.00,'Factor por distancia'],
['0060101','MATERIAL','OBLIGATORIO','Sí','UND','Tablero eléctrico 6p',123.00,'Siempre incluido'],
['0060102','MATERIAL','OBLIGATORIO','Sí','M','Cable 6mm',5.93,'Cable principal según distancia'],
['0060110','MATERIAL','OBLIGATORIO','Sí','M','Cable 10mm',10.05,'Cable principal según distancia'],
['0060111','MATERIAL','OBLIGATORIO','Sí','M','Cable 16mm',11.70,'Cable principal según distancia'],
['0060103','MATERIAL','OBLIGATORIO','Sí','M','Cable 4mm',4.20,'Cantidad = distancia × 1.1'],
['0060104','MATERIAL','OBLIGATORIO_REGLA','Sí','UND','Tubería PVC',18.52,'Solo si tubería = PVC'],
['0060105','MATERIAL','OBLIGATORIO_REGLA','Sí','UND','Tubería EMT 3m 3/4',13.13,'Solo si tubería = EMT'],
['0060106','MATERIAL','OBLIGATORIO','Sí','UND','Interruptor termomagnético',20.02,'Depende de instalación/cliente'],
['0060107','MATERIAL','OBLIGATORIO','Sí','UND','Interruptor diferencial',79.05,'Depende de tipo cliente'],
['0060108','MATERIAL','OBLIGATORIO_REGLA','Sí','UND','Accesorios EMT Conduit',2.63,'Solo si tubería = EMT'],
['0060109','MATERIAL','CONDICIONAL_REGLA','No','GL','Materiales obra civil',0.00,'40% de MO civil activa'],
['0070001','MANO_OBRA','CONDICIONAL','No','ZZ','Fuera de la ciudad',150.00,'Solo suma si técnico lo activa'],
['0070002','MANO_OBRA','CONDICIONAL','No','ZZ','Pedestal interior',412.50,'Solo suma si técnico lo activa'],
['0070003','MANO_OBRA','CONDICIONAL','No','ZZ','Pedestal exterior',1012.50,'Solo suma si técnico lo activa'],
['0070004','MANO_OBRA','CONDICIONAL','No','ZZ','Platina pared protección',0.08,'Solo suma si técnico lo activa'],
['0070005','MANO_OBRA','CONDICIONAL','No','ZZ','Caja de paso',22.50,'Solo suma si técnico lo activa'],
['0070006','MANO_OBRA','CONDICIONAL','No','ZZ','Caja de protección metálica con chapa',75.00,'Solo suma si técnico lo activa'],
['0070007','MANO_OBRA','CONDICIONAL','No','ZZ','Obra civil básica interior regata resane pintura',127.50,'Solo suma si técnico lo activa'],
['0070008','MANO_OBRA','CONDICIONAL','No','ZZ','Obra civil intermedia interior regata resane pintura',255.00,'Solo suma si técnico lo activa'],
['0070009','MANO_OBRA','CONDICIONAL','No','ML','Obra civil exterior excavación pasto metro lineal',150.00,'Solo suma si técnico lo activa'],
['0070010','MANO_OBRA','CONDICIONAL','No','ML','Obra civil exterior excavación adoquín',300.00,'Solo suma si técnico lo activa'],
['0070011','MANO_OBRA','CONDICIONAL','No','ZZ','Pase placa (perforado de pared)',37.50,'Solo suma si técnico lo activa'],
['0070012','MANO_OBRA','CONDICIONAL','No','ZZ','SSOMA',262.50,'Solo suma si técnico lo activa'],
['0070013','MATERIAL','CONDICIONAL','No','UND','Contómetro - Medidor de Energía Eléctrica',55.50,'Solo suma si técnico lo activa'],
['0070014','MATERIAL','CONDICIONAL','No','UND','Breaker engrapable 3x50A',140.02,'Solo suma si técnico lo activa'],
['0070015','MATERIAL','CONDICIONAL','No','UND','Breaker atornillable 3x50A',22.50,'Solo suma si técnico lo activa'],
['0070016','MATERIAL','CONDICIONAL','No','UND','Breaker de riel din 3x63A',195.00,'Solo suma si técnico lo activa'],
['0070017','MATERIAL','CONDICIONAL','No','UND','Breaker engrapable 1x50A',120.00,'Solo suma si técnico lo activa'],
['0070018','MATERIAL','CONDICIONAL','No','UND','Breaker de riel din 1x63A',195.00,'Solo suma si técnico lo activa'],
];

const CONDITIONALS = [
['0070001','MANO_OBRA','Fuera de la ciudad',{formula:'IF(B16="SI",1,0)',result:0},{formula:'IF(D23=1,1,0)',result:0},'Automático por ciudad'],
['0070002','MANO_OBRA','Pedestal interior',0,0,'Manual'],['0070003','MANO_OBRA','Pedestal exterior',0,0,'Manual'],['0070004','MANO_OBRA','Platina pared protección',0,0,'Manual'],['0070005','MANO_OBRA','Caja de paso',0,0,'Manual'],['0070006','MANO_OBRA','Caja de protección metálica con chapa',0,0,'Manual'],['0070007','MANO_OBRA','Obra civil básica interior regata resane pintura',0,0,'Manual'],['0070008','MANO_OBRA','Obra civil intermedia interior regata resane pintura',0,0,'Manual'],['0070009','MANO_OBRA','Obra civil exterior excavación pasto metro lineal',0,0,'Manual'],['0070010','MANO_OBRA','Obra civil exterior excavación adoquín',0,0,'Manual'],['0070011','MANO_OBRA','Pase placa (perforado de pared)',0,0,'Manual'],['0070012','MANO_OBRA','SSOMA',0,0,'Manual'],['0070013','MATERIAL','Contómetro - Medidor de Energía Eléctrica',0,0,'Manual'],['0070014','MATERIAL','Breaker engrapable 3x50A',0,0,'Manual'],['0070015','MATERIAL','Breaker atornillable 3x50A',0,0,'Manual'],['0070016','MATERIAL','Breaker de riel din 3x63A',0,0,'Manual'],['0070017','MATERIAL','Breaker engrapable 1x50A',0,0,'Manual'],['0070018','MATERIAL','Breaker de riel din 1x63A',0,0,'Manual'],
];

const BASE_ROWS = [
['MANO_OBRA','OBLIGATORIO',1,1,'ZZ','0060001','Servicio de instalación estándar','Factor por distancia'],
['MANO_OBRA','OBLIGATORIO',1,1,'ZZ','0060002','Visita técnica e ingeniería','Siempre incluida'],
['MANO_OBRA','OBLIGATORIO',1,1,'ZZ','0060003','Transporte y herramientas','Factor por distancia'],
['MATERIAL','OBLIGATORIO',1,1,'UND','0060101','Tablero eléctrico 6p','Siempre incluido'],
['MATERIAL','OBLIGATORIO',1,{formula:"'01_FORM_VISITA'!B11*1.1*2",result:22},'M','0060102','Cable principal según distancia','Distancia × 1.1 × 2 con calibre parametrizable'],
['MATERIAL','OBLIGATORIO',1,{formula:"'01_FORM_VISITA'!B11*1.1",result:11},'M','0060103','Cable 4mm','Distancia × 1.1'],
['MATERIAL','OBLIGATORIO_REGLA',{formula:"IF('01_FORM_VISITA'!B12=\"PVC\",1,0)",result:0},{formula:"IF(C15=1,ROUNDUP('01_FORM_VISITA'!B11/3,0),0)",result:0},'UND','0060104','Tubería PVC','Solo si tubería = PVC'],
['MATERIAL','OBLIGATORIO_REGLA',{formula:"IF('01_FORM_VISITA'!B12=\"EMT\",1,0)",result:1},{formula:"IF(C16=1,ROUNDUP('01_FORM_VISITA'!B11/3,0),0)",result:4},'UND','0060105','Tubería EMT 3m 3/4','Solo si tubería = EMT'],
['MATERIAL','OBLIGATORIO',1,1,'UND','0060106','Interruptor termomagnético','Depende de instalación/cliente'],
['MATERIAL','OBLIGATORIO',1,1,'UND','0060107','Interruptor diferencial','Depende de tipo cliente'],
['MATERIAL','OBLIGATORIO_REGLA',{formula:"IF('01_FORM_VISITA'!B12=\"EMT\",1,0)",result:1},{formula:"IF(C19=1,ROUNDUP('01_FORM_VISITA'!B11/3,0),0)",result:4},'UND','0060108','Accesorios EMT Conduit','Solo si tubería = EMT'],
];

const factorLookupFormula = (lookupExpr, distExpr, catalogCol) => `IF(${distExpr}<='00_PARAMETROS'!A6,VLOOKUP(${lookupExpr},'02_CATALOGO'!A:K,${catalogCol},FALSE)*'00_PARAMETROS'!B6,IF(${distExpr}<='00_PARAMETROS'!A7,VLOOKUP(${lookupExpr},'02_CATALOGO'!A:K,${catalogCol},FALSE)*'00_PARAMETROS'!B7,IF(${distExpr}<='00_PARAMETROS'!A8,VLOOKUP(${lookupExpr},'02_CATALOGO'!A:K,${catalogCol},FALSE)*'00_PARAMETROS'!B8,IF(${distExpr}<='00_PARAMETROS'!A9,VLOOKUP(${lookupExpr},'02_CATALOGO'!A:K,${catalogCol},FALSE)*'00_PARAMETROS'!B9,VLOOKUP(${lookupExpr},'02_CATALOGO'!A:K,${catalogCol},FALSE)*'00_PARAMETROS'!B10))))`;
const factorCostFormula = (row) => factorLookupFormula(`F${row}`,'$E$6',8);
const factorPriceFormula = (row) => factorLookupFormula(`F${row}`,'$E$6',10);
const cablePrincipalCodeByDistance = (distExpr) => `IF(${distExpr}<='00_PARAMETROS'!B17,"0060102",IF(${distExpr}<='00_PARAMETROS'!B18,"0060110","0060111"))`;
const cablePrincipalCodeFormula = (row) => cablePrincipalCodeByDistance('$E$6');
const cablePrincipalDescFormula = (row) => `IF($E$6<='00_PARAMETROS'!B17,"Cable 6mm",IF($E$6<='00_PARAMETROS'!B18,"Cable 10mm","Cable 16mm"))`;
const minimumIncludedMetersFormula = `IF(UPPER($B$7)="EDIFICIO",'00_PARAMETROS'!B25,'00_PARAMETROS'!B23)`;
const minimumBasePriceFormula = `IF(UPPER($B$7)="EDIFICIO",'00_PARAMETROS'!B26,'00_PARAMETROS'!B24)`;
const includedObligatoryNormalFormula = `${factorLookupFormula('"0060001"','$E$7',10)}+VLOOKUP("0060002",'02_CATALOGO'!A:K,10,FALSE)+${factorLookupFormula('"0060003"','$E$7',10)}+VLOOKUP("0060101",'02_CATALOGO'!A:K,10,FALSE)+(VLOOKUP(${cablePrincipalCodeByDistance('$E$7')},'02_CATALOGO'!A:K,10,FALSE)*($E$7*1.1*2))+(VLOOKUP("0060103",'02_CATALOGO'!A:K,10,FALSE)*($E$7*1.1))+IF($K$5="PVC",VLOOKUP("0060104",'02_CATALOGO'!A:K,10,FALSE)*ROUNDUP($E$7/3,0),0)+IF($K$5="EMT",VLOOKUP("0060105",'02_CATALOGO'!A:K,10,FALSE)*ROUNDUP($E$7/3,0),0)+VLOOKUP("0060106",'02_CATALOGO'!A:K,10,FALSE)+VLOOKUP("0060107",'02_CATALOGO'!A:K,10,FALSE)+IF($K$5="EMT",VLOOKUP("0060108",'02_CATALOGO'!A:K,10,FALSE)*ROUNDUP($E$7/3,0),0)`;

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator='OpenClaw'; wb.lastModifiedBy='OpenClaw'; wb.created=new Date(); wb.modified=new Date(); wb.calcProperties.fullCalcOnLoad = true;

  const p = wb.addWorksheet('00_PARAMETROS');
  p.columns = [{width:28},{width:16},{width:20},{width:18},{width:18},{width:18},{width:18},{width:18}];
  setPage(p); titleBlock(p,'Parámetros del cotizador','Aquí puedes cambiar factores, mínimos comerciales y límites sin tocar fórmulas.');
  sectionBand(p,4,'FACTORES POR DISTANCIA');
  tableHeader(p,5,['Rango hasta (m)','Factor','Nota','','','','','']);
  [[25,1,'0–25 m'],[30,1.5,'25–30 m'],[40,2,'30–40 m'],[50,3,'40–50 m'],['>50',3,'50+ editable']].forEach((row,i)=>{ const r=6+i; p.getCell(`A${r}`).value=row[0]; p.getCell(`B${r}`).value=row[1]; p.getCell(`C${r}`).value=row[2]; ['A','B','C'].forEach(col=>dataCell(p.getCell(`${col}${r}`), col==='B'?'input':'plain')); p.getRow(r).height=24; });
  sectionBand(p,12,'MARGEN Y COSTOS');
  p.getCell('A13').value='Divisor precio con margen'; dataCell(p.getCell('A13'),'label'); p.getCell('B13').value=0.75; dataCell(p.getCell('B13'),'input'); p.getCell('C13').value='Precio con margen = costo / este valor'; dataCell(p.getCell('C13')); pct(p.getCell('B13'));
  p.getCell('A14').value='Factor de costos'; dataCell(p.getCell('A14'),'label'); p.getCell('B14').value='Se movió a 02_CATALOGO'; dataCell(p.getCell('B14')); p.getCell('C14').value='Ahora el cotizador jala el costo ajustado desde el catálogo'; dataCell(p.getCell('C14'));
  sectionBand(p,16,'LÍMITES DE CALIBRES');
  p.getCell('A17').value='Distancia máxima 6mm'; dataCell(p.getCell('A17'),'label'); p.getCell('B17').value=25; dataCell(p.getCell('B17'),'input'); p.getCell('C17').value='Hasta este valor usa 6mm'; dataCell(p.getCell('C17'));
  p.getCell('A18').value='Distancia máxima 10mm'; dataCell(p.getCell('A18'),'label'); p.getCell('B18').value=40; dataCell(p.getCell('B18'),'input'); p.getCell('C18').value='Hasta este valor usa 10mm'; dataCell(p.getCell('C18'));
  p.getCell('A19').value='Calibre superior'; dataCell(p.getCell('A19'),'label'); p.getCell('B19').value='16mm'; dataCell(p.getCell('B19'),'input'); p.getCell('C19').value='Por encima del límite de 10mm'; dataCell(p.getCell('C19'));
  sectionBand(p,21,'MÍNIMOS COMERCIALES');
  p.getCell('A23').value='Casa · metros incluidos'; dataCell(p.getCell('A23'),'label'); p.getCell('B23').value=10; dataCell(p.getCell('B23'),'input'); p.getCell('C23').value='Distancia total incluida en el mínimo'; dataCell(p.getCell('C23'));
  p.getCell('A24').value='Casa · precio mínimo'; dataCell(p.getCell('A24'),'label'); p.getCell('B24').value=1499; dataCell(p.getCell('B24'),'input'); p.getCell('C24').value='Base comercial sin adicionales'; dataCell(p.getCell('C24')); money(p.getCell('B24'));
  p.getCell('A25').value='Edificio · metros incluidos'; dataCell(p.getCell('A25'),'label'); p.getCell('B25').value=20; dataCell(p.getCell('B25'),'input'); p.getCell('C25').value='Distancia total incluida en el mínimo'; dataCell(p.getCell('C25'));
  p.getCell('A26').value='Edificio · precio mínimo'; dataCell(p.getCell('A26'),'label'); p.getCell('B26').value=1799; dataCell(p.getCell('B26'),'input'); p.getCell('C26').value='Base comercial sin adicionales'; dataCell(p.getCell('C26')); money(p.getCell('B26'));

  const fv = wb.addWorksheet('01_FORM_VISITA');
  fv.columns = [{width:44},{width:34},{width:16},{width:14},{width:14},{width:20},{width:34},{width:18}];
  setPage(fv); titleBlock(fv,'Input de Visita Técnica','Hoja editable para datos base y activación de condicionales.');
  sectionBand(fv,5,'DATOS DEL CLIENTE');
  const labels = ['Cliente','Ciudad','Fecha visita','Tipo instalación','Tipo cliente','Distancia instalación (m)','Tipo tubería','Voltaje (V)','Corriente (A)','Puesta a tierra real (SI/NO)','Fuera de la ciudad (SI/NO)','Margen %','Observación técnica'];
  const values = ['Cliente demo','Lima',new Date('2026-04-29'),'Monofásico','B2C',10,'EMT',220,32,'NO','NO',0.25,'Completar con observación técnica validada.'];
  let r=6; for (let i=0;i<labels.length;i++) { fv.getCell(`A${r}`).value=labels[i]; dataCell(fv.getCell(`A${r}`),'label'); if (i<12) { fv.mergeCells(`B${r}:C${r}`); fv.getCell(`B${r}`).value=values[i]; dataCell(fv.getCell(`B${r}`),'input'); dataCell(fv.getCell(`C${r}`),'input'); } else { fv.mergeCells(`B${r}:H${r}`); fv.getCell(`B${r}`).value=values[i]; dataCell(fv.getCell(`B${r}`),'input'); } fv.getRow(r).height=i===12?36:24; r++; }
  fv.getCell('D10').value='Tipo inmueble comercial'; dataCell(fv.getCell('D10'),'label'); fv.mergeCells('E10:F10'); fv.getCell('E10').value='Casa'; dataCell(fv.getCell('E10'),'input'); dataCell(fv.getCell('F10'),'input');
  fv.getCell('G10').value='Modificable'; dataCell(fv.getCell('G10')); fv.getCell('H10').value='Casa / Edificio'; dataCell(fv.getCell('H10'));
  fv.getCell('B8').numFmt='yyyy-mm-dd'; pct(fv.getCell('B17'));
  sectionBand(fv,20,'CONDICIONALES ACTIVADOS POR TÉCNICO'); noteBand(fv,21,'Aquí solo defines activación y cantidad. Los precios se jalán desde CATÁLOGO.');
  tableHeader(fv,22,['Código','Sección','Descripción','Activo','Cantidad','Observación','','']);
  let rr=23; for (const row of CONDITIONALS) { fv.getCell(`A${rr}`).value=row[0]; fv.getCell(`B${rr}`).value=row[1]; fv.getCell(`C${rr}`).value=row[2]; fv.getCell(`D${rr}`).value=row[3]; fv.getCell(`E${rr}`).value=row[4]; fv.mergeCells(`F${rr}:H${rr}`); fv.getCell(`F${rr}`).value=row[5]; ['A','B','C','D','E','F','G','H'].forEach(col=>dataCell(fv.getCell(`${col}${rr}`))); qty(fv.getCell(`E${rr}`)); rr++; }
  zebra(fv,23,rr-1,1,8);

  const cat = wb.addWorksheet('02_CATALOGO');
  cat.columns = [{width:12},{width:18},{width:18},{width:10},{width:10},{width:38},{width:14},{width:14},{width:14},{width:16},{width:42}];
  setPage(cat); titleBlock(cat,'CATÁLOGO · Maestro único de precios','Edita COSTO BASE y el factor aquí; el cotizador jala el costo ajustado.','K');
  cat.getCell('G3').value='Factor general de costos'; dataCell(cat.getCell('G3'),'label'); cat.getCell('H3').value=1; dataCell(cat.getCell('H3'),'input'); cat.mergeCells('I3:K3'); cat.getCell('I3').value='Este factor vive en el catálogo y afecta el costo ajustado que consume el cotizador'; dataCell(cat.getCell('I3'));
  tableHeader(cat,4,['Código','Sección','Naturaleza','Etiqueta','Unidad','Descripción','Costo base','Costo ajustado','Margen','Precio con margen','Regla']);
  let cr=5; for (const row of CATALOG_ROWS) { const [code,sec,nat,et,un,desc,costo,regla]=row; [code,sec,nat,et,un,desc].forEach((v,i)=>{ cat.getCell(cr,i+1).value=v; dataCell(cat.getCell(cr,i+1)); }); cat.getCell(`G${cr}`).value=costo; dataCell(cat.getCell(`G${cr}`),'input'); cat.getCell(`H${cr}`).value={formula:`G${cr}*$H$3`,result:0}; dataCell(cat.getCell(`H${cr}`)); cat.getCell(`J${cr}`).value={formula:`IF(H${cr}=0,0,H${cr}/'00_PARAMETROS'!B13)`,result:0}; dataCell(cat.getCell(`J${cr}`)); cat.getCell(`I${cr}`).value={formula:`J${cr}-H${cr}`,result:0}; dataCell(cat.getCell(`I${cr}`)); cat.getCell(`K${cr}`).value=regla; dataCell(cat.getCell(`K${cr}`)); ['G','H','I','J'].forEach(col=>money(cat.getCell(`${col}${cr}`))); cr++; }
  zebra(cat,5,cr-1,1,11);

  const cot = wb.addWorksheet('03_COTIZADOR');
  cot.columns = [{width:14},{width:16},{width:9},{width:11},{width:9},{width:12},{width:34},{width:14},{width:14},{width:16},{width:16},{width:22}];
  setPage(cot); titleBlock(cot,'Cálculo de Cotización','El cotizador jala costos ajustados del catálogo, aplica factores/calibres y ahora suma una capa comercial modular.','L'); noteBand(cot,4,'Servicio estándar y Transporte usan factor por distancia. El cable principal usa 6/10/16mm según límites. Además, la cotización comercial puede usar mínimo Casa/Edificio + metraje adicional según parámetros.','L');
  cot.getCell('A5').value='Cliente'; dataCell(cot.getCell('A5'),'label'); cot.mergeCells('B5:C5'); cot.getCell('B5').value={formula:`'01_FORM_VISITA'!B6`,result:'Cliente demo'}; dataCell(cot.getCell('B5'),'input');
  cot.getCell('D5').value='Fecha'; dataCell(cot.getCell('D5'),'label'); cot.mergeCells('E5:F5'); cot.getCell('E5').value={formula:`'01_FORM_VISITA'!B8`,result:new Date('2026-04-29')}; dataCell(cot.getCell('E5'),'input'); cot.getCell('E5').numFmt='yyyy-mm-dd';
  cot.getCell('G5').value='Tipo instalación'; dataCell(cot.getCell('G5'),'label'); cot.mergeCells('H5:I5'); cot.getCell('H5').value={formula:`'01_FORM_VISITA'!B9`,result:'Monofásico'}; dataCell(cot.getCell('H5'),'input');
  cot.getCell('J5').value='Tipo tubería'; dataCell(cot.getCell('J5'),'label'); cot.mergeCells('K5:L5'); cot.getCell('K5').value={formula:`'01_FORM_VISITA'!B12`,result:'EMT'}; dataCell(cot.getCell('K5'),'input');
  cot.getCell('A6').value='Tipo cliente'; dataCell(cot.getCell('A6'),'label'); cot.mergeCells('B6:C6'); cot.getCell('B6').value={formula:`'01_FORM_VISITA'!B10`,result:'B2C'}; dataCell(cot.getCell('B6'),'input');
  cot.getCell('D6').value='Distancia'; dataCell(cot.getCell('D6'),'label'); cot.mergeCells('E6:F6'); cot.getCell('E6').value={formula:`'01_FORM_VISITA'!B11`,result:10}; dataCell(cot.getCell('E6'),'input');
  cot.getCell('A7').value='Tipo inmueble'; dataCell(cot.getCell('A7'),'label'); cot.mergeCells('B7:C7'); cot.getCell('B7').value={formula:`'01_FORM_VISITA'!E10`,result:'Casa'}; dataCell(cot.getCell('B7'),'input');
  cot.getCell('D7').value='Metros incluidos'; dataCell(cot.getCell('D7'),'label'); cot.mergeCells('E7:F7'); cot.getCell('E7').value={formula:minimumIncludedMetersFormula,result:10}; dataCell(cot.getCell('E7'),'input');
  cot.getCell('G7').value='Metros excedentes'; dataCell(cot.getCell('G7'),'label'); cot.mergeCells('H7:I7'); cot.getCell('H7').value={formula:'MAX(E6-E7,0)',result:0}; dataCell(cot.getCell('H7'),'input');
  cot.getCell('J7').value='Metraje adicional'; dataCell(cot.getCell('J7'),'label'); cot.mergeCells('K7:L7'); cot.getCell('K7').value={formula:`MAX(SUM(K9:K19)-(${includedObligatoryNormalFormula}),0)`,result:0}; dataCell(cot.getCell('K7'),'input'); money(cot.getCell('K7'));
  tableHeader(cot,8,['Sección','Naturaleza','Activo','Cantidad','Unidad','Código','Descripción','Costo','Margen','Precio con margen','Total','Regla']);

  let dr=9; for (const row of BASE_ROWS) { const [sec,nat,act,qv,un,code,desc,rule]=row; [sec,nat,act,qv,un,code,desc].forEach((v,i)=>{ cot.getCell(dr,i+1).value=v; dataCell(cot.getCell(dr,i+1)); }); if (dr===13) { cot.getCell(`F${dr}`).value={formula:cablePrincipalCodeFormula(dr),result:'0060102'}; dataCell(cot.getCell(`F${dr}`)); cot.getCell(`G${dr}`).value={formula:cablePrincipalDescFormula(dr),result:'Cable 6mm'}; dataCell(cot.getCell(`G${dr}`)); cot.getCell(`H${dr}`).value={formula:`VLOOKUP(F${dr},'02_CATALOGO'!A:K,8,FALSE)`,result:0}; cot.getCell(`J${dr}`).value={formula:`VLOOKUP(F${dr},'02_CATALOGO'!A:K,10,FALSE)`,result:0}; cot.getCell(`I${dr}`).value={formula:`J${dr}-H${dr}`,result:0}; } else if (code==='0060001' || code==='0060003') { cot.getCell(`H${dr}`).value={formula:factorCostFormula(dr),result:0}; cot.getCell(`J${dr}`).value={formula:factorPriceFormula(dr),result:0}; cot.getCell(`I${dr}`).value={formula:`J${dr}-H${dr}`,result:0}; } else { cot.getCell(`H${dr}`).value={formula:`VLOOKUP(F${dr},'02_CATALOGO'!A:K,8,FALSE)`,result:0}; cot.getCell(`J${dr}`).value={formula:`VLOOKUP(F${dr},'02_CATALOGO'!A:K,10,FALSE)`,result:0}; cot.getCell(`I${dr}`).value={formula:`J${dr}-H${dr}`,result:0}; } cot.getCell(`K${dr}`).value={formula:`C${dr}*D${dr}*J${dr}`,result:0}; cot.getCell(`L${dr}`).value=rule; dataCell(cot.getCell(`L${dr}`)); ['H','I','J','K'].forEach(col=>{ dataCell(cot.getCell(`${col}${dr}`)); money(cot.getCell(`${col}${dr}`)); }); qty(cot.getCell(`D${dr}`)); dr++; }

  const units = ['ZZ','ZZ','ZZ','ZZ','ZZ','ZZ','ZZ','ZZ','ML','ML','ZZ','ZZ','UND','UND','UND','UND','UND','UND'];
  for (let i=0;i<18;i++) { const fr=23+i; const tr=20+i; cot.getCell(`A${tr}`).value=i<12?'MANO_OBRA':'MATERIAL'; dataCell(cot.getCell(`A${tr}`)); cot.getCell(`B${tr}`).value='CONDICIONAL'; dataCell(cot.getCell(`B${tr}`)); cot.getCell(`C${tr}`).value={formula:`'01_FORM_VISITA'!D${fr}`,result:0}; dataCell(cot.getCell(`C${tr}`)); cot.getCell(`D${tr}`).value={formula:`IF(C${tr}=1,'01_FORM_VISITA'!E${fr},0)`,result:0}; dataCell(cot.getCell(`D${tr}`)); cot.getCell(`E${tr}`).value=units[i]; dataCell(cot.getCell(`E${tr}`)); cot.getCell(`F${tr}`).value={formula:`'01_FORM_VISITA'!A${fr}`,result:''}; dataCell(cot.getCell(`F${tr}`)); cot.getCell(`G${tr}`).value={formula:`'01_FORM_VISITA'!C${fr}`,result:''}; dataCell(cot.getCell(`G${tr}`)); cot.getCell(`H${tr}`).value={formula:`IFERROR(VLOOKUP(F${tr},'02_CATALOGO'!A:K,8,FALSE),0)`,result:0}; cot.getCell(`J${tr}`).value={formula:`IFERROR(VLOOKUP(F${tr},'02_CATALOGO'!A:K,10,FALSE),0)`,result:0}; cot.getCell(`I${tr}`).value={formula:`J${tr}-H${tr}`,result:0}; cot.getCell(`K${tr}`).value={formula:`C${tr}*D${tr}*J${tr}`,result:0}; cot.getCell(`L${tr}`).value='Solo suma si técnico lo activa'; dataCell(cot.getCell(`L${tr}`)); ['H','I','J','K'].forEach(col=>{ dataCell(cot.getCell(`${col}${tr}`)); money(cot.getCell(`${col}${tr}`)); }); qty(cot.getCell(`D${tr}`)); }

  cot.getCell('A38').value='MATERIAL'; dataCell(cot.getCell('A38')); cot.getCell('B38').value='CONDICIONAL_REGLA'; dataCell(cot.getCell('B38')); cot.getCell('C38').value={formula:'IF(SUM(K26:K29)>0,1,0)',result:0}; dataCell(cot.getCell('C38')); cot.getCell('D38').value=1; dataCell(cot.getCell('D38')); cot.getCell('E38').value='GL'; dataCell(cot.getCell('E38')); cot.getCell('F38').value='0060109'; dataCell(cot.getCell('F38')); cot.getCell('G38').value='Materiales obra civil'; dataCell(cot.getCell('G38')); cot.getCell('J38').value={formula:'ROUND(SUM(K26:K29)*0.4,2)',result:0}; cot.getCell('H38').value={formula:`J38*'02_CATALOGO'!$H$3`,result:0}; cot.getCell('I38').value={formula:'J38-H38',result:0}; cot.getCell('K38').value={formula:'C38*D38*J38',result:0}; cot.getCell('L38').value='40% de MO civil activa'; dataCell(cot.getCell('L38')); ['H','I','J','K'].forEach(col=>{ dataCell(cot.getCell(`${col}38`)); money(cot.getCell(`${col}38`)); });
  zebra(cot,9,38,1,12);

  cot.getCell('H40').value='TOTAL MANO DE OBRA'; dataCell(cot.getCell('H40'),'dark-total'); cot.getCell('K40').value={formula:'SUM(K9:K11)+SUM(K20:K31)',result:0}; dataCell(cot.getCell('K40'),'dark-total'); money(cot.getCell('K40'));
  cot.getCell('H41').value='TOTAL MATERIALES'; dataCell(cot.getCell('H41'),'dark-total'); cot.getCell('K41').value={formula:'SUM(K12:K19)+SUM(K32:K38)',result:0}; dataCell(cot.getCell('K41'),'dark-total'); money(cot.getCell('K41'));
  cot.getCell('H42').value='TOTAL NORMAL'; dataCell(cot.getCell('H42'),'gold-total'); cot.getCell('K42').value={formula:'K40+K41',result:0}; dataCell(cot.getCell('K42'),'gold-total'); money(cot.getCell('K42'));
  cot.getCell('H44').value='TOTAL COSTO'; dataCell(cot.getCell('H44'),'gold-total'); cot.getCell('K44').value={formula:'SUMPRODUCT(C9:C38,D9:D38,H9:H38)',result:0}; dataCell(cot.getCell('K44'),'gold-total'); money(cot.getCell('K44'));
  cot.getCell('H45').value='TOTAL MARGEN'; dataCell(cot.getCell('H45'),'gold-total'); cot.getCell('K45').value={formula:'SUMPRODUCT(C9:C38,D9:D38,I9:I38)',result:0}; dataCell(cot.getCell('K45'),'gold-total'); money(cot.getCell('K45'));
  cot.getCell('H46').value='TOTAL PRECIO CON MARGEN'; dataCell(cot.getCell('H46'),'gold-total'); cot.getCell('K46').value={formula:'SUMPRODUCT(C9:C38,D9:D38,J9:J38)',result:0}; dataCell(cot.getCell('K46'),'gold-total'); money(cot.getCell('K46'));
  cot.getCell('H48').value='BASE OBLIGATORIA NORMAL'; dataCell(cot.getCell('H48'),'dark-total'); cot.getCell('K48').value={formula:'SUM(K9:K19)',result:0}; dataCell(cot.getCell('K48'),'dark-total'); money(cot.getCell('K48'));
  cot.getCell('H49').value='TOTAL CONDICIONALES'; dataCell(cot.getCell('H49'),'dark-total'); cot.getCell('K49').value={formula:'SUM(K20:K38)',result:0}; dataCell(cot.getCell('K49'),'dark-total'); money(cot.getCell('K49'));
  cot.getCell('H50').value='MÍNIMO BASE'; dataCell(cot.getCell('H50'),'gold-total'); cot.getCell('K50').value={formula:minimumBasePriceFormula,result:1499}; dataCell(cot.getCell('K50'),'gold-total'); money(cot.getCell('K50'));
  cot.getCell('H51').value='METRAJE ADICIONAL'; dataCell(cot.getCell('H51'),'gold-total'); cot.getCell('K51').value={formula:`MAX(K48-(${includedObligatoryNormalFormula}),0)`,result:0}; dataCell(cot.getCell('K51'),'gold-total'); money(cot.getCell('K51'));
  cot.getCell('H52').value='TOTAL COMERCIAL FINAL'; dataCell(cot.getCell('H52'),'gold-total'); cot.getCell('K52').value={formula:'K50+K51+K49',result:1499}; dataCell(cot.getCell('K52'),'gold-total'); money(cot.getCell('K52'));

  for (const ws of [p,fv,cat,cot]) ws.eachRow((row)=>{ if (!row.height) row.height=22; });
  await wb.xlsx.writeFile(OUTPUT_PATH);
  return OUTPUT_PATH;
}

async function uploadToSupabase(localPath) {
  const base = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const body = await fs.readFile(localPath);
  const res = await fetch(`${base}/storage/v1/object/${STORAGE_BUCKET}/${STORAGE_OBJECT}`, { method:'POST', headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'x-upsert':'true' }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload Supabase falló: ${res.status} ${res.statusText} :: ${text}`);
  return { bucket: STORAGE_BUCKET, object: STORAGE_OBJECT, raw: text };
}

const localPath = await buildWorkbook();
const upload = await uploadToSupabase(localPath);
console.log(JSON.stringify({ localPath, ...upload }, null, 2));
