#!/usr/bin/env bash
# Xin chứng chỉ Let's Encrypt (WEBROOT) và cài file Nginx đầy đủ (HTTP→HTTPS + 443 proxy).
#
# Yêu cầu: nginx đã phục vụ /.well-known/acme-challenge/ từ /var/www/certbot (bootstrap-http-only.sh).
#
# Cách khác (không dùng webroot): xem issue-certbot-standalone.sh, issue-certbot-nginx-plugin.sh,
# issue-certbot-docker-standalone.sh trong cùng thư mục.
#
# Cách dùng:
#   sudo EMAIL=admin@example.com ./deploy/ssl/issue-sync.sh
#   sudo DOMAIN=trienlam.gamegiaoduc.co EMAIL=... BACKEND=127.0.0.1:5000 ./deploy/ssl/issue-sync.sh
#
# Biến:
#   DOMAIN   (mặc định trienlam.gamegiaoduc.co)
#   EMAIL    (bắt buộc — Let's Encrypt)
#   WEBROOT  (mặc định /var/www/certbot)
#   BACKEND  (mặc định 127.0.0.1:5000 — upstream Docker nginx trong compose)
#   NGINX_SITE_OUT — file ghi ra (mặc định /etc/nginx/sites-available/$DOMAIN)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib-render-nginx.sh
source "$SCRIPT_DIR/lib-render-nginx.sh"

DOMAIN="${DOMAIN:-trienlam.gamegiaoduc.co}"
WEBROOT="${WEBROOT:-/var/www/certbot}"
BACKEND="${BACKEND:-127.0.0.1:5000}"
NGINX_SITE_OUT="${NGINX_SITE_OUT:-/etc/nginx/sites-available/$DOMAIN}"

if [[ "${EMAIL:-}" == "" ]]; then
  echo "Thiếu EMAIL (Let's Encrypt). Ví dụ: sudo EMAIL=you@domain.tld $0" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chạy bằng sudo (cần certbot + ghi /etc/nginx)." >&2
  exit 1
fi

mkdir -p "$WEBROOT"

LIVE_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ ! -f "$LIVE_CERT" ]]; then
  echo "==> certbot certonly (webroot) cho $DOMAIN"
  certbot certonly \
    --webroot -w "$WEBROOT" \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring
else
  echo "==> Đã có cert tại $LIVE_CERT — bỏ qua certonly (chỉ đồng bộ cấu hình Nginx)."
fi

ensure_certbot_ssl_helpers
render_nginx_ssl_site_from_template "$DEPLOY_DIR" "$DOMAIN" "$BACKEND" "$NGINX_SITE_OUT"

echo "==> Xong (webroot). Renew tự động: certbot renew (cron). Gắn hook reload nginx:"
echo "    echo 'renew_hook = systemctl reload nginx' | sudo tee -a /etc/letsencrypt/renewal/${DOMAIN}.conf"
