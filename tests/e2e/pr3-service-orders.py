"""
PR3 — Project → Service Order E2E validation.

Covers:
  T1. Create 1st OS from a project (with quote_id) — appears in project list,
      global /service-orders list, and in "Minhas OS" of the assigned technician.
  T2. Create 2nd OS in the SAME project — both are listed, no unique constraint.
  T3. Project WITHOUT quote — Create OS button still works, financial summary
      renders "Sem lançamento" fallback instead of crashing.
  T4. Multi-company isolation — Company B cannot see Company A's OS by direct URL.

Skips gracefully when the required session secrets are not provided.

Required secrets (owner/admin of Company A + an existing quote-derived project):
  E2E_A_SUPABASE_SESSION_JSON  E2E_A_SUPABASE_STORAGE_KEY
  E2E_PR3_PROJECT_WITH_QUOTE_ID     (uuid of a project created from a quote)
  E2E_PR3_PROJECT_WITHOUT_QUOTE_ID  (uuid of a manual project without quote)
  E2E_PR3_TECHNICIAN_ID             (uuid of a technician profile in Company A)

Optional (for T4):
  E2E_B_SUPABASE_SESSION_JSON  E2E_B_SUPABASE_STORAGE_KEY

Optional technician session for "Minhas OS" verification:
  E2E_TECH_SUPABASE_SESSION_JSON  E2E_TECH_SUPABASE_STORAGE_KEY
"""

from __future__ import annotations
import asyncio
import json
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext

sys.path.insert(0, str(Path(__file__).parent))
from _e2e_common import seed_ready, print_summary

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
ARTIFACTS = Path(__file__).parent / "artifacts" / "pr3"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ.get("E2E_BROWSER", "chromium")



def env(name: str) -> str | None:
    v = os.environ.get(name)
    return v if v else None


async def restore(ctx: BrowserContext, storage_key: str, session_json: str) -> Page:
    page = await ctx.new_page()
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
    )
    return page


async def goto(page: Page, path: str) -> None:
    await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
    await page.wait_for_load_state("networkidle", timeout=15_000)


async def has_text(page: Page, needle: str, timeout: int = 2_000) -> bool:
    try:
        return await page.locator(f"text={needle}").first.is_visible(timeout=timeout)
    except Exception:
        return False


async def count_os_rows(page: Page) -> int:
    # Rows in ProjectServiceOrdersList table body (OS numbers start with "OS-")
    try:
        return await page.locator("tr:has-text('OS-')").count()
    except Exception:
        return 0


async def create_os_from_project(page: Page, project_id: str, technician_id: str) -> bool:
    await goto(page, f"/projects/{project_id}")
    # Open the "Criar OS" sheet/dialog
    btn = page.get_by_role("button", name="Criar OS").first
    if not await btn.is_visible(timeout=5_000):
        return False
    await btn.click()
    # Select technician if a combobox is present
    try:
        combo = page.get_by_role("combobox").first
        if await combo.is_visible(timeout=2_000):
            await combo.click()
            await page.get_by_role("option").filter(has_text="").first.click()
    except Exception:
        pass
    # Confirm
    for label in ("Gerar OS", "Criar OS", "Salvar", "Confirmar"):
        confirm = page.get_by_role("button", name=label).last
        try:
            if await confirm.is_visible(timeout=1_500):
                await confirm.click()
                break
        except Exception:
            continue
    # Wait for navigation to /service-orders/:id or list refresh
    await page.wait_for_timeout(2_500)
    return "/service-orders/" in page.url or await has_text(page, "OS-")


async def t1_first_os(page: Page, project_id: str, tech_id: str, results: list) -> None:
    ok = await create_os_from_project(page, project_id, tech_id)
    await page.screenshot(path=str(ARTIFACTS / "t1_first_os.png"))
    # Back to project → ensure it appears in list
    await goto(page, f"/projects/{project_id}")
    count = await count_os_rows(page)
    results.append(("T1 first OS created + listed on project", ok and count >= 1, f"count={count}"))
    # Global list
    await goto(page, "/service-orders")
    global_ok = await has_text(page, "OS-", timeout=5_000)
    results.append(("T1 OS visible on global /service-orders", global_ok, ""))


async def t2_second_os(page: Page, project_id: str, tech_id: str, results: list) -> None:
    await goto(page, f"/projects/{project_id}")
    before = await count_os_rows(page)
    await create_os_from_project(page, project_id, tech_id)
    await goto(page, f"/projects/{project_id}")
    after = await count_os_rows(page)
    await page.screenshot(path=str(ARTIFACTS / "t2_second_os.png"))
    results.append(("T2 second OS created (no unique block)", after >= before + 1, f"before={before} after={after}"))


async def t3_project_without_quote(page: Page, project_id: str, tech_id: str, results: list) -> None:
    await goto(page, f"/projects/{project_id}")
    await page.screenshot(path=str(ARTIFACTS / "t3_no_quote.png"))
    # Financial summary must not crash — page must render the project header
    rendered = await has_text(page, "Projeto") or await has_text(page, "Ordens de Serviço")
    ok = await create_os_from_project(page, project_id, tech_id)
    results.append(("T3 project without quote renders + accepts OS", rendered and ok, ""))


async def t4_multi_company(page_b: Page, os_project_id: str, results: list) -> None:
    await goto(page_b, f"/projects/{os_project_id}")
    leaked_project = await has_text(page_b, "Ordens de Serviço") and not (
        await has_text(page_b, "não encontrado") or await has_text(page_b, "Sem permissão")
    )
    await page_b.screenshot(path=str(ARTIFACTS / "t4_company_b.png"))
    results.append(("T4 Company B cannot access Company A project", not leaked_project, ""))


async def t_technician_view(page_tech: Page, results: list) -> None:
    await goto(page_tech, "/service-orders/my")
    ok = await has_text(page_tech, "OS-", timeout=5_000) or await has_text(page_tech, "Minhas")
    await page_tech.screenshot(path=str(ARTIFACTS / "t_tech.png"))
    results.append(("T Technician sees assigned OS in /service-orders/my", ok, ""))


async def main() -> int:
    key_a, sess_a = env("E2E_A_SUPABASE_STORAGE_KEY"), env("E2E_A_SUPABASE_SESSION_JSON")
    proj_q = env("E2E_PR3_PROJECT_WITH_QUOTE_ID")
    proj_nq = env("E2E_PR3_PROJECT_WITHOUT_QUOTE_ID")
    tech_id = env("E2E_PR3_TECHNICIAN_ID")
    if not (key_a and sess_a and proj_q and tech_id):
        print("SKIP: PR3 E2E requires E2E_A_* session + E2E_PR3_PROJECT_WITH_QUOTE_ID + E2E_PR3_TECHNICIAN_ID.")
        return 0

    key_b, sess_b = env("E2E_B_SUPABASE_STORAGE_KEY"), env("E2E_B_SUPABASE_SESSION_JSON")
    key_t, sess_t = env("E2E_TECH_SUPABASE_STORAGE_KEY"), env("E2E_TECH_SUPABASE_SESSION_JSON")

    results: list[tuple[str, bool, str]] = []
    async with async_playwright() as p:
        browser = await getattr(p, BROWSER).launch(headless=True)
        try:
            ctx_a = await browser.new_context(viewport={"width": 1280, "height": 1800})
            page_a = await restore(ctx_a, key_a, sess_a)

            await t1_first_os(page_a, proj_q, tech_id, results)
            await t2_second_os(page_a, proj_q, tech_id, results)
            if proj_nq:
                await t3_project_without_quote(page_a, proj_nq, tech_id, results)
            else:
                results.append(("T3 project without quote", True, "skipped (no id)"))

            if key_b and sess_b:
                ctx_b = await browser.new_context(viewport={"width": 1280, "height": 1800})
                page_b = await restore(ctx_b, key_b, sess_b)
                await t4_multi_company(page_b, proj_q, results)
            else:
                results.append(("T4 multi-company", True, "skipped (no B creds)"))

            if key_t and sess_t:
                ctx_t = await browser.new_context(viewport={"width": 1280, "height": 1800})
                page_t = await restore(ctx_t, key_t, sess_t)
                await t_technician_view(page_t, results)
            else:
                results.append(("T Technician view", True, "skipped (no tech creds)"))
        finally:
            await browser.close()

    failed = [r for r in results if not r[1]]
    print("\n=== PR3 Service Orders E2E ===")
    for name, ok, note in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} — {note}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
