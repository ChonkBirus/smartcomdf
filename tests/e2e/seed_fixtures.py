"""
E2E fixture seeder — Lote 1 (fundação).

Baseline determinístico para as suítes E2E (pr-quote-images.py,
pr3-service-orders.py, multi-company-isolation.py). Cada execução:

  1. faz teardown das linhas do run anterior (mesmos UUIDs derivados);
  2. reinsere o baseline abaixo;
  3. imprime IDs criados em stderr;
  4. verifica leftovers = 0 depois do teardown puro (--teardown / --verify-clean);
  5. exporta um bloco .env com todos os handles usados pelas suítes.

Baseline
--------
- Empresa A + Empresa B (rótulos humanos prefixados por [E2E-<run_id>])
- Perfis (auth.users já existentes):
    E2E_A_USER_ID       → owner/admin da Empresa A
    E2E_TECH_A_USER_ID  → técnico da Empresa A (opcional; default = owner)
    E2E_B_USER_ID       → owner/admin da Empresa B
- Cliente A, Cliente B
- Produto A (com descrição + item_images), Produto B
- (Opcional) upload real de um PNG 1x1 no bucket `product-images` usando
  E2E_A_ACCESS_TOKEN / E2E_B_ACCESS_TOKEN.
- Orçamento A `SENT` + quote_items com description/image_path
- Orçamento A "legacy" sem image_path (fallback)
- Orçamento B `SENT`
- Quote_payment A `APPROVED` com receipt_status APPROVED
- Projeto A (a partir do orçamento A)
- Ordem de Serviço A vinculada ao projeto (técnico atribuído)
- Custo avulso de OS (financial_transactions origin=SERVICE_ORDER_COST)
- Receita de orçamento (financial_transactions origin=QUOTE_INCOME)

Regras
------
- **NUNCA** toca em dados reais fora dos UUIDs derivados do namespace.
- **NUNCA** cria migration.
- Se algum secret obrigatório faltar, sai com **exit 78 (SKIP)** e mensagem clara.
- Antes de encerrar, roda verificação de leftovers = 0 quando em `--teardown`
  ou `--verify-clean`.

Uso
---
  python tests/e2e/seed_fixtures.py                # seed + print env
  python tests/e2e/seed_fixtures.py --print-only   # só imprime env determinístico
  python tests/e2e/seed_fixtures.py --teardown     # remove fixture + verifica clean
  python tests/e2e/seed_fixtures.py --verify-clean # não altera nada, só verifica
"""
from __future__ import annotations
import argparse, base64, os, subprocess, sys, time, urllib.request, uuid
from typing import Iterable

NS = "e2e-fixture"  # namespace determinístico

# run_id afeta apenas rótulos human-readable ([E2E-<run_id>] …), nunca UUIDs
# (senão o teardown não conseguiria limpar linhas de execuções anteriores).
RUN_ID = os.environ.get("E2E_RUN_ID") or time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
LABEL = f"[E2E-{RUN_ID}]"

def _u(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{NS}:{name}"))

IDS = {
    "company_a":        _u("company/A"),
    "company_b":        _u("company/B"),
    "customer_a":       _u("customer/A"),
    "customer_b":       _u("customer/B"),
    "item_a":           _u("item/A"),
    "item_b":           _u("item/B"),
    "img_a":            _u("img/A"),
    "img_b":            _u("img/B"),
    "quote_a":          _u("quote/A"),
    "quote_b":          _u("quote/B"),
    "quote_a_legacy":   _u("quote/A-legacy"),
    "qi_a":             _u("qi/A"),
    "qi_b":             _u("qi/B"),
    "qi_a_legacy":      _u("qi/A-legacy"),
    "token_a":          _u("token/A"),
    "token_b":          _u("token/B"),
    "token_a_legacy":   _u("token/A-legacy"),
    "quote_payment_a":  _u("qpay/A"),
    "project_a":        _u("project/A"),
    "so_a":             _u("so/A"),
    "ftx_income_a":     _u("ftx/A/income"),
    "ftx_so_cost_a":    _u("ftx/A/so-cost"),
}

IMG_PATH_A = f"{IDS['company_a']}/{IDS['item_a']}/fixture.png"
IMG_PATH_B = f"{IDS['company_b']}/{IDS['item_b']}/fixture.png"
RECEIPT_PATH_A = f"{IDS['company_a']}/{IDS['quote_payment_a']}/receipt.png"

PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

REQUIRED_VARS = ("PGHOST", "PGUSER", "PGPASSWORD", "PGDATABASE",
                 "E2E_A_USER_ID", "E2E_B_USER_ID")
SKIP_EXIT = 78  # convenção "neutral/skip" (drone/prove); e2e-seed.sh trata isso

# ---------------------------------------------------------------------------
# helpers

def psql(sql: str) -> str:
    r = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit(f"psql failed: {sql[:160]}")
    return r.stdout.strip()

def _check_required_env() -> None:
    missing = [n for n in REQUIRED_VARS if not os.environ.get(n)]
    if not missing:
        return
    sys.stderr.write(
        "SKIP: seed_fixtures.py — variáveis obrigatórias ausentes:\n"
        + "".join(f"  - {n}\n" for n in missing)
        + "Configure os secrets E2E_PGHOST/E2E_PGPORT/E2E_PGUSER/E2E_PGPASSWORD/\n"
          "E2E_PGDATABASE/E2E_A_USER_ID/E2E_B_USER_ID (ver docs/E2E_FIXTURES.md).\n"
          "Saindo com exit 78 (skip) — NÃO é PASS.\n"
    )
    sys.exit(SKIP_EXIT)

def _tech_user_id(default_owner: str) -> str:
    """Técnico da Empresa A: usa E2E_TECH_A_USER_ID se existir; senão reusa o owner."""
    return os.environ.get("E2E_TECH_A_USER_ID") or default_owner

# ---------------------------------------------------------------------------
# teardown + verify

_ID_TUPLE = lambda keys: ",".join(f"'{IDS[k]}'" for k in keys)

def teardown() -> None:
    # ordem manual para respeitar FKs sem depender só do CASCADE
    psql(f"""
      DELETE FROM public.financial_transactions
        WHERE id IN ({_ID_TUPLE(['ftx_income_a','ftx_so_cost_a'])});
      DELETE FROM public.service_orders  WHERE id IN ({_ID_TUPLE(['so_a'])});
      DELETE FROM public.projects        WHERE id IN ({_ID_TUPLE(['project_a'])});
      DELETE FROM public.quote_payments  WHERE id IN ({_ID_TUPLE(['quote_payment_a'])});
      DELETE FROM public.quotes          WHERE id IN ({_ID_TUPLE(['quote_a','quote_b','quote_a_legacy'])});
      DELETE FROM public.items           WHERE id IN ({_ID_TUPLE(['item_a','item_b'])});
      DELETE FROM public.customers       WHERE id IN ({_ID_TUPLE(['customer_a','customer_b'])});
      UPDATE public.profiles SET company_id = NULL
        WHERE company_id IN ({_ID_TUPLE(['company_a','company_b'])});
      DELETE FROM public.companies       WHERE id IN ({_ID_TUPLE(['company_a','company_b'])});
    """)
    print("teardown ok", file=sys.stderr)

def verify_clean() -> None:
    """Falha se qualquer tabela ainda contiver linhas do namespace da fixture."""
    checks = [
        ("companies",             [IDS['company_a'], IDS['company_b']]),
        ("customers",             [IDS['customer_a'], IDS['customer_b']]),
        ("items",                 [IDS['item_a'], IDS['item_b']]),
        ("quotes",                [IDS['quote_a'], IDS['quote_b'], IDS['quote_a_legacy']]),
        ("quote_payments",        [IDS['quote_payment_a']]),
        ("projects",              [IDS['project_a']]),
        ("service_orders",        [IDS['so_a']]),
        ("financial_transactions",[IDS['ftx_income_a'], IDS['ftx_so_cost_a']]),
    ]
    leftovers: list[tuple[str,int]] = []
    for table, ids in checks:
        ids_sql = ",".join(f"'{i}'" for i in ids)
        n = int(psql(f"SELECT count(*) FROM public.{table} WHERE id IN ({ids_sql});") or "0")
        if n:
            leftovers.append((table, n))
    if leftovers:
        for t, n in leftovers:
            sys.stderr.write(f"leftover: {t} = {n}\n")
        raise SystemExit("verify-clean FAILED — linhas remanescentes do fixture.")
    print("verify-clean ok — leftovers=0", file=sys.stderr)

# ---------------------------------------------------------------------------
# seed

def report_ids() -> None:
    sys.stderr.write("---- fixture IDs (label={} ) ----\n".format(LABEL))
    for k, v in IDS.items():
        sys.stderr.write(f"  {k:<18}= {v}\n")
    sys.stderr.write("--------------------------------\n")

def upload_image(supabase_url: str, access_token: str, bucket: str, path: str) -> bool:
    url = f"{supabase_url}/storage/v1/object/{bucket}/{path}"
    req = urllib.request.Request(
        url, data=PNG_1x1, method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "image/png",
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return 200 <= r.status < 300
    except Exception as e:
        sys.stderr.write(f"upload {bucket}/{path} failed: {e}\n")
        return False

def seed(user_a: str, user_b: str, supabase_url: str,
         token_a: str | None, token_b: str | None) -> None:
    teardown()
    tech_a = _tech_user_id(user_a)

    # 1) companies
    psql(f"""
      INSERT INTO public.companies (id, corporate_name, trade_name, status)
      VALUES
        ('{IDS['company_a']}','{LABEL} Company A','A','active'),
        ('{IDS['company_b']}','{LABEL} Company B','B','active');
    """)

    # 2) profiles (owners + técnico A)
    profiles: list[tuple[str,str,str]] = [
        (user_a, IDS['company_a'], f"{LABEL} Owner A"),
        (user_b, IDS['company_b'], f"{LABEL} Owner B"),
    ]
    if tech_a != user_a:
        profiles.append((tech_a, IDS['company_a'], f"{LABEL} Tech A"))
    for uid, cid, name in profiles:
        psql(f"""
          INSERT INTO public.profiles (id, company_id, full_name, email, active)
          VALUES ('{uid}','{cid}','{name}','e2e-{uid[:8]}@example.com', true)
          ON CONFLICT (id) DO UPDATE
            SET company_id = EXCLUDED.company_id,
                full_name  = EXCLUDED.full_name,
                active     = true;
        """)

    # 3) customers
    psql(f"""
      INSERT INTO public.customers (id, company_id, customer_type, name, cpf_cnpj)
      VALUES
        ('{IDS['customer_a']}','{IDS['company_a']}','INDIVIDUAL','{LABEL} Customer A','00000000000'),
        ('{IDS['customer_b']}','{IDS['company_b']}','INDIVIDUAL','{LABEL} Customer B','00000000000');
    """)

    # 4) items + imagens primárias
    psql(f"""
      INSERT INTO public.items
        (id, company_id, name, description, unit, sale_price, cost_price, item_type, controls_stock)
      VALUES
        ('{IDS['item_a']}','{IDS['company_a']}','{LABEL} Product A','Descrição fixture A','UN',100,50,'PRODUCT',false),
        ('{IDS['item_b']}','{IDS['company_b']}','{LABEL} Product B','Descrição fixture B','UN',200,80,'PRODUCT',false);

      INSERT INTO public.item_images
        (id, company_id, item_id, file_url, file_path, file_name, is_primary)
      VALUES
        ('{IDS['img_a']}','{IDS['company_a']}','{IDS['item_a']}','', '{IMG_PATH_A}','fixture.png', true),
        ('{IDS['img_b']}','{IDS['company_b']}','{IDS['item_b']}','', '{IMG_PATH_B}','fixture.png', true);
    """)

    # 5) quotes + items
    psql(f"""
      INSERT INTO public.quotes
        (id, company_id, customer_id, quote_number, status, public_token, total_amount, items_subtotal)
      VALUES
        ('{IDS['quote_a']}','{IDS['company_a']}','{IDS['customer_a']}','E2E-A-0001','SENT','{IDS['token_a']}',100,100),
        ('{IDS['quote_b']}','{IDS['company_b']}','{IDS['customer_b']}','E2E-B-0001','SENT','{IDS['token_b']}',200,200),
        ('{IDS['quote_a_legacy']}','{IDS['company_a']}','{IDS['customer_a']}','E2E-A-LEG','SENT','{IDS['token_a_legacy']}',100,100);

      INSERT INTO public.quote_items
        (id, company_id, quote_id, item_id, kind, name, description, quantity, unit_price, total, position, image_path)
      VALUES
        ('{IDS['qi_a']}','{IDS['company_a']}','{IDS['quote_a']}','{IDS['item_a']}','PRODUCT','{LABEL} Product A','Descrição fixture A',1,100,100,0,'{IMG_PATH_A}'),
        ('{IDS['qi_b']}','{IDS['company_b']}','{IDS['quote_b']}','{IDS['item_b']}','PRODUCT','{LABEL} Product B','Descrição fixture B',1,200,200,0,'{IMG_PATH_B}'),
        ('{IDS['qi_a_legacy']}','{IDS['company_a']}','{IDS['quote_a_legacy']}','{IDS['item_a']}','PRODUCT','{LABEL} Product A (legacy)','Sem snapshot',1,100,100,0,NULL);
    """)

    # 6) pagamento aprovado com comprovante (para cenário 4)
    psql(f"""
      INSERT INTO public.quote_payments
        (id, company_id, quote_id, customer_id, payment_type, payment_method,
         payment_status, amount, payer_name, payment_date,
         receipt_file_path, receipt_mime_type, receipt_size, receipt_status,
         receipt_uploaded_at, receipt_reviewed_at, paid_at)
      VALUES
        ('{IDS['quote_payment_a']}','{IDS['company_a']}','{IDS['quote_a']}','{IDS['customer_a']}',
         'DOWN_PAYMENT','PIX','APPROVED', 50, '{LABEL} Payer', CURRENT_DATE,
         '{RECEIPT_PATH_A}', 'image/png', {len(PNG_1x1)}, 'APPROVED',
         now(), now(), now());
    """)

    # 7) projeto (a partir do orçamento A) + OS vinculada + técnico
    psql(f"""
      INSERT INTO public.projects
        (id, company_id, quote_id, customer_id, project_number, title,
         status, total_amount, down_payment_amount, remaining_amount,
         responsible_user_id)
      VALUES
        ('{IDS['project_a']}','{IDS['company_a']}','{IDS['quote_a']}','{IDS['customer_a']}',
         'E2E-PRJ-A-0001','{LABEL} Project A',
         'READY_TO_SCHEDULE', 100, 50, 50, '{user_a}');

      INSERT INTO public.service_orders
        (id, company_id, project_id, quote_id, customer_id,
         service_order_number, title, status, assigned_technician_id, responsible_user_id)
      VALUES
        ('{IDS['so_a']}','{IDS['company_a']}','{IDS['project_a']}','{IDS['quote_a']}','{IDS['customer_a']}',
         'E2E-OS-A-0001','{LABEL} Service Order A',
         'SCHEDULED', '{tech_a}', '{user_a}');
    """)

    # 8) transações financeiras (rastreabilidade PR6): receita + custo avulso de OS
    psql(f"""
      INSERT INTO public.financial_transactions
        (id, company_id, type, description, amount, status,
         quote_id, project_id, service_order_id, origin, paid_at)
      VALUES
        ('{IDS['ftx_income_a']}','{IDS['company_a']}','INCOME',
         '{LABEL} Receita orçamento A', 50, 'PAID',
         '{IDS['quote_a']}','{IDS['project_a']}', NULL, 'QUOTE_INCOME', now()),
        ('{IDS['ftx_so_cost_a']}','{IDS['company_a']}','EXPENSE',
         '{LABEL} Custo avulso OS A', 20, 'PAID',
         NULL,'{IDS['project_a']}','{IDS['so_a']}','SERVICE_ORDER_COST', now());
    """)

    # 9) storage real (opcional)
    if token_a:
        print(f"upload product-images/A: {'ok' if upload_image(supabase_url, token_a, 'product-images', IMG_PATH_A) else 'FAIL'}", file=sys.stderr)
        print(f"upload payment-receipts/A: {'ok' if upload_image(supabase_url, token_a, 'payment-receipts', RECEIPT_PATH_A) else 'FAIL'}", file=sys.stderr)
    if token_b:
        print(f"upload product-images/B: {'ok' if upload_image(supabase_url, token_b, 'product-images', IMG_PATH_B) else 'FAIL'}", file=sys.stderr)

    report_ids()

# ---------------------------------------------------------------------------
# env export

def print_env() -> None:
    lines = [
        f"E2E_RUN_ID={RUN_ID}",
        f"E2E_LABEL_PREFIX=[E2E-{RUN_ID}]",
        f"E2E_QUOTE_TOKEN_A={IDS['token_a']}",
        f"E2E_QUOTE_IMAGE_PATH_A={IMG_PATH_A}",
        f"E2E_QUOTE_TOKEN_B={IDS['token_b']}",
        f"E2E_QUOTE_FOREIGN_IMAGE_PATH={IMG_PATH_B}",
        f"E2E_LEGACY_QUOTE_TOKEN={IDS['token_a_legacy']}",
        f"E2E_COMPANY_A_ID={IDS['company_a']}",
        f"E2E_COMPANY_B_ID={IDS['company_b']}",
        f"E2E_CUSTOMER_A_ID={IDS['customer_a']}",
        f"E2E_CUSTOMER_B_ID={IDS['customer_b']}",
        f"E2E_ITEM_A_ID={IDS['item_a']}",
        f"E2E_ITEM_B_ID={IDS['item_b']}",
        f"E2E_QUOTE_PAYMENT_A_ID={IDS['quote_payment_a']}",
        f"E2E_RECEIPT_PATH_A={RECEIPT_PATH_A}",
        f"E2E_PROJECT_A_ID={IDS['project_a']}",
        f"E2E_SO_A_ID={IDS['so_a']}",
        f"E2E_FTX_INCOME_A_ID={IDS['ftx_income_a']}",
        f"E2E_FTX_SO_COST_A_ID={IDS['ftx_so_cost_a']}",
    ]
    print("\n".join(lines))

# ---------------------------------------------------------------------------
# main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--teardown", action="store_true")
    ap.add_argument("--verify-clean", action="store_true")
    ap.add_argument("--print-only", action="store_true")
    args = ap.parse_args()

    if args.print_only:
        print_env(); return

    _check_required_env()

    if args.verify_clean:
        verify_clean(); return

    if args.teardown:
        teardown(); verify_clean(); return

    supabase_url = os.environ.get("SUPABASE_URL") or "https://ifhtznbbvjwejxlgpana.supabase.co"
    seed(
        os.environ["E2E_A_USER_ID"], os.environ["E2E_B_USER_ID"], supabase_url,
        os.environ.get("E2E_A_ACCESS_TOKEN"),
        os.environ.get("E2E_B_ACCESS_TOKEN"),
    )
    print_env()


if __name__ == "__main__":
    main()
