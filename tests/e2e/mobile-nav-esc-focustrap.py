import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path(__file__).parent / "artifacts"
SHOTS = OUT / "screenshots"
TRACES = OUT / "traces"
VIDEOS = OUT / "videos"
for p in (SHOTS, TRACES, VIDEOS):
    p.mkdir(parents=True, exist_ok=True)

ROUTES = [
    "/dashboard", "/clients", "/products", "/quotes", "/projects",
    "/service-orders", "/stock", "/suppliers", "/settings",
]

results = []

def slug(route):
    return route.strip("/").replace("/", "_") or "root"

async def restore_session(page):
    key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    sess = os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )

async def open_mobile_menu(page):
    trigger = page.get_by_role("button", name="Toggle Sidebar")
    await trigger.first.click()
    await page.wait_for_selector('[role="dialog"]', state="visible", timeout=3000)

async def test_route(browser, browser_name, route):
    r = {"route": route, "opens": False, "esc_closes": False, "outside_closes": False, "focus_trapped": False, "error": None}
    s = slug(route)
    video_dir = VIDEOS / f"{browser_name}_{s}"
    video_dir.mkdir(parents=True, exist_ok=True)

    ctx = await browser.new_context(
        viewport={"width": 390, "height": 1800},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        record_video_dir=str(video_dir),
    )
    await ctx.tracing.start(screenshots=True, snapshots=True, sources=True)
    page = await ctx.new_page()
    try:
        await restore_session(page)
        await page.goto(BASE + route, wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        await open_mobile_menu(page)
        r["opens"] = True
        await page.screenshot(path=str(SHOTS / f"{browser_name}_{s}_open.png"))

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

        await page.locator('[role="dialog"]').first.press("Escape")
        for _ in range(20):
            await page.wait_for_timeout(100)
            if await page.locator('[role="dialog"]').count() == 0:
                r["esc_closes"] = True
                break

        # Re-open and verify click-outside (Radix overlay) closes the menu
        await open_mobile_menu(page)
        # Radix overlay sits as a sibling of the dialog; click it via pointerdown
        overlay = page.locator('[data-radix-dialog-overlay], [data-state="open"][class*="fixed"][class*="inset-0"]').first
        if await overlay.count() > 0:
            await overlay.click(position={"x": 5, "y": 5}, force=True)
        else:
            # Fallback: click far from the sheet panel
            await page.mouse.click(380, 900)
        for _ in range(20):
            await page.wait_for_timeout(100)
            if await page.locator('[role="dialog"]').count() == 0:
                r["outside_closes"] = True
                break
    except Exception as e:
        r["error"] = str(e)[:200]

    failed = bool(r["error"]) or not (r["opens"] and r["esc_closes"] and r["focus_trapped"])

    if failed:
        try:
            await page.screenshot(path=str(SHOTS / f"FAIL_{browser_name}_{s}.png"), full_page=False)
        except Exception:
            pass
        await ctx.tracing.stop(path=str(TRACES / f"{browser_name}_{s}.zip"))
        await ctx.close()  # finalize video
        # Surface video path for the artifact upload
        try:
            for v in video_dir.glob("*.webm"):
                v.rename(VIDEOS / f"FAIL_{browser_name}_{s}.webm")
        except Exception:
            pass
    else:
        await ctx.tracing.stop()  # discard
        await ctx.close()
        # Remove unneeded video on success
        try:
            for v in video_dir.glob("*.webm"):
                v.unlink()
            video_dir.rmdir()
        except Exception:
            pass

    results.append(r)

async def main():
    browser_name = os.environ.get("E2E_BROWSER", "chromium").lower()
    async with async_playwright() as pw:
        launcher = {"chromium": pw.chromium, "firefox": pw.firefox, "webkit": pw.webkit}[browser_name]
        print(f"Running tests on: {browser_name}")
        browser = await launcher.launch(headless=True)

        for route in ROUTES:
            await test_route(browser, browser_name, route)

        await browser.close()

    print(json.dumps(results, indent=2))
    failed = [r for r in results if r["error"] or not (r["opens"] and r["esc_closes"] and r["focus_trapped"])]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILURES:", json.dumps(failed, indent=2))
        sys.exit(1)

asyncio.run(main())
