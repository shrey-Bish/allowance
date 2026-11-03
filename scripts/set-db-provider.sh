#!/usr/bin/env sh
# Switch the Prisma datasource provider (sqlite locally, postgresql when hosted).
# Prisma can't read the provider from an env var, so the deploy build runs:
#   sh scripts/set-db-provider.sh postgresql && prisma generate && prisma db push
set -e
PROVIDER="${1:-sqlite}"
case "$PROVIDER" in sqlite|postgresql) ;; *) echo "usage: $0 sqlite|postgresql"; exit 1;; esac
sed -i.bak -E "s/provider = \"(sqlite|postgresql)\"/provider = \"$PROVIDER\"/" prisma/schema.prisma && rm -f prisma/schema.prisma.bak
echo "prisma datasource provider → $PROVIDER"
