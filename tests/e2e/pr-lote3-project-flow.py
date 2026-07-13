"""
Lote 3 — Projeto → OS → Custo → Margem → Permissões → Multiempresa → Mobile.

Valida o fluxo operacional pós orçamento aprovado/pago usando as fixtures
determinísticas do Lote 1 (seed_fixtures.py):

  Fixtures usadas (env, populadas por scripts/e2e-seed.sh):
    E2E_QUOTE_A_ID / E2E_PROJECT_A_ID / E2E_SO_A_ID
    E2E_COMPANY_A_ID / E2E_COMPANY_B_ID
    E2E_A_USER_ID / E2E_TECH_A_USER_ID / E2E_B_USER_ID
    E2E_FTX_INCOME_A_ID / E2E_FTX_SO_COST_A_ID
    E2E_LABEL_PREFIX / E2E_RUN_ID

  Fixtures opcionais para os cenários UI:
    E2E_A_SUPABASE_SESSION_JSON / E2E_A_SUPABASE_STORAGE_KEY  (mobile)
    E2E_TECH_SUPABASE_SESSION_JSON / E2E_TECH_SUPABASE_STORAGE_KEY  (T3/T6)
    E2E_B_SUPABASE_SESSION_JSON / E2E_B_SUPABASE_STORAGE_KEY  (T7 UI)

Requer psql (PGHOST/PGUSER/PGPASSWORD/PGDATABASE).

Cenários (SKIP claro quando faltam fixtures; sem falso PASS):
  T1  Projeto a partir de quote  — vínculos quote↔project, idempotência
  T2  OS a partir de projeto    — vínculos + presença na lista do projeto
  T3  Técnico em /service-orders/my
  T4  Custo avulso (referencia pr7-so-costs.py; validação leve aqui)
  T5  Margem do projeto (SQL)
  T6  Permissões — técnico não paga OS/PO
  T7  Multiempresa — RLS via psql impersonando cada usuário
  T8  Mobile 320px — /projects/:id, /service-orders/:id/mobile

Teardown: este teste NÃO cria dados persistentes (apenas UPDATE reversível
em quote status para T1). Reverte antes de sair. Falha se leftover>0.
"""
from __future__ import annotations
import asyncio, json, os, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page

sys.path.insert(0, str(Path(__file__).parent))
from _e2e_common import seed_ready, print_summary

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
ARTIFACTS = Path(__file__).parent / "artifacts" / "lote3"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BROWSER = os.environ.get("E2E_BROWSER", "chromium")
RUN = os.environ.get("E2E_RUN_ID") or time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
LABEL = os.environ.get("E2E_LABEL_PREFIX") or f"[E2E-{RUN}-LOTE3]"


Result = tuple[str, bool, str]

def env(k: str) -> str | None:
    v = os.environ.get(k)
    return v if v else None

def sql(query: str) -> str:
    if not env("PGHOST"):
        raise RuntimeError("psql env ausente (PGHOST/...)")
    r = subprocess.run(
        ["psql", "-tA", "-v", "ON_ERROR_STOP=1", "-c", query],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"psql erro: {r.stderr.strip()}")
    return r.stdout.strip()

def sql_as(user_id: str, query: str) -> str:
    """Executa como usuário autenticado (RLS aplica)."""
    wrapped = (
        "BEGIN; "
        f"SET LOCAL role authenticated; "
        f"SET LOCAL request.jwt.claim.sub = '{user_id}'; "
        f"SET LOCAL request.jwt.claims = '{{\"sub\":\"{user_id}\",\"role\":\"authenticated\"}}'; "
        f"{query}; ROLLBACK;"
    )
    return sql(wrapped)

# ---------------------------------------------------------------------------
# scenarios

def _skip_or_fail(name: str, missing: list[str], results: list) -> bool:
    """When seed ready, missing fixture = FAIL. Else SKIP (ok=True)."""
    miss = [m for m in missing if not env(m)]
    if not miss:
        return False
    if seed_ready():
        results.append((name, False, f"FAIL: seed ready mas fixture obrigatória ausente: {', '.join(miss)}"))
    else:
        results.append((name, True, f"SKIP: seed não-ready — {', '.join(miss)} ausente"))
    return True


def t1_project_from_quote(results: list[Result]) -> None:
    if _skip_or_fail("T1 project<->quote", ["E2E_QUOTE_A_ID", "E2E_PROJECT_A_ID"], results):
        return
    quote_id = env("E2E_QUOTE_A_ID"); project_id = env("E2E_PROJECT_A_ID")
    row = sql(
        f"SELECT p.id, p.quote_id, p.customer_id, q.customer_id, q.status "
        f"FROM public.projects p JOIN public.quotes q ON q.id=p.quote_id "
        f"WHERE p.id='{project_id}' AND q.id='{quote_id}';"
    )
    if not row:
        results.append(("T1 project<->quote", False, "vínculo ausente")); return
    parts = row.split("|")
    ok = parts[0] == project_id and parts[1] == quote_id and parts[2] == parts[3]
    dup = sql(f"SELECT COUNT(*) FROM public.projects WHERE quote_id='{quote_id}' AND deleted_at IS NULL;")
    results.append(("T1 project<->quote", ok and dup == "1",
                    f"pid={parts[0]} qid={parts[1]} cust={parts[2]}={parts[3]} count={dup}"))


def t2_os_from_project(results: list[Result]) -> None:
    if _skip_or_fail("T2 OS<-project", ["E2E_PROJECT_A_ID", "E2E_SO_A_ID"], results):
        return
    project_id = env("E2E_PROJECT_A_ID"); so_id = env("E2E_SO_A_ID"); quote_id = env("E2E_QUOTE_A_ID")
    row = sql(
        f"SELECT project_id, quote_id, customer_id, assigned_technician_id "
        f"FROM public.service_orders WHERE id='{so_id}';"
    )
    if not row:
        results.append(("T2 OS<-project", False, "OS ausente")); return
    pid, qid, cid, tech = row.split("|")
    ok = pid == project_id and qid == (quote_id or qid) and cid and tech
    results.append(("T2 OS<-project", ok, f"pid={pid} qid={qid} tech={tech[:8]}…"))

async def t3_technician_my(results: list[Result]) -> None:
    if _skip_or_fail("T3 técnico /my",
                     ["E2E_TECH_SUPABASE_STORAGE_KEY", "E2E_TECH_SUPABASE_SESSION_JSON", "E2E_SO_A_ID"],
                     results):
        return
    key = env("E2E_TECH_SUPABASE_STORAGE_KEY"); sess = env("E2E_TECH_SUPABASE_SESSION_JSON")
    async with async_playwright() as p:
        b = await getattr(p, BROWSER).launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(f"window.localStorage.setItem({json.dumps(key)},{json.dumps(sess)})")
        await page.goto(f"{BASE_URL}/service-orders/my", wait_until="networkidle")
        await page.screenshot(path=str(ARTIFACTS / "t3_tech_my.png"))
        try:
            found = await page.locator("text=E2E-OS-A-0001").first.is_visible(timeout=3_000)
        except Exception:
            found = False
        await b.close()
    results.append(("T3 técnico /my", found, f"OS visível={found}"))

def t4_so_cost(results: list[Result]) -> None:
    if _skip_or_fail("T4 custo OS", ["E2E_FTX_SO_COST_A_ID"], results):
        return
    ftx = env("E2E_FTX_SO_COST_A_ID")
    row = sql(
        f"SELECT type, status, origin, service_order_id, project_id, deleted_at IS NULL "
        f"FROM public.financial_transactions WHERE id='{ftx}';"
    )
    if not row:
        results.append(("T4 custo OS", False, "tx ausente")); return
    t, st, orig, so, pr, alive = row.split("|")
    ok = t == "EXPENSE" and st == "PAID" and orig == "SERVICE_ORDER_COST" and so and pr and alive == "t"
    results.append(("T4 custo OS (fixture)", ok,
                    f"type={t} st={st} origin={orig} so={bool(so)} project={bool(pr)}"))

def t5_project_margin(results: list[Result]) -> None:
    if _skip_or_fail("T5 margem", ["E2E_PROJECT_A_ID"], results):
        return
    project_id = env("E2E_PROJECT_A_ID")
    rev = sql(
        f"SELECT COALESCE(SUM(amount),0) FROM public.financial_transactions "
        f"WHERE project_id='{project_id}' AND type='INCOME' AND status='PAID' AND deleted_at IS NULL;"
    )
    cost_real = sql(
        f"SELECT COALESCE(SUM(amount),0) FROM public.financial_transactions "
        f"WHERE project_id='{project_id}' AND type='EXPENSE' AND status='PAID' "
        f"AND origin='SERVICE_ORDER_COST' AND deleted_at IS NULL;"
    )
    leak = sql(
        f"SELECT COUNT(*) FROM public.financial_transactions "
        f"WHERE project_id='{project_id}' AND origin='PURCHASE_ORDER';"
    )
    lucro = float(rev) - float(cost_real)
    ok = float(rev) >= 50 and float(cost_real) >= 20 and leak == "0"
    results.append(("T5 margem projeto", ok,
                    f"receita={rev} custo_real={cost_real} lucro={lucro} leak_compra={leak}"))

def t6_permissions(results: list[Result]) -> None:
    if _skip_or_fail("T6 permissões", ["E2E_TECH_A_USER_ID"], results):
        return
    tech = env("E2E_TECH_A_USER_ID")
    row = sql(
        f"SELECT COUNT(*) FROM public.user_roles ur "
        f"JOIN public.roles r ON r.id=ur.role_id "
        f"WHERE ur.user_id='{tech}' AND r.name IN ('owner','manager','admin');"
    )
    results.append(("T6 permissões técnico", row == "0",
                    f"papéis privilegiados no técnico={row} (esperado 0)"))

def t7_multi_company(results: list[Result]) -> None:
    if _skip_or_fail("T7 multiempresa",
                     ["E2E_A_USER_ID", "E2E_B_USER_ID", "E2E_QUOTE_A_ID",
                      "E2E_PROJECT_A_ID", "E2E_SO_A_ID", "E2E_FTX_SO_COST_A_ID"],
                     results):
        return
    b = env("E2E_B_USER_ID")
    quote_a = env("E2E_QUOTE_A_ID"); proj_a = env("E2E_PROJECT_A_ID")
    so_a = env("E2E_SO_A_ID"); ftx = env("E2E_FTX_SO_COST_A_ID")
    leaks: list[str] = []
    try:
        for table, rid in [("quotes", quote_a), ("projects", proj_a),
                           ("service_orders", so_a),
                           ("financial_transactions", ftx)]:
            n = sql_as(b, f"SELECT COUNT(*) FROM public.{table} WHERE id='{rid}'")
            if n != "0":
                leaks.append(f"{table}={n}")
    except Exception as e:
        results.append(("T7 multiempresa", False, f"psql erro: {e}")); return
    results.append(("T7 multiempresa RLS", not leaks, f"leaks={leaks}"))

async def t8_mobile(results: list[Result]) -> None:
    if _skip_or_fail("T8 mobile 320px",
                     ["E2E_A_SUPABASE_STORAGE_KEY", "E2E_A_SUPABASE_SESSION_JSON",
                      "E2E_PROJECT_A_ID", "E2E_SO_A_ID"], results):
        return
    key = env("E2E_A_SUPABASE_STORAGE_KEY"); sess = env("E2E_A_SUPABASE_SESSION_JSON")
    proj = env("E2E_PROJECT_A_ID"); so = env("E2E_SO_A_ID")
    failures: list[str] = []

    async with async_playwright() as p:
        b = await getattr(p, BROWSER).launch(headless=True)
        ctx = await b.new_context(viewport={"width": 320, "height": 720})
        page = await ctx.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(f"window.localStorage.setItem({json.dumps(key)},{json.dumps(sess)})")
        for path, name in [(f"/projects/{proj}", "project"),
                           (f"/service-orders/{so}/mobile", "so_mobile"),
                           ("/quotes", "quotes")]:
            try:
                await page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=15_000)
                # overflow horizontal?
                overflow = await page.evaluate(
                    "() => document.documentElement.scrollWidth > window.innerWidth + 4"
                )
                await page.screenshot(path=str(ARTIFACTS / f"t8_{name}.png"))
                if overflow:
                    failures.append(f"{name}:overflow")
            except Exception as e:
                failures.append(f"{name}:{type(e).__name__}")
        await b.close()
    results.append(("T8 mobile 320px", not failures, f"falhas={failures or 'nenhuma'}"))

# ---------------------------------------------------------------------------
# main

async def main() -> int:
    if not env("PGHOST"):
        print("SKIP [lote3]: PGHOST ausente — Lote 3 requer acesso ao banco (psql).")
        print("=== lote3 summary ===  PASS=0 FAIL=0 SKIP=1")
        return 0
    # Fixtures do Lote 1: obrigatórias quando seed ready.
    if not env("E2E_PROJECT_A_ID"):
        if seed_ready():
            print("FAIL [lote3]: seed ready mas fixture obrigatória ausente: E2E_PROJECT_A_ID")
            print("=== lote3 summary ===  PASS=0 FAIL=1 SKIP=0")
            return 1
        print("SKIP [lote3]: fixtures do Lote 1 não carregadas (source /tmp/e2e-fixture.env).")
        print("=== lote3 summary ===  PASS=0 FAIL=0 SKIP=1")
        return 0

    results: list[Result] = []
    t1_project_from_quote(results)
    t2_os_from_project(results)
    await t3_technician_my(results)
    t4_so_cost(results)
    t5_project_margin(results)
    t6_permissions(results)
    t7_multi_company(results)
    await t8_mobile(results)

    print(f"\n=== Lote 3 — Projeto/OS/Custo/Margem — {LABEL} ===")
    for name, ok, note in results:
        tag = "PASS"
        if (note or "").upper().startswith("SKIP"):
            tag = "SKIP"
        elif not ok:
            tag = "FAIL"
        print(f"  [{tag}] {name} — {note}")

    # teardown: nenhum dado criado; verifica ausência de leftovers do label
    leftover = sql(
        f"SELECT COUNT(*) FROM public.financial_transactions "
        f"WHERE description LIKE '{LABEL}%';"
    )
    if leftover != "0":
        print(f"[FAIL] leftover financial_transactions={leftover}")
        results.append(("teardown leftovers", False, f"leftover={leftover}"))

    return print_summary("lote3", results)



if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
