#!/usr/bin/env bash
# CI guard: fails the build if the SQL hardening for known security findings
# is missing from supabase/migrations.
#
# Tracked internal_ids:
#   - billing_provider_settings_public_config_no_secret_filter
#   - cnpj_lookup_logs_no_insert_update_policy
#   - has_company_role_cross_join_ambiguity
set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

# Flatten all migration SQL onto single-line stream for multi-line pattern matching.
BLOB="$(cat "$MIGRATIONS_DIR"/*.sql | tr '\n' ' ' | tr -s ' ')"
fail=0

check() {
  local id="$1" pattern="$2"
  if ! grep -Eq "$pattern" <<<"$BLOB"; then
    echo "❌ [$id] missing expected SQL guard matching: $pattern"
    fail=1
  else
    echo "✅ [$id] guard present"
  fi
}

reject() {
  local id="$1" pattern="$2" reason="$3"
  if grep -Eq "$pattern" <<<"$BLOB"; then
    echo "❌ [$id] $reason (pattern: $pattern)"
    fail=1
  fi
}

# 1) billing_provider_settings: column-level GRANT SELECT to authenticated
check "billing_provider_settings_public_config_no_secret_filter" \
  "GRANT SELECT \\([^)]*support_email[^)]*\\) ON public\\.billing_provider_settings TO authenticated"

# ...and no full-row SELECT grant to authenticated may be reintroduced
reject "billing_provider_settings_public_config_no_secret_filter" \
  "GRANT SELECT ON public\\.billing_provider_settings TO authenticated" \
  "full-row SELECT grant reintroduced"

# 2) cnpj_lookup_logs: explicit RESTRICTIVE deny policies
check "cnpj_lookup_logs_no_insert_update_policy" \
  "ON public\\.cnpj_lookup_logs AS RESTRICTIVE FOR INSERT"
check "cnpj_lookup_logs_no_insert_update_policy" \
  "ON public\\.cnpj_lookup_logs AS RESTRICTIVE FOR UPDATE"
check "cnpj_lookup_logs_no_insert_update_policy" \
  "ON public\\.cnpj_lookup_logs AS RESTRICTIVE FOR DELETE"

# 3) has_company_role: latest definition must reference profile_roles
LATEST_HCR="$(printf '%s' "$BLOB" | grep -oE "FUNCTION public\\.has_company_role[^$]*?\\\$function\\\$" | tail -1 || true)"
if [[ -z "$LATEST_HCR" || "$LATEST_HCR" != *profile_roles* ]]; then
  echo "❌ [has_company_role_cross_join_ambiguity] has_company_role no longer references profile_roles"
  fail=1
else
  echo "✅ [has_company_role_cross_join_ambiguity] guard present"
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "Security regression detected. Restore the hardening in a new migration."
  exit 1
fi
echo "All tracked security guards are in place."
