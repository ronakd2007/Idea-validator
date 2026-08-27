#!/usr/bin/env bash
#
# Backs up the local IdeaValidator database.
#
# The dump lands in OneDrive, so it syncs to the cloud on its own — that is the
# whole point. The code in this repo is already backed up by git; the local
# Postgres container is the only place your ideas, surveys, validations and AI
# reports exist, and nothing was protecting it.
#
# Usage:  bash backup-db.sh
# Restore: bash backup-db.sh --restore <file.sql>

set -euo pipefail

CONTAINER="ideavalidator-postgres"
DB="ideavalidator"
DB_USER="ideavalidator"
BACKUP_DIR="/c/Users/Ronak/OneDrive/Documents/App/IdeaValidator-backups"
KEEP=20

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "The database container '$CONTAINER' is not running."
  echo "Start Docker Desktop, then: docker start $CONTAINER"
  exit 1
fi

# --- restore mode -----------------------------------------------------------
if [ "${1:-}" = "--restore" ]; then
  FILE="${2:-}"
  [ -f "$FILE" ] || { echo "Usage: bash backup-db.sh --restore <file.sql>"; exit 1; }

  # Restores into a scratch database first. Overwriting the live one on a bad
  # file is exactly the failure a backup is supposed to prevent.
  echo "Restoring '$FILE' into scratch database 'restore_check'..."
  docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -q -c "DROP DATABASE IF EXISTS restore_check;"
  docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -q -c "CREATE DATABASE restore_check;"
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d restore_check -q < "$FILE"

  docker exec "$CONTAINER" psql -U "$DB_USER" -d restore_check -c \
    "SELECT (SELECT count(*) FROM \"Idea\") AS ideas, (SELECT count(*) FROM \"User\") AS users, (SELECT count(*) FROM \"ValidationResponse\") AS validations, (SELECT count(*) FROM \"SurveyResponse\") AS responses;"

  echo
  echo "Restored into 'restore_check' — the live database was not touched."
  echo "If those numbers look right, promote it by hand:"
  echo "  docker exec $CONTAINER psql -U $DB_USER -d postgres -c 'ALTER DATABASE \"$DB\" RENAME TO ${DB}_old;'"
  echo "  docker exec $CONTAINER psql -U $DB_USER -d postgres -c 'ALTER DATABASE restore_check RENAME TO \"$DB\";'"
  exit 0
fi

# --- backup mode ------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y-%m-%d_%H%M)
OUT="$BACKUP_DIR/ideavalidator_${STAMP}.sql"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB" > "$OUT"

# A dump that stopped halfway still leaves a plausible-looking file, so the
# footer is checked rather than assumed.
if ! grep -q "PostgreSQL database dump complete" "$OUT"; then
  echo "Dump looks truncated — keeping it as $OUT.broken for inspection."
  mv "$OUT" "$OUT.broken"
  exit 1
fi

SIZE=$(du -h "$OUT" | cut -f1)
IDEAS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -A -c 'SELECT count(*) FROM "Idea";')
RUNS=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -A -c 'SELECT count(*) FROM "AiValidationRun";')

echo "Backed up to: $OUT"
echo "  size $SIZE · $IDEAS ideas · $RUNS AI Deep Dive runs"
echo "  OneDrive syncs this folder, so it is off this machine once syncing finishes."

# Keep the most recent few so this can be run often without filling the disk.
ls -1t "$BACKUP_DIR"/ideavalidator_*.sql 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  echo "  removed old backup: $(basename "$old")"
done
