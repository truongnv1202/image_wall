#!/usr/bin/env bash
# Certbot plugin NGINX — dùng python3-certbot-nginx; Certbot sửa cấu hình Nginx tạm để xác thực.
# Yêu cầu: Nginx đang chạy và đã có server { server_name DOMAIN; ... } (vd. bootstrap HTTP-only).
#
# Chỉ xin chứng chỉ (certonly): ít đụng file hơn certbot --nginx (autoconfigure).
#
#   sudo apt install -y python3-certbot-nginx
#   sudo ./deploy/ssl/bootstrap-http-only.sh
#   sudo EMAIL=you@domain.tld ./deploy/ssl/issue-certbot-nginx-plugin.sh
#
# Biến: DOMAIN, EMAIL, BACKEND, NGINX_SITE_OUT — như issue-sync.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib-render-nginx.sh
source "$SCRIPT_DIR/lib-render-nginx.sh"

DOMAIN="${DOMAIN:-tlcand.gamegiaoduc.co}"
EMAIL="${EMAIL:?Đặt EMAIL=you@domain.tld}"
BACKEND="${BACKEND:-127.0.0.1:5000}"
NGINX_SITE_OUT="${NGINX_SITE_OUT:-/etc/nginx/sites-available/$DOMAIN}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chạy bằng sudo." >&2
  exit 1
fi

if ! certbot plugins 2>/dev/null | grep -q nginx; then
  echo "Thiếu plugin nginx. Cài: apt install -y python3-certbot-nginx" >&2
  exit 1
fi

LIVE_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ ! -f "$LIVE_CERT" ]]; then
  echo "==> certbot certonly --nginx cho $DOMAIN"
  certbot certonly \
    --nginx \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring
else
  echo "==> Đã có cert tại $LIVE_CERT — chỉ render lại Nginx."
fi

ensure_certbot_ssl_helpers
render_nginx_ssl_site_from_template "$DEPLOY_DIR" "$DOMAIN" "$BACKEND" "$NGINX_SITE_OUT"

echo "==> Xong (nginx plugin). File site đã được ghi đè bằng template proxy Docker — kiểm tra $NGINX_SITE_OUT"
