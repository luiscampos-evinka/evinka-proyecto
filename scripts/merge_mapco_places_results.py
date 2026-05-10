import json
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace')
DATASET = ROOT / 'apps/mapco-web/public/data/places-colombia-multicity.json'
OUTPUT = ROOT / 'apps/mapco-web/public/data/places-colombia-multicity.enriched.json'
SOURCES = [
    ROOT / 'deliverables/mapco-google-validation-bogota.json',
    ROOT / 'deliverables/mapco-google-validation-medellin.json',
    ROOT / 'deliverables/mapco-google-validation-cali.json',
]


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    rows = load_json(DATASET)
    validations = {}
    for src in SOURCES:
        obj = load_json(src)
        for item in obj.get('results', []):
            validations[item['id']] = item.get('googleValidation', {})

    merged = []
    stats = {
        'rows': len(rows),
        'withValidationRecord': 0,
        'validatedInjected': 0,
        'ambiguousTracked': 0,
        'otherTracked': 0,
        'withGoogleMapsUriAfter': 0,
    }

    for row in rows:
        updated = dict(row)
        gv = validations.get(row['id'])
        if gv:
            stats['withValidationRecord'] += 1
            best = gv.get('best') or {}
            updated['googleValidationStatus'] = gv.get('status')
            updated['googleValidationConfidence'] = gv.get('confidence')
            updated['googleValidationCandidates'] = gv.get('candidates', [])[:3]
            updated['googleValidationDetailsError'] = gv.get('detailsError')
            if best:
                updated['googleCandidatePlaceId'] = best.get('id')
                updated['googleCandidateName'] = best.get('displayName')
                updated['googleCandidateAddress'] = best.get('formattedAddress')
                updated['googleCandidateShortAddress'] = best.get('shortFormattedAddress')
                updated['googleCandidateMapsUri'] = best.get('googleMapsUri')
                updated['googleCandidateBusinessStatus'] = best.get('businessStatus')
                updated['googleCandidatePrimaryType'] = best.get('primaryType')
                updated['googleCandidatePrimaryTypeDisplayName'] = best.get('primaryTypeDisplayName')
                updated['googleCandidateDistanceKm'] = best.get('distanceKm')
                updated['googleCandidateNameScore'] = best.get('nameScore')
                updated['googleCandidateAddressScore'] = best.get('addressScore')
                updated['googleCandidatePhone'] = best.get('nationalPhoneNumber')
                updated['googleCandidateWebsite'] = best.get('websiteUri')
                updated['googleCandidateOpeningHours'] = best.get('regularOpeningHours')

            if gv.get('status') == 'validated' and best:
                stats['validatedInjected'] += 1
                updated['placeId'] = best.get('id') or updated.get('placeId')
                updated['googlePlaceId'] = best.get('id') or updated.get('googlePlaceId')
                updated['googleMapsUri'] = best.get('googleMapsUri') or updated.get('googleMapsUri')
                updated['address'] = best.get('shortFormattedAddress') or best.get('formattedAddress') or updated.get('address')
                updated['googleFormattedAddress'] = best.get('formattedAddress') or updated.get('googleFormattedAddress')
                updated['phone'] = best.get('nationalPhoneNumber') or updated.get('phone')
                updated['website'] = best.get('websiteUri') or updated.get('website')
                updated['businessStatus'] = best.get('businessStatus') or updated.get('businessStatus')
                updated['googlePrimaryType'] = best.get('primaryType') or updated.get('googlePrimaryType')
                updated['googlePrimaryTypeDisplayName'] = best.get('primaryTypeDisplayName') or updated.get('googlePrimaryTypeDisplayName')
                if best.get('location'):
                    loc = best['location']
                    updated['lat'] = loc.get('latitude', updated.get('lat'))
                    updated['lng'] = loc.get('longitude', updated.get('lng'))
            elif gv.get('status') == 'ambiguous':
                stats['ambiguousTracked'] += 1
            else:
                stats['otherTracked'] += 1

        if updated.get('googleMapsUri'):
            stats['withGoogleMapsUriAfter'] += 1
        merged.append(updated)

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(json.dumps({'output': str(OUTPUT), 'stats': stats}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
