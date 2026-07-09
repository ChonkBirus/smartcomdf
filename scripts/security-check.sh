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
fail=0

check() {
  local id="$1" pattern="$2"
  if ! grep -RIqE "$pattern" "$MIGRATIONS_DIR"; then
    echo "❌ [$id] missing expected SQL guard matching: $pattern"
    fail=1
  else
    echo "✅ [$id] guard present"
  fi
}

# 1) billing_provider_settings: column-level GRANT (no full-row SELECT to authenticated)
check "billing_provider_settings_public_config_no_secret_filter" \
  "GRANT[[:space:]]+SELECT[[:space:]]*\\([^)]*support_email[^)]*\\)[[:space:]]+ON[[:space:]]+public\\.billing_provider_settings[[:space:]]+TO[[:space:]]+authenticated"

if grep -REn "GRANT[[:space:]]+SELECT[[:space:]]+ON[[:space:]]+public\\.billing_provider_settings[[:space:]]+TO[[:space:]]+authenticated" "$MIGRATIONS_DIR" >/dev/null; then
  echo "❌ [billing_provider_settings_public_config_no_secret_filter] full-row SELECT grant reintroduced"
  fail=1
fi

# 2) cnpj_lookup_logs: explicit RESTRICTIVE deny policies for authenticated writes
check "cnpj_lookup_logs_no_insert_update_policy" \
  "ON[[:space:]]+public\\.cnpj_lookup_logs[[:space:]]+AS[[:space:]]+RESTRICTIVE[[:space:]]+FOR[[:space:]]+INSERT"
check "cnpj_lookup_logs_no_insert_update_policy" \
  "ON[[:space:]]+public\\.cnpj_lookup_logs[[:space:]]+AS[[:space:]]+RESTRICTIVE[[:space:]]+FOR[[:space:]]+UPDATE"
check "cnpj_lookup_logs_no_insert_update_policy" \
  "ON[[:space:]]+public\\.cnpj_lookup_logs[[:space:]]+AS[[:space:]]+RESTRICTIVE[[:space:]]+FOR[[:space:]]+DELETE"

# 3) has_company_role: canonical membership must include profile_roles
if ! awk '/FUNCTION[[:space:]]+public\.has_company_role/,/\$function\$;?/' "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -q "profile_roles"; then
  echo "❌ [has_company_role_cross_join_ambiguity] has_company_role no longer references profile_roles"
  fail=1
else
  echo "✅ [has_company_role_cross_join_ambiguity] guard present"
fi

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Security regression detected. Restore the hardening in a new migration."
  exit 1
fi

echo ""
echo "All tracked security guards are in place."
