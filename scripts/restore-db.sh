#!/usr/bin/env bash
#
# Restores a backup into a NEW database (e.g. Neon) and verifies the copy by
# comparing row counts against the source. Use this to migrate off a host
# whose free tier is ending, without trusting that "it probably worked".
#
# Setup — add a second line to .env.production.local (gitignored):
#
#     PROD_DATABASE_URL=postgresql://...        # the OLD database (source)
#     TARGET_DATABASE_URL=postgresql://...      # the NEW database (Neon)
#
# For Neon, use the DIRECT connection string, not the "-pooler" one — pooled
# connections don't support the statements a restore needs.
#
# Usage:  bash scripts/restore-db.sh [path/to/backup.sql]
#         (defaults to the most recent file in backups/)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.production.local"
IMAGE="postgres:16-alpine"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found. See scripts/backup-db.sh for the format."; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

[ -n "${TARGET_DATABASE_URL:-}" ] || { echo "ERROR: TARGET_DATABASE_URL is not set in $ENV_FILE"; exit 1; }

# Refuse to write over the source. Restoring onto the live database would
# wipe it and replace it with a snapshot — the exact disaster this is meant
# to prevent.
if [ "${PROD_DATABASE_URL:-}" = "$TARGET_DATABASE_URL" ]; then
  echo "ERROR: TARGET_DATABASE_URL is identical to PROD_DATABASE_URL."
  echo "That would overwrite your live database. Aborting."
  exit 1
fi

DUMP="${1:-$(ls -1t "$ROOT"/backups/ideavalidator_*.sql 2>/dev/null | head -1)}"
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "ERROR: no backup file found. Run scripts/backup-db.sh first."; exit 1; }

# Show the destination host (never the password) so a mistake is visible
# before anything is written.
TARGET_HOST=$(echo "$TARGET_DATABASE_URL" | sed -E 's#.*@([^/?]+).*#\1#')
echo "About to restore:"
echo "   from : $(basename "$DUMP") ($(( $(wc -c < "$DUMP") / 1024 )) KB)"
echo "   into : $TARGET_HOST"
echo
read -r -p "Type 'yes' to continue: " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }

echo
echo "Restoring..."
docker run --rm -i "$IMAGE" psql -v ON_ERROR_STOP=0 -q "$TARGET_DATABASE_URL" < "$DUMP" > /tmp/iv_restore.log 2>&1 || true

# "already exists"/"does not exist" noise is expected from --clean --if-exists
# against a fresh database; anything else is worth showing.
REAL_ERRORS=$(grep -i "^ERROR" /tmp/iv_restore.log | grep -viE "does not exist|already exists" || true)
if [ -n "$REAL_ERRORS" ]; then
  echo "Errors during restore:"
  echo "$REAL_ERRORS" | head -10 | sed 's/^/    /'
fi

echo
echo "=== VERIFYING: row counts source vs target ==="
MISMATCH=0
for T in User Idea Survey SurveyQuestion SurveyQuestionOption SurveyResponse SurveyAnswer SurveySession ValidationResponse; do
  A=$(docker run --rm -i "$IMAGE" psql -tAc "SELECT count(*) FROM public.\"$T\";" "${PROD_DATABASE_URL:-}" 2>/dev/null | tr -d '[:space:]' || echo "?")
  B=$(docker run --rm -i "$IMAGE" psql -tAc "SELECT count(*) FROM public.\"$T\";" "$TARGET_DATABASE_URL" 2>/dev/null | tr -d '[:space:]' || echo "?")
  if [ "$A" = "$B" ] && [ "$A" != "?" ]; then
    printf "  OK       %-22s %s\n" "$T" "$A"
  else
    printf "  MISMATCH %-22s source=%s target=%s\n" "$T" "$A" "$B"
    MISMATCH=1
  fi
done

echo
if [ "$MISMATCH" -eq 0 ]; then
  echo "All tables match. The new database is a faithful copy."
  echo
  echo "NEXT: point the app at it —"
  echo "  1. Render dashboard -> your web service -> Environment"
  echo "  2. Set DATABASE_URL to the new connection string (the POOLED one is fine for the app)"
  echo "  3. Save; Render redeploys automatically"
  echo "  4. Check https://idea-validator-6ihk.onrender.com/api/health, then open the site"
  echo
  echo "Keep the old database until you've confirmed the app works on the new one."
else
  echo "Row counts do NOT match — do not switch the app over yet."
fi
