import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

# Authenticated routes that render the AppSidebar (mobile = Sheet)
ROUTES = [
    "/dashboard",
    "/clients",
    "/products",
    "/quotes",
    "/projects",
    "/service-orders",
    "/stock",
    "/suppliers",
    "/settings",
]

results = []

async def restore_session(page):
    key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    sess = os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )

async def open_mobile_menu(page):
    # SidebarTrigger has aria-label "Toggle Sidebar"
    trigger = page.get_by_role("button", name="Toggle Sidebar")
    await trigger.first.click()
    # Wait for Radix Dialog to mount
    await page.wait_for_selector('[role="dialog"]', state="visible", timeout=3000)

async def test_route(page, route):
    r = {"route": route, "opens": False, "esc_closes": False, "focus_trapped": False, "error": None}
    try:
        await page.goto(BASE + route, wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        await open_mobile_menu(page)
        r["opens"] = True
        await page.screenshot(path=str(SHOTS / f"{route.strip('/').replace('/', '_')}_open.png"))

        # Focus trap: Tab repeatedly; active element must stay inside dialog
        trapped = True
        for _ in range(15):
            await page.keyboard.press("Tab")
            inside = await page.evaluate(
                "() => !!document.activeElement?.closest('[role=\"dialog\"]')"
            )
            if not inside:
                trapped = False
                break
        r["focus_trapped"] = trapped

        # Esc closes — dispatch on dialog (locator.press focuses + keydowns)
        await page.locator('[role="dialog"]').first.press("Escape")
        for _ in range(20):
            await page.wait_for_timeout(100)
            if await page.locator('[role="dialog"]').count() == 0:
                r["esc_closes"] = True
                break
    except Exception as e:
        r["error"] = str(e)[:200]
    results.append(r)

async def main():
    browser_name = os.environ.get("E2E_BROWSER", "chromium").lower()
    async with async_playwright() as pw:
        launcher = {"chromium": pw.chromium, "firefox": pw.firefox, "webkit": pw.webkit}[browser_name]
        print(f"Running tests on: {browser_name}")
        browser = await launcher.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 390, "height": 1800},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        )
        page = await ctx.new_page()
        await restore_session(page)

        for route in ROUTES:
            await test_route(page, route)

        await browser.close()

    print(json.dumps(results, indent=2))
    failed = [r for r in results if r["error"] or not (r["opens"] and r["esc_closes"] and r["focus_trapped"])]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILURES:", json.dumps(failed, indent=2))
        exit(1)

asyncio.run(main())
