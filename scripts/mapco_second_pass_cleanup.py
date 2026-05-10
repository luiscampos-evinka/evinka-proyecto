import json
import re
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace')
DATASET = ROOT / 'mapco-web/public/data/places-colombia-multicity.json'
OUTPUT = ROOT / 'mapco-web/public/data/places-colombia-multicity.v2.json'
VALIDATION_FILES = [
    ROOT / 'deliverables/mapco-google-validation-bogota.json',
    ROOT / 'deliverables/mapco-google-validation-medellin.json',
    ROOT / 'deliverables/mapco-google-validation-cali.json',
]


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def clean_name(value):
    if value is None:
        return value
    text = str(value).strip()
    text = re.sub(r'^\s*["“”]+\s*', '', text)
    text = re.sub(r'\s*["“”]+\s*$', '', text)
    text = re.sub(r'\s+\.\s*$', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def should_auto_approve(gv):
    if not gv or gv.get('status') != 'ambiguous':
        return False
    best = gv.get('best') or {}
    confidence = gv.get('confidence') or 0
    name_score = best.get('nameScore') or 0
    distance = best.get('distanceKm')
    if distance is None:
        return False
    return (
        confidence >= 0.64
        and name_score >= 0.60
        and distance <= 0.15
        and bool(best.get('googleMapsUri'))
    )


def apply_best(row, best):
    row['placeId'] = best.get('id') or row.get('placeId')
    row['googlePlaceId'] = best.get('id') or row.get('googlePlaceId')
    row['googleMapsUri'] = best.get('googleMapsUri') or row.get('googleMapsUri')
    row['address'] = best.get('shortFormattedAddress') or best.get('formattedAddress') or row.get('address')
    row['googleFormattedAddress'] = best.get('formattedAddress') or row.get('googleFormattedAddress')
    row['phone'] = best.get('nationalPhoneNumber') or row.get('phone')
    row['website'] = best.get('websiteUri') or row.get('website')
    row['businessStatus'] = best.get('businessStatus') or row.get('businessStatus')
    row['googlePrimaryType'] = best.get('primaryType') or row.get('googlePrimaryType')
    row['googlePrimaryTypeDisplayName'] = best.get('primaryTypeDisplayName') or row.get('googlePrimaryTypeDisplayName')
    if best.get('displayName'):
        row['googleCandidateName'] = best.get('displayName')


def main():
    rows = load_json(DATASET)
    validations = {}
    for file in VALIDATION_FILES:
        obj = load_json(file)
        for item in obj.get('results', []):
            validations[item['id']] = item.get('googleValidation', {})

    stats = {
        'rows': len(rows),
        'namesCleaned': 0,
        'ambiguousAutoApproved': 0,
        'withGoogleMapsUriAfter': 0,
        'withPlaceIdAfter': 0,
    }

    for row in rows:
        original_name = row.get('name')
        original_canonical = row.get('canonicalName')
        row['name'] = clean_name(row.get('name'))
        row['canonicalName'] = clean_name(row.get('canonicalName'))
        if row['name'] != original_name or row['canonicalName'] != original_canonical:
            stats['namesCleaned'] += 1

        gv = validations.get(row.get('id'))
        if should_auto_approve(gv):
            best = gv.get('best') or {}
            apply_best(row, best)
            row['googleValidationOriginalStatus'] = gv.get('status')
            row['googleValidationStatus'] = 'validated_auto'
            row['googleValidationAutoApproved'] = True
            stats['ambiguousAutoApproved'] += 1

        if row.get('googleMapsUri'):
            stats['withGoogleMapsUriAfter'] += 1
        if row.get('placeId'):
            stats['withPlaceIdAfter'] += 1

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(json.dumps({'output': str(OUTPUT), 'stats': stats}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
