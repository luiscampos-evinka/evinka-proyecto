#!/usr/bin/env bash
set -euo pipefail
cd /root/.openclaw/workspace
mkdir -p /root/.openclaw/workspace/.runtime
if [[ -f /root/.openclaw/workspace/.runtime/meta-webhook.pid ]]; then
  oldpid=$(cat /root/.openclaw/workspace/.runtime/meta-webhook.pid || true)
  if [[ -n "${oldpid:-}" ]] && kill -0 "$oldpid" 2>/dev/null; then
    kill "$oldpid" || true
    sleep 1
  fi
fi
nohup node src/metaWebhookServer.mjs >/root/.openclaw/workspace/.runtime/meta-webhook.log 2>&1 &
echo $! >/root/.openclaw/workspace/.runtime/meta-webhook.pid
sleep 1
cat /root/.openclaw/workspace/.runtime/meta-webhook.pid
