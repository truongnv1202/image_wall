#!/bin/sh
set -e
# Named volumes gắn vào /app/data và /app/public/uploads thường là root:root — user nextjs không ghi được → upload / prependImageUrl thất bại.
if [ "$(id -u)" = 0 ]; then
  mkdir -p /app/data /app/public/uploads
  chown -R nextjs:nodejs /app/data /app/public/uploads
  exec gosu nextjs "$0" "$@"
fi
exec "$@"
