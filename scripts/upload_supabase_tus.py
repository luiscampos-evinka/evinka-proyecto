#!/usr/bin/env python3
import argparse
import base64
import os
import sys
from pathlib import Path

import requests

CHUNK_SIZE = 6 * 1024 * 1024
CA_FILE = '/etc/ssl/certs/ca-certificates.crt'
ENV_FILE = '/root/.openclaw/workspace/.env'


def load_env(path: str):
    for line in Path(path).read_text().splitlines():
        s = line.strip()
        if not s or s.startswith('#') or '=' not in s:
            continue
        k, v = s.split('=', 1)
        k = k.strip()
        v = v.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        os.environ.setdefault(k, v)


def b64(value: str) -> str:
    return base64.b64encode(value.encode('utf-8')).decode('ascii')


def storage_endpoint() -> str:
    base = os.environ['SUPABASE_URL'].rstrip('/')
    host = base.split('://', 1)[1]
    project_ref = host.split('.', 1)[0]
    return f'https://{project_ref}.storage.supabase.co/storage/v1/upload/resumable'


def create_upload(url: str, token: str, bucket: str, object_name: str, size: int, content_type: str = 'application/gzip') -> str:
    metadata = ','.join([
        f'bucketName {b64(bucket)}',
        f'objectName {b64(object_name)}',
        f'contentType {b64(content_type)}',
        f'cacheControl {b64("3600")}',
    ])
    headers = {
        'authorization': f'Bearer {token}',
        'x-upsert': 'true',
        'tus-resumable': '1.0.0',
        'upload-length': str(size),
        'upload-metadata': metadata,
        'content-length': '0',
    }
    response = requests.post(url, headers=headers, verify=CA_FILE, timeout=120)
    response.raise_for_status()
    location = response.headers.get('location') or response.headers.get('Location')
    if not location:
        raise RuntimeError(f'No Location header in response: {response.status_code} {response.text[:500]}')
    if location.startswith('http://') or location.startswith('https://'):
        return location
    base_root = url.split('/storage/v1/upload/resumable', 1)[0]
    if not location.startswith('/'):
        location = '/' + location
    return base_root + location


def upload_file(upload_url: str, file_path: Path):
    total = file_path.stat().st_size
    offset = 0
    with file_path.open('rb') as fh:
        while offset < total:
            chunk = fh.read(CHUNK_SIZE)
            if not chunk:
                break
            headers = {
                'tus-resumable': '1.0.0',
                'upload-offset': str(offset),
                'content-type': 'application/offset+octet-stream',
            }
            response = requests.patch(upload_url, headers=headers, data=chunk, verify=CA_FILE, timeout=600)
            response.raise_for_status()
            new_offset = response.headers.get('upload-offset') or response.headers.get('Upload-Offset')
            offset = int(new_offset) if new_offset else offset + len(chunk)
            pct = (offset / total) * 100
            print(f'{file_path.name}: {offset}/{total} ({pct:.2f}%)', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--object', required=True, dest='object_name')
    parser.add_argument('file_path')
    args = parser.parse_args()

    load_env(ENV_FILE)
    token = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    endpoint = storage_endpoint()
    file_path = Path(args.file_path)
    size = file_path.stat().st_size
    upload_url = create_upload(endpoint, token, args.bucket, args.object_name, size)
    print(f'UPLOAD_URL {upload_url}', flush=True)
    upload_file(upload_url, file_path)
    print(f'DONE {args.object_name}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        raise
