"""
E2E fixture seeder — multi-company deterministic state.

Purpose
-------
Provision a clean, isolated two-company baseline the E2E suites can rely on
(tests/e2e/pr-quote-images.py, multi-company-isolation.py, pr3-service-orders.py).
Each run wipes the previous fixture rows (by deterministic namespace prefix)
and re-inserts them, so scenarios always start from the same state.

What it creates
---------------
- Company A + Company B (deterministic UUIDs)
- Existing auth users E2E_A_USER_ID / E2E_B_USER_ID are attached as profiles
  of the respective company (users themselves must already exist — the
  auth.admin API is not available on Lovable Cloud).
- One customer per company
- One PRODUCT item per company (with description + a primary item_images row)
- Optionally uploads a real 1x1 PNG to the `product-images` bucket using the
  user's access token, so signed URLs actually resolve.
- One quote per company with one quote_item snapshotting image_path
- One "legacy" quote for company A with NO image_path (fallback scenario)

Outputs
-------
Prints an `.env`-style block with all the variables the E2E suites read:
  E2E_QUOTE_TOKEN_A, E2E_QUOTE_IMAGE_PATH_A,
  E2E_QUOTE_FOREIGN_IMAGE_PATH, E2E_LEGACY_QUOTE_TOKEN, ...

Required env
------------
  PGHOST/PGUSER/PGPASSWORD/PGDATABASE (already set in sandbox)
  E2E_A_USER_ID                       auth.users.id for company A owner
  E2E_B_USER_ID                       auth.users.id for company B owner
Optional
--------
  E2E_A_ACCESS_TOKEN                  user A access_token → real image upload
  E2E_B_ACCESS_TOKEN                  user B access_token → real image upload
  SUPABASE_URL                        defaults to VITE_SUPABASE_URL from .env

Usage
-----
  python tests/e2e/seed_fixtures.py                    # seed + print env
  python tests/e2e/seed_fixtures.py --print-only       # print current values
  python tests/e2e/seed_fixtures.py --teardown         # remove fixture rows
"""
from __future__ import annotations
import argparse, base64, json, os, subprocess, sys, urllib.request, uuid
from pathlib import Path

NS = "e2e-fixture"  # deterministic namespace for all synthetic rows

def _u(name: str) -> str:
    """Deterministic UUID inside the fixture namespace."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{NS}:{name}"))

IDS = {
    "company_a":  _u("company/A"),
    "company_b":  _u("company/B"),
    "customer_a": _u("customer/A"),
    "customer_b": _u("customer/B"),
    "item_a":     _u("item/A"),
    "item_b":     _u("item/B"),
    "img_a":      _u("img/A"),
    "img_b":      _u("img/B"),
    "quote_a":    _u("quote/A"),
    "quote_b":    _u("quote/B"),
    "quote_a_legacy": _u("quote/A-legacy"),
    "qi_a":       _u("qi/A"),
    "qi_b":       _u("qi/B"),
    "qi_a_legacy":_u("qi/A-legacy"),
    "token_a":    _u("token/A"),
    "token_b":    _u("token/B"),
    "token_a_legacy": _u("token/A-legacy"),
}

# Image path lives under bucket product-images (path = key inside bucket)
IMG_PATH_A = f"{IDS['company_a']}/{IDS['item_a']}/fixture.png"
IMG_PATH_B = f"{IDS['company_b']}/{IDS['item_b']}/fixture.png"

PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

def psql(sql: str) -> str:
    r = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit(f"psql failed: {sql[:120]}")
    return r.stdout.strip()

def teardown() -> None:
    # DELETE company rows; cascades wipe profiles/customers/items/quotes/etc.
    psql(f"""
      DELETE FROM public.quotes    WHERE id IN ('{IDS['quote_a']}','{IDS['quote_b']}','{IDS['quote_a_legacy']}');
      DELETE FROM public.items     WHERE id IN ('{IDS['item_a']}','{IDS['item_b']}');
      DELETE FROM public.customers WHERE id IN ('{IDS['customer_a']}','{IDS['customer_b']}');
      UPDATE public.profiles SET company_id = NULL
        WHERE company_id IN ('{IDS['company_a']}','{IDS['company_b']}');
      DELETE FROM public.companies WHERE id IN ('{IDS['company_a']}','{IDS['company_b']}');
    """)
    print("teardown ok", file=sys.stderr)

def upload_image(supabase_url: str, access_token: str, path: str) -> bool:
    url = f"{supabase_url}/storage/v1/object/product-images/{path}"
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
        sys.stderr.write(f"upload {path} failed: {e}\n")
        return False

def seed(user_a: str, user_b: str, supabase_url: str,
         token_a: str | None, token_b: str | None) -> None:
    teardown()

    # 1) companies
    psql(f"""
      INSERT INTO public.companies (id, corporate_name, trade_name, status)
      VALUES
        ('{IDS['company_a']}', 'E2E Company A', 'A', 'active'),
        ('{IDS['company_b']}', 'E2E Company B', 'B', 'active');
    """)

    # 2) attach users as profiles (users must exist in auth.users already)
    for cid, uid in ((IDS['company_a'], user_a), (IDS['company_b'], user_b)):
        psql(f"""
          INSERT INTO public.profiles (id, company_id, full_name, email, active)
          VALUES ('{uid}', '{cid}', 'E2E User', 'e2e-{cid[:8]}@example.com', true)
          ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, active = true;
        """)

    # 3) customers
    psql(f"""
      INSERT INTO public.customers (id, company_id, customer_type, name, cpf_cnpj)
      VALUES
        ('{IDS['customer_a']}','{IDS['company_a']}','INDIVIDUAL','Fixture Customer A','00000000000'),
        ('{IDS['customer_b']}','{IDS['company_b']}','INDIVIDUAL','Fixture Customer B','00000000000');
    """)

    # 4) items + primary image row
    psql(f"""
      INSERT INTO public.items (id, company_id, name, description, unit, sale_price, cost_price, item_type, controls_stock)
      VALUES
        ('{IDS['item_a']}','{IDS['company_a']}','Fixture Product A','Descrição fixture A','UN',100,50,'PRODUCT',false),
        ('{IDS['item_b']}','{IDS['company_b']}','Fixture Product B','Descrição fixture B','UN',200,80,'PRODUCT',false);

      INSERT INTO public.item_images (id, company_id, item_id, file_url, file_path, file_name, is_primary)
      VALUES
        ('{IDS['img_a']}','{IDS['company_a']}','{IDS['item_a']}','', '{IMG_PATH_A}','fixture.png', true),
        ('{IDS['img_b']}','{IDS['company_b']}','{IDS['item_b']}','', '{IMG_PATH_B}','fixture.png', true);
    """)

    # 5) quotes + items (snapshotted image_path)
    psql(f"""
      INSERT INTO public.quotes (id, company_id, customer_id, quote_number, status, public_token, total_amount, items_subtotal)
      VALUES
        ('{IDS['quote_a']}','{IDS['company_a']}','{IDS['customer_a']}','E2E-A-0001','SENT','{IDS['token_a']}',100,100),
        ('{IDS['quote_b']}','{IDS['company_b']}','{IDS['customer_b']}','E2E-B-0001','SENT','{IDS['token_b']}',200,200),
        ('{IDS['quote_a_legacy']}','{IDS['company_a']}','{IDS['customer_a']}','E2E-A-LEG','SENT','{IDS['token_a_legacy']}',100,100);

      INSERT INTO public.quote_items (id, company_id, quote_id, item_id, kind, name, description, quantity, unit_price, total, position, image_path)
      VALUES
        ('{IDS['qi_a']}','{IDS['company_a']}','{IDS['quote_a']}','{IDS['item_a']}','PRODUCT','Fixture Product A','Descrição fixture A',1,100,100,0,'{IMG_PATH_A}'),
        ('{IDS['qi_b']}','{IDS['company_b']}','{IDS['quote_b']}','{IDS['item_b']}','PRODUCT','Fixture Product B','Descrição fixture B',1,200,200,0,'{IMG_PATH_B}'),
        ('{IDS['qi_a_legacy']}','{IDS['company_a']}','{IDS['quote_a_legacy']}','{IDS['item_a']}','PRODUCT','Fixture Product A (legacy)','Sem snapshot',1,100,100,0,NULL);
    """)

    # 6) real storage objects (optional but recommended)
    if token_a:
        ok = upload_image(supabase_url, token_a, IMG_PATH_A)
        print(f"upload A: {'ok' if ok else 'FAIL'}", file=sys.stderr)
    if token_b:
        ok = upload_image(supabase_url, token_b, IMG_PATH_B)
        print(f"upload B: {'ok' if ok else 'FAIL'}", file=sys.stderr)

def print_env() -> None:
    lines = [
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
    ]
    print("\n".join(lines))

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--teardown", action="store_true")
    ap.add_argument("--print-only", action="store_true")
    args = ap.parse_args()

    if args.print_only:
        print_env(); return
    if args.teardown:
        teardown(); return

    user_a = os.environ.get("E2E_A_USER_ID")
    user_b = os.environ.get("E2E_B_USER_ID")
    pghost = os.environ.get("PGHOST")

    missing = [k for k, v in (
        ("PGHOST", pghost),
        ("PGUSER", os.environ.get("PGUSER")),
        ("PGPASSWORD", os.environ.get("PGPASSWORD")),
        ("PGDATABASE", os.environ.get("PGDATABASE")),
        ("E2E_A_USER_ID", user_a),
        ("E2E_B_USER_ID", user_b),
    ) if not v]
    if missing:
        sys.stderr.write(
            "ERROR: seed_fixtures.py cannot run — missing required env vars: "
            + ", ".join(missing)
            + "\nConfigure these repository secrets (E2E_PGHOST/E2E_PGPORT/"
            "E2E_PGUSER/E2E_PGPASSWORD/E2E_PGDATABASE/E2E_A_USER_ID/"
            "E2E_B_USER_ID) and re-run. Aborting instead of seeding a partial "
            "or wrong-database fixture.\n"
        )
        sys.exit(2)


    supabase_url = os.environ.get("SUPABASE_URL") or "https://ifhtznbbvjwejxlgpana.supabase.co"
    seed(user_a, user_b, supabase_url,
         os.environ.get("E2E_A_ACCESS_TOKEN"),
         os.environ.get("E2E_B_ACCESS_TOKEN"))
    print_env()

if __name__ == "__main__":
    main()
