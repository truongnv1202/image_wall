#!/bin/sh
set -e
# Volume Docker thường root:root; user nextjs (1001) phải ghi được /app/data và /app/public/uploads.
mkdir -p /app/data /app/public/uploads

if [ "$(id -u)" = 0 ]; then
  # Gán owner; volume có thể từ chối chown → vẫn chmod để process (gosu nextjs) ghi được.
  chown -R nextjs:nodejs /app/data /app/public/uploads /app/public 2>/dev/null || true
  chmod -R 0777 /app/data /app/public/uploads
  exec gosu nextjs "$0" "$@"
fi

exec "$@"
