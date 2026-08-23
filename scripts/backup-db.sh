#!/usr/bin/env bash
#
# Backs up the IdeaValidator production database to a timestamped file.
#
# The connection string is NEVER passed on the command line (it would land in
# shell history and process listings). Put it in .env.production.local, which
# is gitignored:
#
#     PROD_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
#
# Get that value from Render: Dashboard -> your Postgres -> "External Database
# URL". The EXTERNAL one — the internal URL only resolves inside Render.
#
# Usage:  bash scripts/backup-db.sh
#
# Requires Docker (uses the postgres:16 image's pg_dump; nothing to install).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env.production.local"
OUT_DIR="$ROOT/backups"
KEEP=14            # retain this many most-recent dumps
IMAGE="postgres:16-alpine"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo
  echo "Create it with one line (no quotes, no spaces around '='):"
  echo "  PROD_DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require"
  echo
  echo "Copy that from Render -> your Postgres instance -> External Database URL."
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "ERROR: PROD_DATABASE_URL is not set inside $ENV_FILE"
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUT="$OUT_DIR/ideavalidator_${STAMP}.sql"

echo "Dumping production database..."
# --no-owner/--no-acl keep the dump restorable into a different provider
# (Neon, Supabase, a local container) where the original role names don't exist.
if ! docker run --rm -i "$IMAGE" \
      pg_dump --no-owner --no-acl --clean --if-exists "$PROD_DATABASE_URL" > "$OUT" 2>"$OUT.err"; then
  echo "ERROR: pg_dump failed:"
  sed 's/^/    /' "$OUT.err" | head -20
  rm -f "$OUT" "$OUT.err"
  exit 1
fi
rm -f "$OUT.err"

# A dump that "succeeded" but is empty or missing core tables is worse than no
# backup, because it looks like protection. Verify before trusting it.
BYTES=$(wc -c < "$OUT")
if [ "$BYTES" -lt 2000 ]; then
  echo "ERROR: dump is only ${BYTES} bytes — that is not a real backup. Keeping it as $OUT.suspect for inspection."
  mv "$OUT" "$OUT.suspect"
  exit 1
fi

MISSING=""
for t in User Idea Survey SurveyQuestion SurveyResponse SurveyAnswer; do
  grep -q "CREATE TABLE public.\"$t\"" "$OUT" || MISSING="$MISSING $t"
done
if [ -n "$MISSING" ]; then
  echo "WARNING: these expected tables are absent from the dump:$MISSING"
fi

RESPONSES=$(grep -c '^COPY public."SurveyResponse"' "$OUT" || true)

echo
echo "  file:      $OUT"
echo "  size:      $(( BYTES / 1024 )) KB"
echo "  tables:    $(grep -c '^CREATE TABLE' "$OUT" || true)"
echo "  data COPY: $(grep -c '^COPY public\.' "$OUT" || true) table(s) carry rows"
[ "$RESPONSES" -gt 0 ] && echo "  (SurveyResponse rows are included)"

# Retention: keep the newest $KEEP dumps, drop older ones.
COUNT=$(ls -1 "$OUT_DIR"/ideavalidator_*.sql 2>/dev/null | wc -l)
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$OUT_DIR"/ideavalidator_*.sql | tail -n +$((KEEP + 1)) | while read -r old; do
    echo "  pruning old backup: $(basename "$old")"
    rm -f "$old"
  done
fi

echo
echo "Backup complete. $COUNT backup(s) retained in backups/"
