"""Shared helpers for E2E scripts.

Enforces the rule: when E2E_SEED_STATUS == "ready", missing required
fixtures MUST fail (never silently PASS). When the seed did not run
(status missing/"skipped"), scripts exit 0 with a clear SKIP note.
"""
from __future__ import annotations
import os
import sys
from typing import Iterable


def seed_status() -> str:
    """Return canonical seed status: 'ready' | 'skipped' | 'unknown'."""
    v = (os.environ.get("E2E_SEED_STATUS") or "").strip().lower()
    if v in ("ready", "skipped"):
        return v
    return "unknown"


def seed_ready() -> bool:
    return seed_status() == "ready"


def skip_if_seed_not_ready(script_name: str) -> None:
    """Exit 0 with a SKIP message when the seed did not populate fixtures.

    Never call this when seed_status == 'ready'; that would mask a real
    failure. Intended to be called at the top of main() before any check
    that would otherwise report false PASS.
    """
    st = seed_status()
    if st == "ready":
        return  # continue running scenarios
    reason = os.environ.get("E2E_SEED_SKIP_REASON") or (
        "E2E_SEED_STATUS != ready (secrets ausentes ou seed não rodou)"
    )
    print(f"SKIP [{script_name}]: seed não-ready — {reason} (status={st})")
    print(f"=== {script_name} summary ===  PASS=0 FAIL=0 SKIP=1")
    sys.exit(0)


def require_fixtures(missing: Iterable[str], scenario: str) -> str | None:
    """Return a FAIL note if seed is ready and `missing` is non-empty.

    When the seed is ready, ANY missing fixture is a FAIL. When the seed
    is not ready, callers should have already exited via
    `skip_if_seed_not_ready`; if not, we still return a SKIP-flavoured
    note so results stay consistent.
    """
    miss = [m for m in missing if not os.environ.get(m)]
    if not miss:
        return None
    if seed_ready():
        return f"FAIL: seed ready mas fixture obrigatória ausente: {', '.join(miss)}"
    return f"SKIP: seed não-ready — fixtures ausentes: {', '.join(miss)}"


def print_summary(script_name: str, results: list) -> int:
    """Print PASS/FAIL/SKIP counts and return the appropriate exit code.

    `results` is a list of (name, ok: bool, note: str). A note that
    starts with 'SKIP' is counted as a SKIP (not PASS, not FAIL). Any
    entry with ok=False is a FAIL. Otherwise PASS.

    Exit code:
      * 1 if any FAIL
      * 0 otherwise (even if only SKIPs remain)
    """
    pass_ct = fail_ct = skip_ct = 0
    skip_reasons: list[str] = []
    fail_reasons: list[str] = []
    for name, ok, note in results:
        note_s = (note or "").strip()
        if note_s.upper().startswith("SKIP"):
            skip_ct += 1
            skip_reasons.append(f"{name} — {note_s}")
        elif not ok:
            fail_ct += 1
            fail_reasons.append(f"{name} — {note_s}")
        else:
            pass_ct += 1
    print(f"\n=== {script_name} summary ===")
    print(f"  PASS={pass_ct} FAIL={fail_ct} SKIP={skip_ct}")
    print(f"  E2E_SEED_STATUS={seed_status()}")
    if skip_reasons:
        print("  SKIP details:")
        for r in skip_reasons:
            print(f"    - {r}")
    if fail_reasons:
        print("  FAIL details:")
        for r in fail_reasons:
            print(f"    - {r}")
    return 1 if fail_ct else 0
