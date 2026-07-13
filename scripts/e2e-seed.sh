#!/usr/bin/env bash
# E2E fixture bootstrap — Lote 1.
#
# Modos:
#   scripts/e2e-seed.sh              # teardown + seed + verify + exporta env
#   scripts/e2e-seed.sh print-only   # apenas exporta env determinístico (não altera nada)
#   scripts/e2e-seed.sh teardown     # apenas teardown + verify-clean
#
# SKIP semantics:
#   Se secrets obrigatórios (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/
#   E2E_A_USER_ID/E2E_B_USER_ID) estiverem ausentes, o script:
#     - imprime "SKIP: …" em stderr;
#     - grava E2E_SEED_STATUS=skipped em $GITHUB_ENV (se existir);
#     - retorna exit 0 para não quebrar o job;
#   As suítes Playwright DEVEM checar E2E_SEED_STATUS antes de rodar e emitir
#   SKIP em vez de PASS quando o valor for `skipped`.
#
# Ao rodar de verdade, faz:
#   1) python tests/e2e/seed_fixtures.py --teardown  (clean state, verify=0)
#   2) python tests/e2e/seed_fixtures.py             (seed + imprime env)
#   3) escreve o env em /tmp/e2e-fixture.env e anexa a $GITHUB_ENV
set -euo pipefail

MODE="${1:-full}"
REQUIRED=(PGHOST PGUSER PGPASSWORD PGDATABASE E2E_A_USER_ID E2E_B_USER_ID)

# E2E_RUN_ID isola runs paralelos. Se o workflow não passou, gera fallback
# local no formato "[E2E-local-<ts>]" e exporta para seed/teardown/leftover.
if [ -z "${E2E_RUN_ID:-}" ]; then
  E2E_RUN_ID="[E2E-local-$(date -u +%Y%m%dT%H%M%SZ)-$$]"
fi
export E2E_RUN_ID
echo "e2e-seed: E2E_RUN_ID=$E2E_RUN_ID" >&2
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "E2E_RUN_ID=$E2E_RUN_ID" >> "$GITHUB_ENV"
fi

emit_skip() {
  local reason="$1"
  echo "SKIP: e2e-seed — $reason" >&2
  echo "As suítes E2E devem checar \$E2E_SEED_STATUS antes de rodar (skipped != passed)." >&2
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "E2E_SEED_STATUS=skipped" >> "$GITHUB_ENV"
    echo "E2E_SEED_SKIP_REASON=$reason" >> "$GITHUB_ENV"
  fi
  exit 0
}

missing=()
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then missing+=("$v"); fi
done
if [ "${#missing[@]}" -gt 0 ]; then
  emit_skip "secrets ausentes: ${missing[*]} (ver docs/E2E_FIXTURES.md)"
fi

case "$MODE" in
  print-only)
    python tests/e2e/seed_fixtures.py --print-only > /tmp/e2e-fixture.env
    ;;
  teardown)
    python tests/e2e/seed_fixtures.py --teardown
    exit 0
    ;;
  full|"")
    echo "e2e-seed: teardown estado anterior" >&2
    python tests/e2e/seed_fixtures.py --teardown
    echo "e2e-seed: seeding baseline" >&2
    python tests/e2e/seed_fixtures.py > /tmp/e2e-fixture.env
    ;;
  *)
    echo "modo desconhecido: $MODE" >&2
    exit 2
    ;;
esac

cat /tmp/e2e-fixture.env
if [ -n "${GITHUB_ENV:-}" ]; then
  cat /tmp/e2e-fixture.env >> "$GITHUB_ENV"
  echo "E2E_SEED_STATUS=ready" >> "$GITHUB_ENV"
  echo "e2e-seed: anexou $(wc -l < /tmp/e2e-fixture.env) vars a \$GITHUB_ENV" >&2
fi
