import json
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path('/root/.openclaw/workspace')
DATASET = ROOT / 'mapco-web/public/data/places-colombia-multicity.json'
OUT = ROOT / 'mapco-web/public/data/places-colombia-multicity.estrato-medellin.json'
API = 'https://www.medellin.gov.co/servidormapas/rest/services/mapas_nacionales/VC_Distribucion_Poblacional/MapServer/0/query'


def nse_group(estrato):
    if estrato in (1, 2):
        return 'bajo'
    if estrato in (3, 4):
        return 'medio'
    if estrato in (5, 6):
        return 'alto'
    return None


def query_point(session, lng, lat, timeout=45):
    params = {
        'geometry': f'{lng},{lat}',
        'geometryType': 'esriGeometryPoint',
        'inSR': '4326',
        'spatialRel': 'esriSpatialRelIntersects',
        'outFields': 'estrato,comuna,barrio,codigo_barrio',
        'returnGeometry': 'false',
        'f': 'json',
    }
    r = session.get(API, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    features = data.get('features') or []
    if not features:
        return None
    attrs = features[0].get('attributes') or {}
    estrato = attrs.get('estrato')
    if estrato is not None:
        try:
            estrato = int(estrato)
        except Exception:
            estrato = None
    return {
        'estrato_entorno': estrato,
        'nivel_socioeconomico': nse_group(estrato),
        'estrato_fuente': 'medellin_oficial',
        'estrato_comuna': attrs.get('comuna'),
        'estrato_barrio': attrs.get('barrio'),
        'estrato_codigo_barrio': attrs.get('codigo_barrio'),
    }


def main():
    rows = json.load(open(DATASET, encoding='utf-8'))
    medellin_rows = [r for r in rows if r.get('city') == 'Medellín']
    unique_points = {}
    for row in medellin_rows:
        lat = row.get('lat')
        lng = row.get('lng')
        if lat is None or lng is None:
            continue
        key = (round(float(lat), 6), round(float(lng), 6))
        unique_points[key] = {'lat': float(lat), 'lng': float(lng)}

    results = {}
    errors = {}
    coords = list(unique_points.values())
    print(json.dumps({'city': 'Medellín', 'rows': len(medellin_rows), 'unique_points': len(coords)}, ensure_ascii=False))

    def worker(item):
        key = (round(item['lat'], 6), round(item['lng'], 6))
        session = requests.Session()
        session.headers.update({'User-Agent': 'MapCo-EVINKA/1.0'})
        for attempt in range(3):
            try:
                payload = query_point(session, item['lng'], item['lat'])
                return key, payload, None
            except Exception as e:
                err = str(e)
                time.sleep(0.8 * (attempt + 1))
        return key, None, err

    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(worker, item) for item in coords]
        for idx, fut in enumerate(as_completed(futs), start=1):
            key, payload, err = fut.result()
            if payload is not None:
                results[key] = payload
            else:
                errors[key] = err
            if idx % 100 == 0:
                print(f'processed {idx}/{len(coords)} ok={len(results)} err={len(errors)}')

    enriched = []
    with_data = 0
    for row in rows:
        updated = dict(row)
        if row.get('city') == 'Medellín' and row.get('lat') is not None and row.get('lng') is not None:
            key = (round(float(row['lat']), 6), round(float(row['lng']), 6))
            payload = results.get(key)
            if payload:
                updated.update(payload)
                with_data += 1
        enriched.append(updated)

    json.dump(enriched, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(json.dumps({
        'output': str(OUT),
        'medellin_rows': len(medellin_rows),
        'unique_points': len(coords),
        'points_ok': len(results),
        'points_err': len(errors),
        'rows_with_estrato': with_data,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
