#!/usr/bin/env bash
# Certbot trong CONTAINER (standalone) — không cần certbot trên host, chỉ cần Docker + cổng 80 rảnh.
#
# Dừng Nginx host (hoặc bất kỳ ai đang listen :80), chạy script, rồi bật lại Nginx.
#
#   sudo EMAIL=you@domain.tld ./deploy/ssl/issue-certbot-docker-standalone.sh
#
# Biến:
#   DOMAIN, EMAIL, BACKEND, NGINX_SITE_OUT
#   CERTBOT_EMAIL — alias của EMAIL nếu muốn

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib-render-nginx.sh
source "$SCRIPT_DIR/lib-render-nginx.sh"

DOMAIN="${DOMAIN:-trienlam.gamegiaoduc.co}"
EMAIL="${EMAIL:?Đặt EMAIL=}"
BACKEND="${BACKEND:-127.0.0.1:5000}"
NGINX_SITE_OUT="${NGINX_SITE_OUT:-/etc/nginx/sites-available/${DOMAIN}.conf}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chạy bằng sudo (cần mount /etc/letsencrypt)." >&2
  exit 1
fi

LE="/etc/letsencrypt"
LE_LIB="/var/lib/letsencrypt"
mkdir -p "$LE" "$LE_LIB"

LIVE_CERT="$LE/live/$DOMAIN/fullchain.pem"
if [[ ! -f "$LIVE_CERT" ]]; then
  echo "==> Chạy certbot/certbot Docker (standalone). Đảm bảo cổng 80 không bị chiếm."
  docker run --rm \
    -p 80:80 \
    -v "$LE:/etc/letsencrypt" \
    -v "$LE_LIB:/var/lib/letsencrypt" \
    certbot/certbot certonly \
    --standalone \
    --preferred-challenges http \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive
else
  echo "==> Đã có cert — chỉ render Nginx."
fi

ensure_certbot_ssl_helpers
render_nginx_ssl_site_from_template "$DEPLOY_DIR" "$DOMAIN" "$BACKEND" "$NGINX_SITE_OUT"

echo "==> Cert lưu tại $LE/live/$DOMAIN/ — renew trên host: docker run ... certbot renew"
