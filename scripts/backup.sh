#!/usr/bin/env bash
# backup.sh  -- needs DIRECT_URL in the environment; pg_dump major version >= server version
set -euo pipefail
mkdir -p backups
FILE="backups/campusfind_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "${DIRECT_URL:-postgresql://campusfind:campusfind@localhost:5432/campusfind}" --format=custom --no-owner --no-privileges \
  --schema=public --file="$FILE"
echo "Backup written to $FILE"
