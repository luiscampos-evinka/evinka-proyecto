#!/usr/bin/env python3
import argparse
import re
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
ET.register_namespace('', NS_MAIN)
ET.register_namespace('r', NS_REL)


def col_to_num(col: str) -> int:
    n = 0
    for ch in col:
        if ch.isalpha():
            n = n * 26 + ord(ch.upper()) - 64
    return n


def num_to_col(num: int) -> str:
    out = ''
    while num > 0:
        num, rem = divmod(num - 1, 26)
        out = chr(65 + rem) + out
    return out or 'A'


def parse_shared_strings(zf: ZipFile):
    shared = []
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return shared
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    ns = {'a': NS_MAIN}
    for si in root.findall('a:si', ns):
        text = ''.join(t.text or '' for t in si.findall('.//a:t', ns))
        shared.append(text)
    return shared


def workbook_first_sheet_path(zf: ZipFile):
    ns_main = {'a': NS_MAIN}
    ns_pkg = {'p': NS_PKG}
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels.findall('p:Relationship', ns_pkg)}
    first_sheet = wb.find('a:sheets/a:sheet', ns_main)
    if first_sheet is None:
        raise SystemExit('No worksheet found in workbook')
    rid = first_sheet.attrib.get(f'{{{NS_REL}}}id')
    target = rel_map.get(rid)
    if not target:
        raise SystemExit('Worksheet relationship not found')
    target = target.lstrip('/')
    return target if target.startswith('xl/') else f'xl/{target}'


def cell_value(cell, shared):
    ns = {'a': NS_MAIN}
    t = cell.attrib.get('t')
    if t == 's':
        v = cell.find('a:v', ns)
        if v is None or v.text is None:
            return ''
        try:
            return shared[int(v.text)]
        except Exception:
            return v.text or ''
    if t == 'inlineStr':
        return ''.join(x.text or '' for x in cell.findall('.//a:t', ns))
    v = cell.find('a:v', ns)
    return v.text if v is not None and v.text is not None else ''


def read_rows(input_path: Path):
    rows = []
    with ZipFile(input_path) as zf:
        shared = parse_shared_strings(zf)
        sheet_path = workbook_first_sheet_path(zf)
        root = ET.fromstring(zf.read(sheet_path))
        ns = {'a': NS_MAIN}
        for row in root.findall('.//a:sheetData/a:row', ns):
            values = {}
            for cell in row.findall('a:c', ns):
                ref = cell.attrib.get('r', '')
                m = re.match(r'([A-Z]+)', ref)
                idx = col_to_num(m.group(1)) if m else len(values) + 1
                values[idx] = cell_value(cell, shared)
            rows.append(values)
    return rows


def build_sheet_xml(template_bytes: bytes, filtered_rows):
    root = ET.fromstring(template_bytes)
    max_col = max((len(row) for row in filtered_rows), default=1)
    max_row = max(len(filtered_rows), 1)

    dimension = root.find(f'{{{NS_MAIN}}}dimension')
    dim_ref = f'A1:{num_to_col(max_col)}{max_row}' if max_col > 1 or max_row > 1 else 'A1'
    if dimension is None:
        dimension = ET.Element(f'{{{NS_MAIN}}}dimension')
        root.insert(0, dimension)
    dimension.set('ref', dim_ref)

    sheet_data = root.find(f'{{{NS_MAIN}}}sheetData')
    if sheet_data is None:
        sheet_data = ET.Element(f'{{{NS_MAIN}}}sheetData')
        root.append(sheet_data)
    sheet_data.clear()

    for row_idx, row in enumerate(filtered_rows, start=1):
        row_el = ET.SubElement(sheet_data, f'{{{NS_MAIN}}}row', {'r': str(row_idx)})
        for col_idx, value in enumerate(row, start=1):
            cell_ref = f'{num_to_col(col_idx)}{row_idx}'
            cell_el = ET.SubElement(row_el, f'{{{NS_MAIN}}}c', {'r': cell_ref, 't': 'inlineStr'})
            is_el = ET.SubElement(cell_el, f'{{{NS_MAIN}}}is')
            t_el = ET.SubElement(is_el, f'{{{NS_MAIN}}}t')
            text = '' if value is None else str(value)
            if text.strip() != text or '\n' in text:
                t_el.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            t_el.text = text

    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def write_xlsx(input_path: Path, output_path: Path, filtered_rows):
    with ZipFile(input_path) as source, ZipFile(output_path, 'w', compression=ZIP_DEFLATED) as target:
        sheet_path = workbook_first_sheet_path(source)
        for info in source.infolist():
            data = source.read(info.filename)
            if info.filename == sheet_path:
                data = build_sheet_xml(data, filtered_rows)
            target.writestr(info, data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input')
    parser.add_argument('output')
    parser.add_argument('--columns', required=True)
    args = parser.parse_args()

    columns = [item.strip() for item in args.columns.split(',') if item.strip()]
    if not columns:
        raise SystemExit('No columns selected')

    rows = read_rows(Path(args.input))
    if not rows:
        raise SystemExit('Workbook has no rows')

    header = rows[0]
    header_values = [header.get(i, '') for i in range(1, max(header.keys() or [0]) + 1)]
    selected_indexes = []
    for column in columns:
        try:
            idx = header_values.index(column) + 1
        except ValueError:
            continue
        selected_indexes.append(idx)
    if not selected_indexes:
        raise SystemExit('Selected columns not found in workbook')

    filtered_rows = []
    for row in rows:
        filtered_rows.append([row.get(idx, '') for idx in selected_indexes])

    write_xlsx(Path(args.input), Path(args.output), filtered_rows)


if __name__ == '__main__':
    main()
