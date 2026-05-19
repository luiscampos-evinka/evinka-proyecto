#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/root/.openclaw/workspace"
BACKUPS_DIR="/root/backups"
ENV_FILE="$WORKSPACE/.env"
BUCKET="${BACKUP_SUPABASE_BUCKET:-OPENCLAW_BACKUPS}"
PREFIX="${BACKUP_SUPABASE_PREFIX:-server/$(date +%F)}"
KEEP_COUNT="${BACKUP_KEEP_COUNT:-2}"
CHUNK_MB="${BACKUP_UPLOAD_CHUNK_MB:-50}"
DRY_RUN=0
SKIP_CREATE=0
SKIP_UPLOAD=0

usage() {
  cat <<'EOF'
Uso: backup_server_and_upload.sh [opciones]

Opciones:
  --dry-run       Muestra acciones sin borrar ni subir archivos.
  --skip-create   No crea backups nuevos; solo comprime/prunea/sube lo existente.
  --skip-upload   No sube a Supabase.
  --keep N        Conserva N backups más recientes por tipo (default: 2).
  --chunk-mb N    Parte uploads grandes en bloques de N MB (default: 50).
  --help          Muestra esta ayuda.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --skip-create) SKIP_CREATE=1 ;;
    --skip-upload) SKIP_UPLOAD=1 ;;
    --keep)
      shift
      KEEP_COUNT="${1:-2}"
      ;;
    --chunk-mb)
      shift
      CHUNK_MB="${1:-1500}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Opción no reconocida: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "No encontré $ENV_FILE" >&2
    exit 1
  fi
  eval "$(python3 - <<'PY'
import shlex
from pathlib import Path
for line in Path('/root/.openclaw/workspace/.env').read_text().splitlines():
    s=line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    k,v=s.split('=',1)
    k=k.strip(); v=v.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        v=v[1:-1]
    print(f'export {k}={shlex.quote(v)}')
PY
)"
  : "${SUPABASE_URL:?Falta SUPABASE_URL}"
  : "${SUPABASE_SERVICE_ROLE_KEY:?Falta SUPABASE_SERVICE_ROLE_KEY}"
}

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

create_backups() {
  mkdir -p "$BACKUPS_DIR"
  local stamp
  stamp="$(date +%F-%H%M%S)"
  run_cmd tar -czf "$BACKUPS_DIR/openclaw-backup-full-$stamp.tar.gz" \
    /root/.openclaw \
    /root/.config/systemd/user/openclaw-gateway.service \
    /root/.bashrc \
    /root/.profile \
    /etc/nginx/conf.d/bot.evinka.net.conf \
    /etc/letsencrypt/live/bot.evinka.net \
    /etc/letsencrypt/archive/bot.evinka.net

  run_cmd tar -czf "$BACKUPS_DIR/workspace-backup-$stamp.tar.gz" \
    /root/.openclaw/workspace
}

compress_loose_entries() {
  mapfile -d '' entries < <(find "$BACKUPS_DIR" -maxdepth 1 -mindepth 1 \( -type d -o \( -type f ! -name '*.tar.gz' ! -name '*.tgz' ! -name '*.zip' ! -name '*.gz' \) \) -print0)
  for entry in "${entries[@]:-}"; do
    [[ -z "$entry" ]] && continue
    if [[ -d "$entry" ]]; then
      local base
      base="$(basename "$entry")"
      run_cmd tar -czf "$BACKUPS_DIR/$base.tar.gz" -C "$BACKUPS_DIR" "$base"
      run_cmd rm -rf "$entry"
    else
      run_cmd gzip -f -9 "$entry"
    fi
  done
}

prune_pattern() {
  local pattern="$1"
  mapfile -t files < <(find "$BACKUPS_DIR" -maxdepth 1 -type f -name "$pattern" -printf '%T@\t%p\n' | sort -nr | cut -f2-)
  local idx=0
  for file in "${files[@]:-}"; do
    idx=$((idx + 1))
    if (( idx > KEEP_COUNT )); then
      run_cmd rm -f "$file"
    fi
  done
}

prune_old_backups() {
  prune_pattern 'openclaw-backup-full-*.tar.gz'
  prune_pattern 'workspace-backup-*.tar.gz'
  prune_pattern 'openclaw-backup-full-*.zip'
  prune_pattern 'workspace-backup-*.zip'
  prune_pattern 'openclaw-backup-full-*.gz'
  prune_pattern 'workspace-backup-*.gz'
}

upload_file() {
  local file="$1"
  local object_path="${2:-$PREFIX/$(basename "$file")}"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] subir $file -> $object_path"
    return 0
  fi
  BUCKET_NAME="$BUCKET" FILE_PATH="$file" OBJECT_PATH="$object_path" python3 - <<'PY'
import os
import requests

file_path = os.environ['FILE_PATH']
object_path = os.environ['OBJECT_PATH']
base = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
url = f"{base}/storage/v1/object/{os.environ.get('BUCKET_NAME', 'EVINKA')}/{object_path}"
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'x-upsert': 'true',
    'Content-Type': 'application/octet-stream',
}
with open(file_path, 'rb') as fh:
    response = requests.post(url, headers=headers, data=fh, timeout=None, verify='/etc/ssl/certs/ca-certificates.crt')
response.raise_for_status()
print(f"subido: {object_path}")
PY
}

upload_chunked_file() {
  local file="$1"
  local file_name object_base size_bytes chunk_bytes total_parts tmp_chunk manifest_file part_num offset count_mb object_part
  file_name="$(basename "$file")"
  object_base="$PREFIX/$file_name"
  size_bytes="$(stat -c%s "$file")"
  chunk_bytes=$(( CHUNK_MB * 1024 * 1024 ))
  total_parts=$(( (size_bytes + chunk_bytes - 1) / chunk_bytes ))
  manifest_file="$(mktemp /tmp/backup-manifest-XXXXXX.json)"
  python3 - <<PY > "$manifest_file"
import json
print(json.dumps({
  "file": ${file_name@Q},
  "sizeBytes": $size_bytes,
  "chunkMb": $CHUNK_MB,
  "parts": $total_parts
}, indent=2))
PY
  upload_file "$manifest_file" "$object_base.manifest.json"
  run_cmd rm -f "$manifest_file"
  offset=0
  part_num=0
  while (( offset < size_bytes )); do
    tmp_chunk="$(mktemp /tmp/${file_name}.partXXXXXX)"
    count_mb=$CHUNK_MB
    if (( offset + chunk_bytes > size_bytes )); then
      local remaining_bytes=$(( size_bytes - offset ))
      count_mb=$(( (remaining_bytes + 1024 * 1024 - 1) / (1024 * 1024) ))
    fi
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "[dry-run] partir $file parte $part_num offset=$offset count_mb=$count_mb"
    else
      dd if="$file" of="$tmp_chunk" bs=1M skip=$(( offset / 1024 / 1024 )) count="$count_mb" status=none
    fi
    object_part="$object_base.part$(printf '%03d' "$part_num")"
    if [[ "$DRY_RUN" == "1" ]]; then
      echo "[dry-run] subir bloque $tmp_chunk -> $object_part"
    else
      BUCKET_NAME="$BUCKET" FILE_PATH="$tmp_chunk" OBJECT_PATH="$object_part" python3 - <<'PY'
import os
import requests
file_path = os.environ['FILE_PATH']
object_path = os.environ['OBJECT_PATH']
base = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
url = f"{base}/storage/v1/object/{os.environ.get('BUCKET_NAME', 'EVINKA')}/{object_path}"
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'x-upsert': 'true',
    'Content-Type': 'application/octet-stream',
}
with open(file_path, 'rb') as fh:
    response = requests.post(url, headers=headers, data=fh, timeout=None, verify='/etc/ssl/certs/ca-certificates.crt')
response.raise_for_status()
print(f"subido: {object_path}")
PY
      rm -f "$tmp_chunk"
    fi
    offset=$(( offset + count_mb * 1024 * 1024 ))
    part_num=$(( part_num + 1 ))
  done
}

upload_backups() {
  mapfile -t files < <(find "$BACKUPS_DIR" -maxdepth 1 -type f \( -name 'openclaw-backup-full-*.tar.gz' -o -name 'workspace-backup-*.tar.gz' -o -name 'openclaw-backup-full-*.zip' -o -name 'workspace-backup-*.zip' -o -name 'openclaw-backup-full-*.gz' -o -name 'workspace-backup-*.gz' \) | sort)
  for file in "${files[@]:-}"; do
    [[ -n "$file" ]] || continue
    local size_bytes
    size_bytes="$(stat -c%s "$file")"
    if (( size_bytes > 2000000000 )); then
      upload_chunked_file "$file"
    else
      upload_file "$file"
    fi
  done
}

show_summary() {
  echo "Backups actuales en $BACKUPS_DIR:"
  find "$BACKUPS_DIR" -maxdepth 1 -mindepth 1 -printf '%TY-%Tm-%Td %TH:%TM\t%f\t%s\n' | sort
}

main() {
  mkdir -p "$BACKUPS_DIR"
  load_env
  if [[ "$SKIP_CREATE" != "1" ]]; then
    create_backups
  fi
  compress_loose_entries
  prune_old_backups
  if [[ "$SKIP_UPLOAD" != "1" ]]; then
    upload_backups
  fi
  show_summary
}

main "$@"
