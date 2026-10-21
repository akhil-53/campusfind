#!/usr/bin/env bash
# restore.sh <dump file> <target database url>
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo "Usage: ./scripts/restore.sh <dump-file> <target-database-url>"
  exit 1
fi
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$2" "$1"
echo "Restored $1"
