#!/usr/bin/env python3
import json
import math
import re
import unicodedata
from datetime import UTC, datetime
from pathlib import Path

DATASET = Path('/root/.openclaw/workspace/apps/mappe-web/public/data/places-lima.json')
SUMMARY = Path('/root/.openclaw/workspace/apps/mappe-web/public/data/summary-lima.json')

LIMA_DISTRICTS = {
    'Ancón': '150102', 'Ate': '150103', 'Barranco': '150104', 'Breña': '150105', 'Carabayllo': '150106',
    'Chaclacayo': '150107', 'Chorrillos': '150108', 'Cieneguilla': '150109', 'Comas': '150110',
    'El Agustino': '150111', 'Independencia': '150112', 'Jesús María': '150113', 'La Molina': '150114',
    'La Victoria': '150115', 'Lince': '150116', 'Los Olivos': '150117', 'Lurigancho': '150118',
    'Lurín': '150119', 'Magdalena del Mar': '150120', 'Pueblo Libre': '150121', 'Miraflores': '150122',
    'Pachacámac': '150123', 'Pucusana': '150124', 'Puente Piedra': '150125', 'Punta Hermosa': '150126',
    'Punta Negra': '150127', 'Rímac': '150128', 'San Bartolo': '150129', 'San Borja': '150130',
    'San Isidro': '150131', 'San Juan de Lurigancho': '150132', 'San Juan de Miraflores': '150133',
    'San Luis': '150134', 'San Martín de Porres': '150135', 'San Miguel': '150136', 'Santa Anita': '150137',
    'Santa María del Mar': '150138', 'Santa Rosa': '150139', 'Santiago de Surco': '150140', 'Surquillo': '150141',
    'Villa María del Triunfo': '150142', 'Villa El Salvador': '150143', 'Lima': '150101', 'Bellavista': '070102',
    'Callao': '070101', 'Carmen de La Legua-Reynoso': '070103', 'La Perla': '070104', 'La Punta': '070105',
    'Ventanilla': '070106', 'Mi Perú': '070107',
}

APEIM_ZONES = {
    '1': ['Puente Piedra', 'Comas', 'Carabayllo'],
    '2': ['Independencia', 'Los Olivos', 'San Martín de Porres'],
    '3': ['San Juan de Lurigancho'],
    '4': ['Lima', 'Rímac', 'Breña', 'La Victoria'],
    '5': ['Ate', 'Chaclacayo', 'Lurigancho', 'Santa Anita', 'San Luis', 'El Agustino'],
    '6': ['Jesús María', 'Lince', 'Pueblo Libre', 'Magdalena del Mar', 'San Miguel'],
    '7': ['Miraflores', 'San Isidro', 'San Borja', 'Santiago de Surco', 'La Molina'],
    '8': ['Surquillo', 'Barranco', 'Chorrillos', 'San Juan de Miraflores'],
    '9': ['Villa El Salvador', 'Villa María del Triunfo', 'Lurín', 'Pachacámac'],
    '10': ['Callao', 'Bellavista', 'La Perla', 'La Punta', 'Carmen de La Legua-Reynoso', 'Ventanilla', 'Mi Perú'],
    'OTROS': ['Ancón', 'Santa Rosa', 'Cieneguilla', 'Pucusana', 'Punta Hermosa', 'Punta Negra', 'San Bartolo', 'Santa María del Mar'],
}

ZONE_TO_NSE = {
    '1': 'D', '2': 'C', '3': 'D', '4': 'C', '5': 'C', '6': 'B', '7': 'AB', '8': 'C', '9': 'D', '10': 'C', 'OTROS': 'C'
}

ZONE_TO_GROUP = {
    'AB': 'alto', 'B': 'medio_alto', 'C': 'medio', 'D': 'medio_bajo', 'E': 'bajo'
}

DISTRICT_TO_ZONE = {district: zone for zone, districts in APEIM_ZONES.items() for district in districts}

DISTRICT_ALIASES = {
    'ancon': 'Ancón', 'ate': 'Ate', 'barranco': 'Barranco', 'brena': 'Breña', 'breña': 'Breña', 'carabayllo': 'Carabayllo',
    'chaclacayo': 'Chaclacayo', 'chorrillos': 'Chorrillos', 'cieneguilla': 'Cieneguilla', 'comas': 'Comas',
    'el agustino': 'El Agustino', 'independencia': 'Independencia', 'jesus maria': 'Jesús María', 'jesús maría': 'Jesús María',
    'la molina': 'La Molina', 'la victoria': 'La Victoria', 'lince': 'Lince', 'los olivos': 'Los Olivos',
    'lurigancho': 'Lurigancho', 'chosica': 'Lurigancho', 'lurin': 'Lurín', 'lurín': 'Lurín', 'magdalena': 'Magdalena del Mar',
    'magdalena del mar': 'Magdalena del Mar', 'pueblo libre': 'Pueblo Libre', 'miraflores': 'Miraflores',
    'pachacamac': 'Pachacámac', 'pachacámac': 'Pachacámac', 'pucusana': 'Pucusana', 'puente piedra': 'Puente Piedra',
    'punta hermosa': 'Punta Hermosa', 'punta negra': 'Punta Negra', 'rimac': 'Rímac', 'rímac': 'Rímac',
    'san bartolo': 'San Bartolo', 'san borja': 'San Borja', 'san isidro': 'San Isidro',
    'san juan de lurigancho': 'San Juan de Lurigancho', 'sjl': 'San Juan de Lurigancho',
    'san juan de miraflores': 'San Juan de Miraflores', 'sjm': 'San Juan de Miraflores',
    'san luis': 'San Luis', 'san martin de porres': 'San Martín de Porres', 'san martín de porres': 'San Martín de Porres',
    'smp': 'San Martín de Porres', 'san miguel': 'San Miguel', 'santa anita': 'Santa Anita',
    'santa maria del mar': 'Santa María del Mar', 'santa maría del mar': 'Santa María del Mar', 'santa rosa': 'Santa Rosa',
    'surco': 'Santiago de Surco', 'santiago de surco': 'Santiago de Surco', 'surquillo': 'Surquillo',
    'villa maria del triunfo': 'Villa María del Triunfo', 'villa maría del triunfo': 'Villa María del Triunfo',
    'vmt': 'Villa María del Triunfo', 'villa el salvador': 'Villa El Salvador', 'ves': 'Villa El Salvador',
    'cercado de lima': 'Lima', 'callao': 'Callao', 'bellavista': 'Bellavista', 'carmen de la legua': 'Carmen de La Legua-Reynoso',
    'carmen de la legua reynoso': 'Carmen de La Legua-Reynoso', 'la perla': 'La Perla', 'la punta': 'La Punta',
    'ventanilla': 'Ventanilla', 'mi peru': 'Mi Perú', 'mi perú': 'Mi Perú', 'puruchuco': 'Ate', 'santa clara': 'Ate',
    'huaycan': 'Ate', 'huaycán': 'Ate', 'mariategui': 'San Juan de Lurigancho', 'mariátegui': 'San Juan de Lurigancho',
    'conchan': 'Lurín', 'conchán': 'Lurín', 'villa hermosa': 'Ate', 'nana': 'Lurigancho', 'ñaña': 'Lurigancho',
    'barbadillo': 'Ate', 'wiesse': 'San Juan de Lurigancho', 'los castillos': 'Ate', 'alameda nana': 'Lurigancho',
    'alameda ñaña': 'Lurigancho',
}

KIO_STATIONS = [
    {
        'id': 'mappe-kio-service-plaza', 'name': 'SERVICE PLAZA KIO', 'canonicalName': 'SERVICE PLAZA KIO',
        'address': 'Carr. Panamericana Sur Km. 25.6, Lurín, Lima, Perú', 'district': 'Lurín', 'ubigeo': '150119',
        'lat': -12.2504172, 'lng': -76.9306974, 'googleMapsUri': 'https://g.page/kioserviceplaza?share',
        'officialPhotoUrl': '/assets/kio/KIO-LURIN-1.png', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Frente a la Refinería Conchán Petroperú, a 2 cuadras del Puente San Luis, en la Carretera Panamericana Sur.'
    },
    {
        'id': 'mappe-kio-virgen-de-las-nieves', 'name': 'KIO VIRGEN DE LAS NIEVES', 'canonicalName': 'KIO VIRGEN DE LAS NIEVES',
        'address': 'Carr. Central 2750, Ate, Lima 15476, Perú', 'district': 'Ate', 'ubigeo': '150103',
        'lat': -12.0089736, 'lng': -76.8629298, 'googleMapsUri': 'https://goo.gl/maps/DtyfA5iq5eLAmNDu5',
        'officialPhotoUrl': '/assets/kio/estacion-virgen-de-las-nieves.jpg', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Paradero Estrella Andina, a 5 minutos de Plaza Vea en Santa Clara.'
    },
    {
        'id': 'mappe-kio-villa-hermosa', 'name': 'KIO VILLA HERMOSA', 'canonicalName': 'KIO VILLA HERMOSA',
        'address': 'Urb. Villa Hermosa Mz. G Lt. 1, Ate, Lima, Perú', 'district': 'Ate', 'ubigeo': '150103',
        'lat': -12.0087679, 'lng': -76.8317347, 'googleMapsUri': 'https://goo.gl/maps/87ia18eQtDt1giE36',
        'officialPhotoUrl': '/assets/kio/estacion-villa-hermosa-1.png', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Entrada Huaycán, a menos de 3 minutos del Escuadrón F2.'
    },
    {
        'id': 'mappe-kio-santa-rosa', 'name': 'KIO SANTA ROSA', 'canonicalName': 'KIO SANTA ROSA',
        'address': 'Av. Los Castillos 340, Ate, Lima, Perú', 'district': 'Ate', 'ubigeo': '150103',
        'lat': -12.0629002, 'lng': -76.9694174, 'googleMapsUri': 'https://goo.gl/maps/Ecva5T93cJ7hbbuJ8',
        'officialPhotoUrl': '/assets/kio/santarosa.jpg', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Altura del puente peatonal Santa Rosa de la Vía de Evitamiento.'
    },
    {
        'id': 'mappe-kio-punta-rocas', 'name': 'KIO PUNTA ROCAS', 'canonicalName': 'KIO PUNTA ROCAS',
        'address': 'Urb. Costa Azul, Punta Negra, Lima, Perú', 'district': 'Punta Negra', 'ubigeo': '150127',
        'lat': -12.3506116, 'lng': -76.8099274, 'googleMapsUri': 'https://goo.gl/maps/tCeL3d8EYZz6PdAEA',
        'officialPhotoUrl': '/assets/kio/estacion-punta-rocas.png', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Altura del Arco de Punta Rocas, al ingreso de la playa.'
    },
    {
        'id': 'mappe-kio-pachacamac', 'name': 'KIO PACHACÁMAC', 'canonicalName': 'KIO PACHACÁMAC',
        'address': 'Av. Villena Mz. B Lt. 4 P.J. Parcelación Huertos de Villena, Pachacámac, Lima, Perú', 'district': 'Pachacámac', 'ubigeo': '150123',
        'lat': -12.2504596, 'lng': -76.8879802, 'googleMapsUri': 'https://g.page/estacioneskio?share',
        'officialPhotoUrl': '/assets/kio/estacion-pachacamac-650x415.jpg', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Antigua Panamericana Sur, pasando la chicharronería del Puente Lurín.'
    },
    {
        'id': 'mappe-kio-negociacion-ya', 'name': 'KIO NEGOCIACIÓN YA', 'canonicalName': 'KIO NEGOCIACIÓN YA',
        'address': 'Av. Wiesse Mz. K19 Lt. 15 Mariátegui, San Juan de Lurigancho, Lima, Perú', 'district': 'San Juan de Lurigancho', 'ubigeo': '150132',
        'lat': -11.9424436, 'lng': -76.9817487, 'googleMapsUri': 'https://goo.gl/maps/5CrsnLoJJaRLZnh27',
        'officialPhotoUrl': '/assets/kio/estacion-Neg.-Ya-650x415.jpg', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'A una cuadra del Arco de José Carlos Mariátegui.'
    },
    {
        'id': 'mappe-kio-nana', 'name': 'KIO ÑAÑA', 'canonicalName': 'KIO ÑAÑA',
        'address': 'Av. Alameda Ñaña 180, Lurigancho, Lima, Perú', 'district': 'Lurigancho', 'ubigeo': '150118',
        'lat': -11.9848237, 'lng': -76.8198549, 'googleMapsUri': 'https://goo.gl/maps/bXBaxpr4C2ouFyvE8',
        'officialPhotoUrl': '/assets/kio/estacion-nana-650x415.png', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Al costado del Puente Ñaña.'
    },
    {
        'id': 'mappe-kio-barbadillo', 'name': 'KIO BARBADILLO', 'canonicalName': 'KIO BARBADILLO',
        'address': 'Mz. E Lt. B3 Urb. Barbadillo, Ate, Lima, Perú', 'district': 'Ate', 'ubigeo': '150103',
        'lat': -12.0360246, 'lng': -76.9201593, 'googleMapsUri': 'https://goo.gl/maps/Auy4ZNcnqUwAJ4gbA',
        'officialPhotoUrl': '/assets/kio/estacion-barbadillo-1-650x415.jpg', 'officialSourceUrl': 'https://estacioneskio.com.pe/encuentra-tu-kio-aqui/',
        'reference': 'Esquina de Calle Berlín y Av. Cnel. Marco Puente Llanos.'
    },
]


def normalize(value):
    value = str(value or '')
    value = unicodedata.normalize('NFD', value)
    value = ''.join(ch for ch in value if unicodedata.category(ch) != 'Mn')
    value = value.lower().replace('&', ' y ')
    value = re.sub(r'[^a-z0-9]+', ' ', value)
    return re.sub(r'\s+', ' ', value).strip()


def hav_km(lat1, lon1, lat2, lon2):
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def google_query_url(name, address='', lat=None, lng=None):
    if lat is not None and lng is not None:
        return f'https://www.google.com/maps/search/?api=1&query={lat},{lng}'
    query = ', '.join([p for p in [name, address, 'Lima', 'Perú'] if p])
    from urllib.parse import quote
    return f'https://www.google.com/maps/search/?api=1&query={quote(query)}'


def detect_district(row):
    existing = row.get('officialDivisionName')
    if existing in DISTRICT_TO_ZONE and existing != 'Lima':
        return existing
    text = ' '.join(str(row.get(k, '')) for k in ['address', 'zone', 'officialDivisionName', 'provinceCommercial', 'name', 'canonicalName', 'operator'])
    text_norm = f' {normalize(text)} '
    hits = []
    for alias, district in DISTRICT_ALIASES.items():
        alias_norm = f' {normalize(alias)} '
        if alias_norm in text_norm:
            hits.append((len(alias_norm), district))
    if hits:
        hits.sort(reverse=True)
        return hits[0][1]
    return existing if existing and existing != 'Lima' else None


def assign_nse_fields(row, district):
    zone = DISTRICT_TO_ZONE.get(district)
    nse = ZONE_TO_NSE.get(zone)
    if not nse:
        return
    row['apeimZone'] = zone
    row['nivel_socioeconomico'] = nse
    row['nseGroup'] = ZONE_TO_GROUP.get(nse)
    row['estrato_entorno'] = nse
    row['estrato_fuente'] = 'apeim_zone_lima_2020_proxy'


def score_kio_station(base):
    base.update({
        'category': 'Grifo / estación de servicio',
        'commercialBranch': 'Movilidad',
        'commercialBranchDetail': 'Movilidad · estación de servicio',
        'commercialScale': 'mediano',
        'commercialScaleLabel': 'Formato mediano',
        'parkingProbability': 'medium',
        'parkingAccessScore': 22,
        'siteScaleScore': 17,
        'dwellTimeScore': 12,
        'publicChargingFitScore': 17,
        'commercialPotentialScore': 17,
        'viabilityScore': 82,
        'viabilityTier': 'high',
        'recommendedAction': 'Prioridad alta',
        'publicChargingCandidate': True,
        'evinkaPriority': 'atacar_ya',
        'evinkaRationale': ['kio_oficial_lima', 'grupo_prioritario_petroperu'],
        'evinkaPremiumCandidate': True,
        'populationDemandScore': 12,
        'populationDemandLocality': None,
        'populationDemandUpz': None,
        'activityDensityScore': 13,
        'activityDensitySignals': None,
        'evAffinityAdvancedScore': 21,
        'hostImportanceScore': 15,
        'newsSignalScore': 8,
        'newsSignalMode': 'operator_official_site',
        'superPremiumScore': 84,
        'superPremiumTier': 'A',
        'superPremiumAction': 'Atacar ya',
        'reviewStatus': 'approved_auto',
        'googleValidationStatus': 'validated_auto',
        'googlePlaceId': None,
        'googleMapsUri': base.get('googleMapsUri') or google_query_url(base.get('name'), base.get('address'), base.get('lat'), base.get('lng')),
        'country': 'Perú',
        'city': 'Lima',
        'officialDivisionType': 'distrito',
        'officialDivisionName': base['district'],
        'officialDivisionCode': base['ubigeo'],
        'officialDivisionSource': 'kio_official_site_2026_05',
        'provinceCommercial': base['district'],
        'zone': base['district'],
        'operator': 'Grupo KIO',
        'operatorGroup': 'KIO',
        'brandGroup': 'KIO',
        'networkBrand': 'PetroPerú',
        'fuelNetwork': 'PetroPerú',
        'source': 'KIO oficial',
        'commercialReady': True,
        'confidence': 'high',
        'rawCount': 1,
        'aliasCount': 1,
        'aliases': [base['name'], 'KIO', 'PetroPerú'],
        'canonicalOperator': 'Grupo KIO',
        'brandReference': 'PetroPerú',
        'referenceNote': base.get('reference'),
        'officialPhotoUrl': base.get('officialPhotoUrl'),
        'officialSourceUrl': base.get('officialSourceUrl'),
        'officialPhone': base.get('officialPhone') or '',
        'officialWebsite': base.get('officialWebsite') or base.get('officialSourceUrl') or '',
        'officialContactNote': 'KIO publica foto, dirección, referencia y Maps; no expone teléfono por estación en esta ficha.',
        'consolidationMode': 'kio_official_curated',
        'hasSubunits': False,
    })
    assign_nse_fields(base, base['district'])
    return base


rows = json.loads(DATASET.read_text())
summary = json.loads(SUMMARY.read_text())

# Normalize + enrich existing rows
for row in rows:
    district = detect_district(row)
    if district:
        row['officialDivisionType'] = 'distrito'
        row['officialDivisionName'] = district
        row['provinceCommercial'] = district
        row['zone'] = district
        row['ubigeo'] = LIMA_DISTRICTS.get(district, row.get('ubigeo'))
        row['officialDivisionCode'] = row['ubigeo']
        row['officialDivisionSource'] = row.get('officialDivisionSource') or 'address_district_inference'
        assign_nse_fields(row, district)
    row['operatorGroup'] = row.get('operatorGroup') or row.get('operator') or row.get('brandGroup') or row.get('name')
    if row.get('lat') is not None and row.get('lng') is not None and not row.get('googleMapsUri'):
        row['googleMapsUri'] = google_query_url(row.get('canonicalName') or row.get('name'), row.get('address'), row.get('lat'), row.get('lng'))
    text_norm = normalize(' '.join(str(row.get(k, '')) for k in ['name', 'operator', 'brandGroup', 'address']))
    if row.get('category') == 'Grifo / estación de servicio':
        if 'petroperu' in text_norm or 'petro peru' in text_norm or 'petro peru gnv' in text_norm:
            row['brandGroup'] = 'PetroPerú'
            row['networkBrand'] = 'PetroPerú'
            row['fuelNetwork'] = 'PetroPerú'
            if normalize(row.get('operator')) in {'petroperu', 'petro peru', 'petroperu gnv', 'petro peru gnv', 'grifo petroperu', 'petroperu energigas', 'petroperu energigas'}:
                row['operator'] = 'PetroPerú'
                row['operatorGroup'] = 'PetroPerú'
        elif 'gaspetrol' in text_norm:
            row['brandGroup'] = 'Gaspetrol'
        elif 'petroamerica' in text_norm or 'petro america' in text_norm:
            row['brandGroup'] = 'Petroamérica'

# Drop existing rows that collide with curated KIO official stations
curated = [score_kio_station(dict(station)) for station in KIO_STATIONS]
filtered_rows = []
for row in rows:
    drop = False
    if row.get('category') == 'Grifo / estación de servicio' and row.get('lat') is not None and row.get('lng') is not None:
        text_norm = normalize(' '.join(str(row.get(k, '')) for k in ['name', 'operator', 'brandGroup', 'address']))
        for station in curated:
            if hav_km(float(row['lat']), float(row['lng']), float(station['lat']), float(station['lng'])) <= 0.5:
                if 'petro' in text_norm or 'kio' in text_norm or row.get('brandGroup') == 'PetroPerú':
                    drop = True
                    break
    if not drop:
        filtered_rows.append(row)

filtered_rows.extend(curated)

# Mild dedupe for exact duplicates by id/name/address/coords/category
seen = set()
rows_out = []
for row in filtered_rows:
    key = (
        normalize(row.get('category')),
        normalize(row.get('canonicalName') or row.get('name')),
        normalize(row.get('address')),
        round(float(row.get('lat') or 0), 5),
        round(float(row.get('lng') or 0), 5),
    )
    if key in seen:
        continue
    seen.add(key)
    rows_out.append(row)

# Prefer official division labels over generic Lima for counts
rows_out.sort(key=lambda r: (normalize(r.get('category')), normalize(r.get('brandGroup')), normalize(r.get('name'))))

counts_super = {'A': 0, 'B': 0, 'C': 0, 'descartar': 0}
counts_premium = {'atacar_ya': 0, 'revisar': 0, 'descartar': 0}
counts_viability = {'high': 0, 'medium': 0, 'low': 0, 'discard': 0}
for row in rows_out:
    counts_super[row.get('superPremiumTier', 'descartar')] = counts_super.get(row.get('superPremiumTier', 'descartar'), 0) + 1
    counts_premium[row.get('evinkaPriority', 'descartar')] = counts_premium.get(row.get('evinkaPriority', 'descartar'), 0) + 1
    counts_viability[row.get('viabilityTier', 'low')] = counts_viability.get(row.get('viabilityTier', 'low'), 0) + 1

summary.update({
    'generatedAt': datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
    'total': len(rows_out),
    'country': 'Perú',
    'cities': ['Lima'],
    'methodology': {
        'extraction': 'Extracción OSM/Overpass sobre Lima Metropolitana más curaduría oficial KIO.',
        'territory': 'Distrito inferido por dirección + zonas APEIM Lima para NSE Perú.',
        'scoring': 'Scoring base MapPe con priorización manual del grupo KIO oficial y links de Google Maps operativos.'
    },
    'counts': {
        'super': counts_super,
        'premium': counts_premium,
        'viability': counts_viability,
    },
    'nseSource': 'APEIM Lima Metropolitana 2020 por zonas (proxy distrital para filtros PE)',
    'officialKioStations': len(curated),
})

DATASET.write_text(json.dumps(rows_out, ensure_ascii=False, indent=2))
SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps({'total': len(rows_out), 'officialKioStations': len(curated)}, ensure_ascii=False, indent=2))
