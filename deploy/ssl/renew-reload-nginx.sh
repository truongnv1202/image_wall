#!/bin/sh
# Gắn vào certbot renew hook để sau mỗi lần gia hạn SSL vẫn reload Nginx đồng bộ.
# Thêm vào /etc/letsencrypt/renewal/<domain>.conf:
#   deploy_hook = /opt/image_wall/deploy/ssl/renew-reload-nginx.sh
# (đường dẫn chỉnh theo nơi đặt repo)

set -e
systemctl reload nginx
