#!/usr/bin/env python3
"""CI guard for known security findings.

Concatenates supabase/migrations/*.sql in chronological (filename) order and
checks the resulting effective schema state for regressions tied to these
internal_ids:
  - billing_provider_settings_public_config_no_secret_filter
  - cnpj_lookup_logs_no_insert_update_policy
  - has_company_role_cross_join_ambiguity
"""
from __future__ import annotations
import glob, os, re, sys

MIG_DIR = "supabase/migrations"

files = sorted(glob.glob(os.path.join(MIG_DIR, "*.sql")))
if not files:
    print("no migrations found", file=sys.stderr)
    sys.exit(1)

blob = "\n".join(open(f, encoding="utf-8").read() for f in files)
flat = re.sub(r"\s+", " ", blob)

failures: list[str] = []

def last(pattern: str) -> int:
    m = None
    for m in re.finditer(pattern, flat, re.IGNORECASE):
        pass
    return m.end() if m else -1

# --- 1) billing_provider_settings: column-level exposure only ---
last_full_grant = last(r"GRANT\s+SELECT\s+ON\s+public\.billing_provider_settings\s+TO\s+authenticated")
last_revoke     = last(r"REVOKE\s+SELECT\s+ON\s+public\.billing_provider_settings\s+FROM\s+authenticated")
last_col_grant  = last(r"GRANT\s+SELECT\s*\([^)]*support_email[^)]*\)\s+ON\s+public\.billing_provider_settings\s+TO\s+authenticated")

if last_col_grant < 0:
    failures.append("[billing_provider_settings_public_config_no_secret_filter] "
                    "column-level GRANT SELECT(...) missing")
elif last_full_grant > max(last_revoke, last_col_grant):
    failures.append("[billing_provider_settings_public_config_no_secret_filter] "
                    "full-row GRANT SELECT to authenticated reintroduced after hardening")

# --- 2) cnpj_lookup_logs: explicit RESTRICTIVE deny policies ---
for verb in ("INSERT", "UPDATE", "DELETE"):
    if not re.search(
        rf"ON\s+public\.cnpj_lookup_logs\s+AS\s+RESTRICTIVE\s+FOR\s+{verb}",
        flat, re.IGNORECASE,
    ):
        failures.append(f"[cnpj_lookup_logs_no_insert_update_policy] "
                        f"RESTRICTIVE deny policy for {verb} missing")

# --- 3) has_company_role: latest definition references profile_roles ---
defs = re.findall(
    r"FUNCTION\s+public\.has_company_role.*?\$function\$",
    flat, re.IGNORECASE | re.DOTALL,
)
if not defs:
    failures.append("[has_company_role_cross_join_ambiguity] has_company_role not defined")
elif "profile_roles" not in defs[-1]:
    failures.append("[has_company_role_cross_join_ambiguity] "
                    "latest has_company_role definition no longer references profile_roles")

if failures:
    print("Security regression detected:\n")
    for f in failures:
        print(f"  ❌ {f}")
    print("\nRestore the hardening in a new migration.")
    sys.exit(1)

print("✅ All tracked security guards are in place.")
