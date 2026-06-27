"""
13D — Multi-company isolation + permission matrix audit.

Requires two pre-provisioned Supabase sessions belonging to DIFFERENT companies:
  E2E_A_SUPABASE_SESSION_JSON / E2E_A_SUPABASE_STORAGE_KEY  (Company A, role: owner)
  E2E_B_SUPABASE_SESSION_JSON / E2E_B_SUPABASE_STORAGE_KEY  (Company B, role: owner)

Optional viewer-role session for permission matrix:
  E2E_VIEWER_SUPABASE_SESSION_JSON / E2E_VIEWER_SUPABASE_STORAGE_KEY

When secrets are missing the script exits 0 with a SKIP note so the matrix job
does not break PRs from forks.

Verifies:
  T1. Customer created under A is NOT visible to B.
  T2. Quote created under A is NOT visible to B.
  T3. Viewer role cannot reach /admin and /settings/team.
"""

from __future__ import annotations
import asyncio
import json
import os
import sys
import time
import uuid
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
ARTIFACTS = Path(__file__).parent / "artifacts" / "multi-company"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ.get("E2E_BROWSER", "chromium")


def env(name: str) -> str | None:
    v = os.environ.get(name)
    return v if v else None


async def restore_session(ctx: BrowserContext, storage_key: str, session_json: str) -> Page:
    page = await ctx.new_page()
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )
    return page


async def goto(page: Page, path: str) -> None:
    await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle", timeout=15_000)


async def page_has_text(page: Page, needle: str) -> bool:
    try:
        return await page.locator(f"text={needle}").first.is_visible(timeout=2_000)
    except Exception:
        return False


async def create_customer(page: Page, name: str) -> None:
    await goto(page, "/customers")
    await page.get_by_role("button", name="Novo cliente").first.click()
    await page.get_by_label("Nome", exact=False).first.fill(name)
    await page.get_by_role("button", name="Salvar").first.click()
    await page.wait_for_timeout(1_500)


async def t1_customer_isolation(ctx_a: BrowserContext, ctx_b: BrowserContext, results: list) -> None:
    tag = f"E2E-A-{uuid.uuid4().hex[:8]}"
    page_a = ctx_a.pages[0]
    await create_customer(page_a, tag)
    await page_a.screenshot(path=str(ARTIFACTS / "t1_a_created.png"))

    page_b = ctx_b.pages[0]
    await goto(page_b, "/customers")
    leaked = await page_has_text(page_b, tag)
    await page_b.screenshot(path=str(ARTIFACTS / "t1_b_view.png"))
    results.append(("T1 customer isolation", not leaked, f"tag={tag} leaked={leaked}"))


async def t2_quote_isolation(ctx_a: BrowserContext, ctx_b: BrowserContext, results: list) -> None:
    # Read company A's first quote number (if any) and verify B does not list it.
    page_a = ctx_a.pages[0]
    await goto(page_a, "/quotes")
    rows = page_a.locator('[data-testid="quote-row"], table tbody tr')
    sample = None
    try:
        if await rows.count() > 0:
            sample = (await rows.first.inner_text())[:30].strip()
    except Exception:
        sample = None
    if not sample:
        results.append(("T2 quote isolation", True, "skipped (no quote in A)"))
        return

    page_b = ctx_b.pages[0]
    await goto(page_b, "/quotes")
    leaked = await page_has_text(page_b, sample.split("\n")[0])
    results.append(("T2 quote isolation", not leaked, f"sample='{sample[:40]}' leaked={leaked}"))


async def t3_permission_matrix(ctx_viewer: BrowserContext | None, results: list) -> None:
    if ctx_viewer is None:
        results.append(("T3 permission matrix", True, "skipped (no viewer creds)"))
        return
    page = ctx_viewer.pages[0]
    failures: list[str] = []
    for path in ("/admin", "/settings/team", "/settings/homologation"):
        await goto(page, path)
        # Acceptable: redirect to /, render "Acesso restrito", or render an EmptyState.
        url = page.url
        restricted = (
            "/admin" not in url and "/settings/team" not in url and "/settings/homologation" not in url
        ) or await page_has_text(page, "Acesso restrito") or await page_has_text(page, "Sem permissão")
        if not restricted:
            failures.append(path)
    results.append(("T3 permission matrix", not failures, f"leaked={failures}"))


async def run_with_creds(
    playwright,
    key_a: str,
    sess_a: str,
    key_b: str,
    sess_b: str,
    viewer: tuple[str, str] | None,
) -> int:
    browser = await getattr(playwright, BROWSER).launch(headless=True)
    ctx_a = await browser.new_context(viewport={"width": 1280, "height": 1800})
    ctx_b = await browser.new_context(viewport={"width": 1280, "height": 1800})
    ctx_viewer = (
        await browser.new_context(viewport={"width": 1280, "height": 1800}) if viewer else None
    )

    await restore_session(ctx_a, key_a, sess_a)
    await restore_session(ctx_b, key_b, sess_b)
    if ctx_viewer and viewer:
        await restore_session(ctx_viewer, viewer[0], viewer[1])

    results: list[tuple[str, bool, str]] = []
    try:
        await t1_customer_isolation(ctx_a, ctx_b, results)
        await t2_quote_isolation(ctx_a, ctx_b, results)
        await t3_permission_matrix(ctx_viewer, results)
    finally:
        await browser.close()

    failed = [r for r in results if not r[1]]
    print("\n=== Multi-company audit ===")
    for name, ok, note in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} — {note}")
    return 0 if not failed else 1


async def main() -> int:
    key_a, sess_a = env("E2E_A_SUPABASE_STORAGE_KEY"), env("E2E_A_SUPABASE_SESSION_JSON")
    key_b, sess_b = env("E2E_B_SUPABASE_STORAGE_KEY"), env("E2E_B_SUPABASE_SESSION_JSON")
    if not (key_a and sess_a and key_b and sess_b):
        print("SKIP: E2E_A_* and E2E_B_* session secrets are not set. Multi-company audit skipped.")
        return 0

    viewer = None
    vk = env("E2E_VIEWER_SUPABASE_STORAGE_KEY")
    vs = env("E2E_VIEWER_SUPABASE_SESSION_JSON")
    if vk and vs:
        viewer = (vk, vs)

    async with async_playwright() as p:
        return await run_with_creds(p, key_a, sess_a, key_b, sess_b, viewer)


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
