import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path('/root/.openclaw/workspace')
DATASET = ROOT / 'mapco-web/public/data/places-colombia-multicity.json'
OUT = ROOT / 'mapco-web/public/data/places-colombia-multicity.estrato-medellin.json'
API = 'https://www.medellin.gov.co/servidormapas/rest/services/mapas_nacionales/VC_Distribucion_Poblacional/MapServer/0/query'
MAX_WORKERS = 24
TIMEOUT = 18
RETRIES = 1


def nse_group(estrato):
    if estrato in (1, 2): return 'bajo'
    if estrato in (3, 4): return 'medio'
    if estrato in (5, 6): return 'alto'
    return None


def fetch_point(lng, lat):
    params = {
        'geometry': f'{lng},{lat}',
        'geometryType': 'esriGeometryPoint',
        'inSR': '4326',
        'spatialRel': 'esriSpatialRelIntersects',
        'outFields': 'estrato,comuna,barrio,codigo_barrio',
        'returnGeometry': 'false',
        'f': 'json',
    }
    headers = {'User-Agent': 'MapCo-EVINKA/1.0'}
    last_err = None
    for attempt in range(RETRIES + 1):
        try:
            r = requests.get(API, params=params, headers=headers, timeout=TIMEOUT)
            r.raise_for_status()
            data = r.json()
            features = data.get('features') or []
            if not features:
                return {}
            a = features[0].get('attributes') or {}
            estrato = a.get('estrato')
            try:
                estrato = int(estrato) if estrato is not None else None
            except Exception:
                estrato = None
            return {
                'estrato_entorno': estrato,
                'nivel_socioeconomico': nse_group(estrato),
                'estrato_fuente': 'medellin_oficial',
                'estrato_comuna': a.get('comuna'),
                'estrato_barrio': a.get('barrio'),
                'estrato_codigo_barrio': a.get('codigo_barrio'),
            }
        except Exception as e:
            last_err = str(e)
            time.sleep(0.25 * (attempt + 1))
    return {'_error': last_err}


def main():
    rows = json.load(open(DATASET, encoding='utf-8'))
    med = [r for r in rows if r.get('city') == 'Medellín' and r.get('lat') is not None and r.get('lng') is not None]
    print(json.dumps({'city': 'Medellín', 'rows': len(med), 'workers': MAX_WORKERS}, ensure_ascii=False), flush=True)

    futures = {}
    results = {}
    errors = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        for row in med:
            futures[ex.submit(fetch_point, row['lng'], row['lat'])] = row['id']
        total = len(futures)
        done = 0
        for fut in as_completed(futures):
            row_id = futures[fut]
            payload = fut.result()
            results[row_id] = payload
            done += 1
            if payload.get('_error'):
                errors += 1
            if done % 100 == 0 or done == total:
                print(f'processed {done}/{total} errors={errors}', flush=True)

    enriched = []
    rows_with = 0
    for row in rows:
        updated = dict(row)
        payload = results.get(row.get('id'))
        if payload and not payload.get('_error'):
            updated.update(payload)
            if payload.get('estrato_entorno') is not None:
                rows_with += 1
        enriched.append(updated)

    json.dump(enriched, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(json.dumps({'output': str(OUT), 'rows_with_estrato': rows_with, 'errors': errors}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
