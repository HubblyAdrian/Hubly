#!/usr/bin/env bash
# Build a staging database from this repository, and report honestly how much of
# the migration chain actually applies.
#
#   scripts/staging/apply_all_migrations.sh "postgresql://postgres@127.0.0.1:55432/hubly_staging"
#
# The chain alone cannot build Hubly — `businesses`, `jobs`, `customers` and
# `booking_requests` were created outside version control, so bootstrap_hubly_core.sql
# runs first. Anything that still fails after that is a migration depending on an
# object nothing in this repo creates; those are listed at the end rather than
# hidden, because that list IS the gap between this repo and production.
set -uo pipefail

DB="${1:-postgresql://postgres@127.0.0.1:55432/hubly_staging}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PSQL="${PSQL:-psql}"

echo "=== bootstrap (objects that predate version control) ==="
"$PSQL" "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/staging/bootstrap_hubly_core.sql" >/dev/null 2>&1 \
  && echo "  OK" || { echo "  FAILED — cannot continue"; exit 1; }

ok=0; failed=0; failures=()
echo
echo "=== migration chain ==="
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  if err="$("$PSQL" "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 >/dev/null)"; then
    ok=$((ok+1))
  else
    failed=$((failed+1))
    failures+=("$name :: $(echo "$err" | grep -m1 'ERROR:' | cut -c1-140)")
  fi
done

echo "  applied: $ok    failed: $failed"
if [ "$failed" -gt 0 ]; then
  echo
  echo "=== migrations that could not apply (dependencies absent from this repo) ==="
  printf '  %s\n' "${failures[@]}"
fi

echo
echo "=== One-Off Sessions objects present? ==="
"$PSQL" "$DB" -tAq -c "
  select 'table  ' || table_name from information_schema.tables
   where table_schema='public' and table_name like 'one_off%'
  union all
  select 'column jobs.' || column_name from information_schema.columns
   where table_schema='public' and table_name='jobs' and column_name='one_off_session_id';"
