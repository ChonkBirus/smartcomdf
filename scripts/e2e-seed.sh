#!/usr/bin/env bash
# E2E fixture bootstrap — runs teardown, seed, and exports the fixture env vars.
#
# Usage (inside a GitHub Actions step):
#   scripts/e2e-seed.sh              # teardown + seed + append env to $GITHUB_ENV
#   scripts/e2e-seed.sh print-only   # only append the current fixture env
#
# Required env:
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE   (Supabase DB connection)
#   E2E_A_USER_ID E2E_B_USER_ID                  (auth users to attach)
# Optional:
#   E2E_A_ACCESS_TOKEN E2E_B_ACCESS_TOKEN        (real storage upload)
#   SUPABASE_URL
set -euo pipefail

MODE="${1:-full}"

if [ -z "${PGHOST:-}" ] || [ -z "${E2E_A_USER_ID:-}" ] || [ -z "${E2E_B_USER_ID:-}" ]; then
  echo "e2e-seed: required env missing (PGHOST/E2E_A_USER_ID/E2E_B_USER_ID) — SKIP" >&2
  exit 0
fi

if [ "$MODE" != "print-only" ]; then
  echo "e2e-seed: teardown previous fixture rows" >&2
  python tests/e2e/seed_fixtures.py --teardown
  echo "e2e-seed: seeding fresh fixture" >&2
  python tests/e2e/seed_fixtures.py > /tmp/e2e-fixture.env
else
  python tests/e2e/seed_fixtures.py --print-only > /tmp/e2e-fixture.env
fi

cat /tmp/e2e-fixture.env
if [ -n "${GITHUB_ENV:-}" ]; then
  cat /tmp/e2e-fixture.env >> "$GITHUB_ENV"
  echo "e2e-seed: appended $(wc -l < /tmp/e2e-fixture.env) vars to \$GITHUB_ENV" >&2
fi
