#!/usr/bin/env bash
# Được source bởi các script issue-*.sh — không chạy trực tiếp.

ensure_certbot_ssl_helpers() {
  local OPTS_SSL="/etc/letsencrypt/options-ssl-nginx.conf"
  local DH="/etc/letsencrypt/ssl-dhparams.pem"
  if [[ ! -f "$OPTS_SSL" ]]; then
    echo "==> Tạo $OPTS_SSL tối thiểu (khi chỉ dùng certbot Docker hoặc chưa apt install certbot)"
    mkdir -p /etc/letsencrypt
    printf '%s\n' \
      'ssl_protocols TLSv1.2 TLSv1.3;' \
      'ssl_prefer_server_ciphers off;' \
      >"$OPTS_SSL"
  fi
  if [[ ! -f "$DH" ]]; then
    echo "==> Tạo dhparam (có thể vài phút)…"
    mkdir -p /etc/letsencrypt
    openssl dhparam -out "$DH" 2048
  fi
  return 0
}

# Đối số: DEPLOY_DIR DOMAIN BACKEND [NGINX_SITE_OUT]
render_nginx_ssl_site_from_template() {
  local DEPLOY_DIR="$1"
  local DOMAIN="$2"
  local BACKEND="$3"
  local NGINX_SITE_OUT="${4:-/etc/nginx/sites-available/$DOMAIN}"
  local TEMPLATE="$DEPLOY_DIR/nginx-host/tlcand.gamegiaoduc.co.ssl-sync.template.conf"

  if [[ ! -f "$TEMPLATE" ]]; then
    echo "Không thấy template: $TEMPLATE" >&2
    return 1
  fi

  local TMP
  TMP="$(mktemp)"
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__BACKEND__|$BACKEND|g" "$TEMPLATE" >"$TMP"
  install -m 0644 "$TMP" "$NGINX_SITE_OUT"
  rm -f "$TMP"

  echo "==> Đã ghi $NGINX_SITE_OUT"
  nginx -t
  systemctl reload nginx
  return 0
}
