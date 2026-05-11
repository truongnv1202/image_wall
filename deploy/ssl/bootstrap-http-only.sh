#!/usr/bin/env bash
# Bước 1 (trước khi có SSL): bản HTTP-only để Certbot lấy được challenge qua webroot.
# Sau đó: issue-sync.sh (webroot), hoặc các cách khác trong deploy/ssl/ (standalone, nginx-plugin, docker).
#
#   sudo ./deploy/ssl/bootstrap-http-only.sh
#   sudo EMAIL=you@domain.tld ./deploy/ssl/issue-sync.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$DEPLOY_DIR/nginx-host/trienlam.gamegiaoduc.co.conf"
DOMAIN="${DOMAIN:-trienlam.gamegiaoduc.co}"
OUT="${NGINX_SITE_OUT:-/etc/nginx/sites-available/$DOMAIN}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chạy bằng sudo." >&2
  exit 1
fi

mkdir -p /var/www/certbot

if [[ ! -f "$SRC" ]]; then
  echo "Không thấy $SRC" >&2
  exit 1
fi

install -m 0644 "$SRC" "$OUT"
nginx -t
systemctl reload nginx

echo "Đã cài HTTP-only → $OUT . Tiếp theo: sudo EMAIL=... $DEPLOY_DIR/ssl/issue-sync.sh"
