from __future__ import annotations
import zipfile
from pathlib import Path
from datetime import datetime, timezone
from xml.sax.saxutils import escape
import re

OUT = Path('/root/.openclaw/workspace/Cotizador_EVINKA_validacion_v1.xlsx')

NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
NS_DC = 'http://purl.org/dc/elements/1.1/'
NS_CP = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'
NS_DCT = 'http://purl.org/dc/terms/'
NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance'


def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n


def coord_key(coord: str):
    m = re.match(r'([A-Z]+)(\d+)$', coord)
    if not m:
        raise ValueError(f'Bad coord: {coord}')
    return int(m.group(2)), col_to_num(m.group(1))


class Sheet:
    def __init__(self, name: str):
        self.name = name
        self.cells: dict[str, dict] = {}

    def s(self, coord: str, text: str):
        self.cells[coord] = {'kind': 'str', 'value': text}

    def n(self, coord: str, number):
        self.cells[coord] = {'kind': 'num', 'value': number}

    def f(self, coord: str, formula: str, value=0, string: bool = False):
        self.cells[coord] = {'kind': 'fstr' if string else 'fnum', 'formula': formula, 'value': value}

    def render(self) -> str:
        by_row: dict[int, list[tuple[int, str, dict]]] = {}
        max_row = 1
        max_col = 1
        for coord, data in self.cells.items():
            row, col = coord_key(coord)
            by_row.setdefault(row, []).append((col, coord, data))
            max_row = max(max_row, row)
            max_col = max(max_col, col)
        rows_xml = []
        for row_num in sorted(by_row):
            cells_xml = []
            for _, coord, data in sorted(by_row[row_num]):
                kind = data['kind']
                if kind == 'str':
                    cells_xml.append(
                        f'<c r="{coord}" t="inlineStr"><is><t>{escape(str(data["value"]))}</t></is></c>'
                    )
                elif kind == 'num':
                    cells_xml.append(f'<c r="{coord}"><v>{data["value"]}</v></c>')
                elif kind == 'fnum':
                    cells_xml.append(
                        f'<c r="{coord}"><f>{escape(data["formula"])}</f><v>{data["value"]}</v></c>'
                    )
                elif kind == 'fstr':
                    cells_xml.append(
                        f'<c r="{coord}" t="str"><f>{escape(data["formula"])}</f><v>{escape(str(data["value"]))}</v></c>'
                    )
            rows_xml.append(f'<row r="{row_num}">{"".join(cells_xml)}</row>')
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<worksheet xmlns="{NS_MAIN}">'
            f'<dimension ref="A1:Z{max_row}"/>'
            '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
            '<sheetFormatPr defaultRowHeight="15"/>'
            f'<sheetData>{"".join(rows_xml)}</sheetData>'
            '</worksheet>'
        )


def content_types_xml(sheet_count: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for i in range(1, sheet_count + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Types xmlns="{NS_CT}">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        + ''.join(overrides) +
        '</Types>'
    )


def root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{NS_PKG_REL}">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = ''.join(
        f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>'
        for i, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<workbook xmlns="{NS_MAIN}" xmlns:r="{NS_REL}">'
        '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews>'
        f'<sheets>{sheets}</sheets>'
        '<calcPr calcId="191029" fullCalcOnLoad="1"/>'
        '</workbook>'
    )


def workbook_rels_xml(sheet_count: int) -> str:
    rels = []
    for i in range(1, sheet_count + 1):
        rels.append(
            f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
        )
    rels.append('<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<Relationships xmlns="{NS_PKG_REL}">{"".join(rels)}</Relationships>'
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<styleSheet xmlns="{NS_MAIN}">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )


def app_xml(sheet_names: list[str]) -> str:
    titles = ''.join(f'<vt:lpstr>{escape(name)}</vt:lpstr>' for name in sheet_names)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>OpenClaw</Application>'
        f'<TitlesOfParts><vt:vector size="{len(sheet_names)}" baseType="lpstr">{titles}</vt:vector></TitlesOfParts>'
        f'<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(sheet_names)}</vt:i4></vt:variant></vt:vector></HeadingPairs>'
        '</Properties>'
    )


def core_xml() -> str:
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<cp:coreProperties xmlns:cp="{NS_CP}" xmlns:dc="{NS_DC}" xmlns:dcterms="{NS_DCT}" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="{NS_XSI}">'
        '<dc:creator>OpenClaw</dc:creator>'
        '<cp:lastModifiedBy>OpenClaw</cp:lastModifiedBy>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        '</cp:coreProperties>'
    )


resumen = Sheet('RESUMEN')
resumen.s('A1', 'EVINKA - Excel de validación de lógica del cotizador')
resumen.s('A3', 'Objetivo')
resumen.s('B3', 'Validar estructura antes de llevarla a código.')
resumen.s('A5', 'Cómo usarlo')
resumen.s('B5', '1) Completa FORM_VISITA. 2) Marca solo los condicionales que apliquen. 3) Revisa COTIZADOR.')
resumen.s('A7', 'Reglas planteadas')
resumen.s('B7', 'Los ítems obligatorios siempre aparecen en la cotización.')
resumen.s('B8', 'Los ítems condicionales solo suman si el técnico los activa en FORM_VISITA.')
resumen.s('B9', 'La mano de obra y el transporte usan factor por distancia.')
resumen.s('B10', 'La tubería se calcula según distancia y tipo de tubería.')
resumen.s('B11', 'Los breakers e ítems especiales quedan como condicionales seleccionables.')
resumen.s('A13', 'Pendiente de tu validación')
resumen.s('B13', 'Confirmar precios base, nombres finales, factores de distancia y qué materiales son obligatorios vs. condicionales.')

form = Sheet('FORM_VISITA')
form.s('A1', 'FORM_VISITA - datos base y condicionales')
inputs = [
    ('A3', 'Cliente', 'B3', 'Cliente demo'),
    ('A4', 'Ciudad', 'B4', 'Lima'),
    ('A5', 'Fecha visita', 'B5', '2026-04-29'),
    ('A6', 'Tipo instalación', 'B6', 'Monofásico'),
    ('A7', 'Tipo cliente', 'B7', 'B2C'),
    ('A8', 'Distancia acometida (m)', 'B8', 35),
    ('A9', 'Tipo tubería', 'B9', 'EMT'),
    ('A10', 'Voltaje (V)', 'B10', 220),
    ('A11', 'Corriente (A)', 'B11', 32),
    ('A12', 'Existe puesta a tierra real', 'B12', 'NO'),
    ('A13', 'Fuera de la ciudad', 'B13', 'NO'),
    ('A14', 'IGV', 'B14', 0.18),
    ('A15', 'Observación técnica', 'B15', 'Completar aquí la observación final validada por EVINKA.'),
]
for l1, t1, l2, v in inputs:
    form.s(l1, t1)
    if isinstance(v, (int, float)):
        form.n(l2, v)
    else:
        form.s(l2, v)

form.s('A18', 'Condicionales a marcar por el técnico')
for c, text in [('A19','Código'),('B19','Sección'),('C19','Descripción'),('D19','Activar (0/1)'),('E19','Cantidad'),('F19','Precio ref.'),('G19','Observación')]:
    form.s(c, text)

cond_items = [
    ('0070001','MANO_OBRA','Fuera de la ciudad', ('fnum','=IF(B13="SI",1,0)',0), ('fnum','=IF(D20=1,1,0)',0), 200, 'Se activa automáticamente si B13 = SI'),
    ('0070002','MANO_OBRA','Pedestal interior', 0, 0, 550, 'Manual por técnico'),
    ('0070003','MANO_OBRA','Pedestal exterior', 0, 0, 1350, 'Manual por técnico'),
    ('0070004','MANO_OBRA','Platina pared protección', 0, 0, 0.1, 'Pendiente validar precio final'),
    ('0070005','MANO_OBRA','Caja de paso', 0, 0, 30, 'Manual por técnico'),
    ('0070006','MANO_OBRA','Caja de protección metálica con chapa', 0, 0, 100, 'Manual por técnico'),
    ('0070007','MANO_OBRA','Obra civil básica interior regata resane pintura', 0, 0, 170, 'Manual por técnico'),
    ('0070008','MANO_OBRA','Obra civil intermedia interior regata resane pintura', 0, 0, 340, 'Manual por técnico'),
    ('0070009','MANO_OBRA','Obra civil exterior excavación pasto metro lineal', 0, 0, 200, 'Manual por técnico'),
    ('0070010','MANO_OBRA','Obra civil exterior excavación adoquín', 0, 0, 400, 'Manual por técnico'),
    ('0070011','MANO_OBRA','Pase placa (perforado de pared)', 0, 0, 50, 'Manual por técnico'),
    ('0070012','MANO_OBRA','SSOMA', 0, 0, 350, 'Manual por técnico'),
    ('0070013','MATERIAL','Contómetro - Medidor de Energía Eléctrica', 0, 0, 74, 'Manual por técnico'),
    ('0070014','MATERIAL','Breaker engrapable 3x50A', 0, 0, 186.7, 'Cambio según evaluación técnica'),
    ('0070015','MATERIAL','Breaker atornillable 3x50A', 0, 0, 30, 'Cambio según evaluación técnica'),
    ('0070016','MATERIAL','Breaker de riel din 3x63A', 0, 0, 260, 'Cambio según evaluación técnica'),
    ('0070017','MATERIAL','Breaker engrapable 1x50A', 0, 0, 160, 'Cambio según evaluación técnica'),
    ('0070018','MATERIAL','Breaker de riel din 1x63A', 0, 0, 260, 'Cambio según evaluación técnica'),
]
start_row = 20
for idx, item in enumerate(cond_items, start=start_row):
    code, section, desc, activar, cantidad, precio, obs = item
    form.s(f'A{idx}', code)
    form.s(f'B{idx}', section)
    form.s(f'C{idx}', desc)
    if isinstance(activar, tuple):
        _, formula, value = activar
        form.f(f'D{idx}', formula.lstrip('='), value)
    else:
        form.n(f'D{idx}', activar)
    if isinstance(cantidad, tuple):
        _, formula, value = cantidad
        form.f(f'E{idx}', formula.lstrip('='), value)
    else:
        form.n(f'E{idx}', cantidad)
    form.n(f'F{idx}', precio)
    form.s(f'G{idx}', obs)

catalogo = Sheet('CATALOGO')
for c, text in [('A1','Código'),('B1','Sección'),('C1','Naturaleza'),('D1','Descripción'),('E1','Unidad'),('F1','Precio base'),('G1','Regla base')]:
    catalogo.s(c, text)

catalog_rows = [
    ('0060001','MANO_OBRA','OBLIGATORIO','Servicio de instalación estándar','ZZ',525,'Factor por distancia: 1 / 1.4 / 2 / 3'),
    ('0060002','MANO_OBRA','OBLIGATORIO','Visita técnica e ingeniería','ZZ',110,'Siempre 1 unidad'),
    ('0060003','MANO_OBRA','OBLIGATORIO','Transporte y herramientas','ZZ',120,'Factor por distancia: 1 / 1.3 / 2 / 3'),
    ('0060101','MATERIAL','OBLIGATORIO','Tablero eléctrico 6p','UND',164,'Siempre 1 unidad'),
    ('0060102','MATERIAL','OBLIGATORIO','Cable de fuerza principal','M',7.9,'Monofásico: distancia*2; Trifásico: distancia*4'),
    ('0060103','MATERIAL','CONDICIONAL_REGLA','Conductor de tierra','M',5.6,'Solo si no existe puesta a tierra real'),
    ('0060104','MATERIAL','OBLIGATORIO_REGLA','Tubería PVC','UND',24.7,'Si tipo tubería = PVC, redondeado cada 3 m'),
    ('0060105','MATERIAL','OBLIGATORIO_REGLA','Tubería EMT 3m 3/4','UND',17.5,'Si tipo tubería = EMT, redondeado cada 3 m'),
    ('0060106','MATERIAL','OBLIGATORIO','Interruptor termomagnético','UND',26.7,'Depende de tipo instalación y cliente'),
    ('0060107','MATERIAL','OBLIGATORIO','Interruptor diferencial','UND',105.4,'Depende de tipo cliente'),
    ('0060108','MATERIAL','OBLIGATORIO_REGLA','Accesorios EMT Conduit','UND',3.5,'Solo si tipo tubería = EMT'),
    ('0060109','MATERIAL','CONDICIONAL_REGLA','Materiales obra civil','GL',0,'40% de la mano de obra condicional de obra civil'),
    ('0070001','MANO_OBRA','CONDICIONAL','Fuera de la ciudad','ZZ',200,'Marcado por técnico / fuera ciudad'),
    ('0070002','MANO_OBRA','CONDICIONAL','Pedestal interior','ZZ',550,'Marcado por técnico'),
    ('0070003','MANO_OBRA','CONDICIONAL','Pedestal exterior','ZZ',1350,'Marcado por técnico'),
    ('0070004','MANO_OBRA','CONDICIONAL','Platina pared protección','ZZ',0.1,'Pendiente validar precio'),
    ('0070005','MANO_OBRA','CONDICIONAL','Caja de paso','ZZ',30,'Marcado por técnico'),
    ('0070006','MANO_OBRA','CONDICIONAL','Caja de protección metálica con chapa','ZZ',100,'Marcado por técnico'),
    ('0070007','MANO_OBRA','CONDICIONAL','Obra civil básica interior regata resane pintura','ZZ',170,'Marcado por técnico'),
    ('0070008','MANO_OBRA','CONDICIONAL','Obra civil intermedia interior regata resane pintura','ZZ',340,'Marcado por técnico'),
    ('0070009','MANO_OBRA','CONDICIONAL','Obra civil exterior excavación pasto metro lineal','ML',200,'Marcado por técnico'),
    ('0070010','MANO_OBRA','CONDICIONAL','Obra civil exterior excavación adoquín','ML',400,'Marcado por técnico'),
    ('0070011','MANO_OBRA','CONDICIONAL','Pase placa (perforado de pared)','ZZ',50,'Marcado por técnico'),
    ('0070012','MANO_OBRA','CONDICIONAL','SSOMA','ZZ',350,'Marcado por técnico'),
    ('0070013','MATERIAL','CONDICIONAL','Contómetro - Medidor de Energía Eléctrica','UND',74,'Marcado por técnico'),
    ('0070014','MATERIAL','CONDICIONAL','Breaker engrapable 3x50A','UND',186.7,'Marcado por técnico'),
    ('0070015','MATERIAL','CONDICIONAL','Breaker atornillable 3x50A','UND',30,'Marcado por técnico'),
    ('0070016','MATERIAL','CONDICIONAL','Breaker de riel din 3x63A','UND',260,'Marcado por técnico'),
    ('0070017','MATERIAL','CONDICIONAL','Breaker engrapable 1x50A','UND',160,'Marcado por técnico'),
    ('0070018','MATERIAL','CONDICIONAL','Breaker de riel din 1x63A','UND',260,'Marcado por técnico'),
]
for r, row in enumerate(catalog_rows, start=2):
    catalogo.s(f'A{r}', row[0])
    catalogo.s(f'B{r}', row[1])
    catalogo.s(f'C{r}', row[2])
    catalogo.s(f'D{r}', row[3])
    catalogo.s(f'E{r}', row[4])
    catalogo.n(f'F{r}', row[5])
    catalogo.s(f'G{r}', row[6])

cot = Sheet('COTIZADOR')
cot.s('A1', 'COTIZADOR - borrador para validación')
cot.s('A3', 'Cliente')
cot.f('B3', 'FORM_VISITA!B3', '', string=True)
cot.s('A4', 'Tipo instalación')
cot.f('B4', 'FORM_VISITA!B6', '', string=True)
cot.s('A5', 'Tipo cliente')
cot.f('B5', 'FORM_VISITA!B7', '', string=True)
cot.s('A6', 'Distancia (m)')
cot.f('B6', 'FORM_VISITA!B8', 0)
cot.s('A7', 'Tipo tubería')
cot.f('B7', 'FORM_VISITA!B9', '', string=True)
headers = [('A10','Sección'),('B10','Naturaleza'),('C10','Activo'),('D10','Cantidad'),('E10','Unidad'),('F10','Código'),('G10','Descripción'),('H10','Precio Unitario'),('I10','Total'),('J10','Regla')]
for c,t in headers:
    cot.s(c,t)

# obligatorios
cot.s('A11','MANO_OBRA'); cot.s('B11','OBLIGATORIO'); cot.n('C11',1); cot.n('D11',1); cot.s('E11','ZZ'); cot.s('F11','0060001'); cot.s('G11','Servicio de instalación estándar'); cot.f('H11','IF(FORM_VISITA!B8<25,525,IF(FORM_VISITA!B8<40,525*1.4,IF(FORM_VISITA!B8<50,525*2,525*3)))',0); cot.f('I11','C11*D11*H11',0); cot.s('J11','Factor distancia')
cot.s('A12','MANO_OBRA'); cot.s('B12','OBLIGATORIO'); cot.n('C12',1); cot.n('D12',1); cot.s('E12','ZZ'); cot.s('F12','0060002'); cot.s('G12','Visita técnica e ingeniería'); cot.n('H12',110); cot.f('I12','C12*D12*H12',0); cot.s('J12','Siempre incluida')
cot.s('A13','MANO_OBRA'); cot.s('B13','OBLIGATORIO'); cot.n('C13',1); cot.n('D13',1); cot.s('E13','ZZ'); cot.s('F13','0060003'); cot.s('G13','Transporte y herramientas'); cot.f('H13','IF(FORM_VISITA!B8<25,120,IF(FORM_VISITA!B8<40,120*1.3,IF(FORM_VISITA!B8<50,120*2,120*3)))',0); cot.f('I13','C13*D13*H13',0); cot.s('J13','Factor distancia')

cot.s('A14','MATERIAL'); cot.s('B14','OBLIGATORIO'); cot.n('C14',1); cot.n('D14',1); cot.s('E14','UND'); cot.s('F14','0060101'); cot.s('G14','Tablero eléctrico 6p'); cot.n('H14',164); cot.f('I14','C14*D14*H14',0); cot.s('J14','Siempre incluido')
cot.s('A15','MATERIAL'); cot.s('B15','OBLIGATORIO'); cot.n('C15',1); cot.f('D15','IF(FORM_VISITA!B6="Trifásico",FORM_VISITA!B8*4,FORM_VISITA!B8*2)',0); cot.s('E15','M'); cot.s('F15','0060102'); cot.s('G15','Cable de fuerza principal'); cot.f('H15','IF(FORM_VISITA!B6="Trifásico",IF(FORM_VISITA!B8>40,13.4,10),IF(FORM_VISITA!B8>40,13.4,7.9))',0); cot.f('I15','C15*D15*H15',0); cot.s('J15','Depende de instalación y distancia')
cot.s('A16','MATERIAL'); cot.s('B16','CONDICIONAL_REGLA'); cot.f('C16','IF(FORM_VISITA!B12="SI",0,1)',0); cot.f('D16','IF(C16=1,FORM_VISITA!B8,0)',0); cot.s('E16','M'); cot.s('F16','0060103'); cot.s('G16','Conductor de tierra'); cot.f('H16','IF(FORM_VISITA!B8>40,7.9,5.6)',0); cot.f('I16','C16*D16*H16',0); cot.s('J16','Solo si no existe puesta a tierra real')
cot.s('A17','MATERIAL'); cot.s('B17','OBLIGATORIO_REGLA'); cot.f('C17','IF(FORM_VISITA!B9="PVC",1,0)',0); cot.f('D17','IF(C17=1,ROUNDUP(FORM_VISITA!B8/3,0),0)',0); cot.s('E17','UND'); cot.s('F17','0060104'); cot.s('G17','Tubería PVC'); cot.n('H17',24.7); cot.f('I17','C17*D17*H17',0); cot.s('J17','Solo si tipo tubería = PVC')
cot.s('A18','MATERIAL'); cot.s('B18','OBLIGATORIO_REGLA'); cot.f('C18','IF(FORM_VISITA!B9="EMT",1,0)',0); cot.f('D18','IF(C18=1,ROUNDUP(FORM_VISITA!B8/3,0),0)',0); cot.s('E18','UND'); cot.s('F18','0060105'); cot.s('G18','Tubería EMT 3m 3/4'); cot.n('H18',17.5); cot.f('I18','C18*D18*H18',0); cot.s('J18','Solo si tipo tubería = EMT')
cot.s('A19','MATERIAL'); cot.s('B19','OBLIGATORIO'); cot.n('C19',1); cot.n('D19',1); cot.s('E19','UND'); cot.s('F19','0060106'); cot.s('G19','Interruptor termomagnético'); cot.f('H19','IF(FORM_VISITA!B6="Monofásico",IF(FORM_VISITA!B7="B2C",26.7,58.7),IF(FORM_VISITA!B7="B2C",46.7,109.4))',0); cot.f('I19','C19*D19*H19',0); cot.s('J19','Depende de instalación y cliente')
cot.s('A20','MATERIAL'); cot.s('B20','OBLIGATORIO'); cot.n('C20',1); cot.n('D20',1); cot.s('E20','UND'); cot.s('F20','0060107'); cot.s('G20','Interruptor diferencial'); cot.f('H20','IF(FORM_VISITA!B7="B2C",105.4,424)',0); cot.f('I20','C20*D20*H20',0); cot.s('J20','Depende de tipo cliente')
cot.s('A21','MATERIAL'); cot.s('B21','OBLIGATORIO_REGLA'); cot.f('C21','IF(FORM_VISITA!B9="EMT",1,0)',0); cot.f('D21','IF(C21=1,ROUNDUP(FORM_VISITA!B8/3,0),0)',0); cot.s('E21','UND'); cot.s('F21','0060108'); cot.s('G21','Accesorios EMT Conduit'); cot.n('H21',3.5); cot.f('I21','C21*D21*H21',0); cot.s('J21','Solo si tipo tubería = EMT')

# condicionales técnicos
cond_map = [
    (23,20,'ZZ','0070001','Fuera de la ciudad'),
    (24,21,'ZZ','0070002','Pedestal interior'),
    (25,22,'ZZ','0070003','Pedestal exterior'),
    (26,23,'ZZ','0070004','Platina pared protección'),
    (27,24,'ZZ','0070005','Caja de paso'),
    (28,25,'ZZ','0070006','Caja de protección metálica con chapa'),
    (29,26,'ZZ','0070007','Obra civil básica interior regata resane pintura'),
    (30,27,'ZZ','0070008','Obra civil intermedia interior regata resane pintura'),
    (31,28,'ML','0070009','Obra civil exterior excavación pasto metro lineal'),
    (32,29,'ML','0070010','Obra civil exterior excavación adoquín'),
    (33,30,'ZZ','0070011','Pase placa (perforado de pared)'),
    (34,31,'ZZ','0070012','SSOMA'),
    (35,32,'UND','0070013','Contómetro - Medidor de Energía Eléctrica'),
    (36,33,'UND','0070014','Breaker engrapable 3x50A'),
    (37,34,'UND','0070015','Breaker atornillable 3x50A'),
    (38,35,'UND','0070016','Breaker de riel din 3x63A'),
    (39,36,'UND','0070017','Breaker engrapable 1x50A'),
    (40,37,'UND','0070018','Breaker de riel din 1x63A'),
]
for target_row, form_row, unit, code, desc in cond_map:
    cot.s(f'A{target_row}', 'MATERIAL' if target_row >= 35 else 'MANO_OBRA')
    cot.s(f'B{target_row}', 'CONDICIONAL')
    cot.f(f'C{target_row}', f'FORM_VISITA!D{form_row}', 0)
    cot.f(f'D{target_row}', f'IF(C{target_row}=1,FORM_VISITA!E{form_row},0)', 0)
    cot.s(f'E{target_row}', unit)
    cot.s(f'F{target_row}', code)
    cot.s(f'G{target_row}', desc)
    cot.f(f'H{target_row}', f'FORM_VISITA!F{form_row}', 0)
    cot.f(f'I{target_row}', f'C{target_row}*D{target_row}*H{target_row}', 0)
    cot.s(f'J{target_row}', 'Solo suma si técnico lo activa')

cot.s('A42','MATERIAL'); cot.s('B42','CONDICIONAL_REGLA'); cot.f('C42','IF(SUM(I29:I32)>0,1,0)',0); cot.n('D42',1); cot.s('E42','GL'); cot.s('F42','0060109'); cot.s('G42','Materiales obra civil (40% de MO civil activa)'); cot.f('H42','ROUND(SUM(I29:I32)*0.4,2)',0); cot.f('I42','C42*D42*H42',0); cot.s('J42','Se activa si hay obra civil')

cot.s('G44','Subtotal mano de obra'); cot.f('I44','SUM(I11:I13)+SUM(I23:I34)',0)
cot.s('G45','Subtotal materiales'); cot.f('I45','SUM(I14:I21)+SUM(I35:I42)',0)
cot.s('G46','Subtotal general'); cot.f('I46','I44+I45',0)
cot.s('G47','IGV'); cot.f('I47','I46*FORM_VISITA!B14',0)
cot.s('G48','TOTAL COTIZACIÓN'); cot.f('I48','I46+I47',0)

sheets = [resumen, form, catalogo, cot]
OUT.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('[Content_Types].xml', content_types_xml(len(sheets)))
    zf.writestr('_rels/.rels', root_rels_xml())
    zf.writestr('docProps/app.xml', app_xml([s.name for s in sheets]))
    zf.writestr('docProps/core.xml', core_xml())
    zf.writestr('xl/workbook.xml', workbook_xml([s.name for s in sheets]))
    zf.writestr('xl/_rels/workbook.xml.rels', workbook_rels_xml(len(sheets)))
    zf.writestr('xl/styles.xml', styles_xml())
    for idx, sheet in enumerate(sheets, start=1):
        zf.writestr(f'xl/worksheets/sheet{idx}.xml', sheet.render())

print(OUT)
