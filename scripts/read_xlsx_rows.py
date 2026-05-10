#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

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


def normalize_header(value: str, fallback: str) -> str:
    text = str(value or '').strip()
    return text or fallback


def main():
    if len(sys.argv) != 2:
      raise SystemExit('Usage: read_xlsx_rows.py <input.xlsx>')

    rows = read_rows(Path(sys.argv[1]))
    if not rows:
        print('[]')
        return

    header_row = rows[0]
    max_col = max(header_row.keys() or [0])
    headers = [normalize_header(header_row.get(i, ''), f'Column{i}') for i in range(1, max_col + 1)]

    data = []
    for row in rows[1:]:
        item = {}
        for idx, header in enumerate(headers, start=1):
            item[header] = row.get(idx, '')
        if any(str(value or '').strip() for value in item.values()):
            data.append(item)

    print(json.dumps(data, ensure_ascii=False))


if __name__ == '__main__':
    main()
