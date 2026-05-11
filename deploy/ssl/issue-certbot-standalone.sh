#!/usr/bin/env bash
# Certbot kiểu STANDALONE — Certbot tự mở máy chủ tạm trên cổng 80 để HTTP-01.
# Cần GIẢI PHÓNG cổng 80 trước khi chạy (thường: systemctl stop nginx).
#
# Không cần webroot /.well-known — thích hợp khi chưa cấu hình challenge hoặc webroot lỗi.
#
#   sudo EMAIL=you@domain.tld ./deploy/ssl/issue-certbot-standalone.sh
#   sudo STOP_CMD="systemctl stop nginx" START_CMD="systemctl start nginx" EMAIL=... ./deploy/ssl/issue-certbot-standalone.sh
#
# Biến:
#   DOMAIN, EMAIL, BACKEND, NGINX_SITE_OUT — như issue-sync.sh
#   STOP_CMD  — lệnh dừng dịch vụ chiếm :80 (mặc định: systemctl stop nginx)
#   START_CMD — lệnh bật lại sau khi xin cert (mặc định: systemctl start nginx)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib-render-nginx.sh
source "$SCRIPT_DIR/lib-render-nginx.sh"

DOMAIN="${DOMAIN:-trienlam.gamegiaoduc.co}"
EMAIL="${EMAIL:?Đặt EMAIL=you@domain.tld}"
BACKEND="${BACKEND:-127.0.0.1:5000}"
NGINX_SITE_OUT="${NGINX_SITE_OUT:-/etc/nginx/sites-available/$DOMAIN}"

STOP_CMD="${STOP_CMD:-systemctl stop nginx}"
START_CMD="${START_CMD:-systemctl start nginx}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chạy bằng sudo." >&2
  exit 1
fi

LIVE_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ ! -f "$LIVE_CERT" ]]; then
  echo "==> Giải phóng cổng 80: $STOP_CMD"
  bash -c "$STOP_CMD" || true

  echo "==> certbot certonly --standalone cho $DOMAIN"
  certbot certonly \
    --standalone \
    --preferred-challenges http \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring

  echo "==> Khởi động lại dịch vụ: $START_CMD"
  bash -c "$START_CMD" || true
else
  echo "==> Đã có cert tại $LIVE_CERT — chỉ render lại Nginx."
fi

ensure_certbot_ssl_helpers
render_nginx_ssl_site_from_template "$DEPLOY_DIR" "$DOMAIN" "$BACKEND" "$NGINX_SITE_OUT"

echo "==> Xong (standalone). Renew: certbot renew — plugin mặc định có thể là standalone; kiểm tra /etc/letsencrypt/renewal/${DOMAIN}.conf"
