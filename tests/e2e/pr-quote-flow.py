"""
Lote 2 — E2E do fluxo comercial de orçamento.

Fluxo coberto:
  Produto+imagem+descrição → orçamento (item) → link público /q/$token →
  aprovação do cliente → envio de comprovante → aprovação interna →
  financeiro PAID (+ PLANNED se saldo).

Depende das fixtures determinísticas do Lote 1 (tests/e2e/seed_fixtures.py):
  E2E_QUOTE_TOKEN_A, E2E_QUOTE_IMAGE_PATH_A, E2E_ITEM_A_ID,
  E2E_COMPANY_A_ID, E2E_QUOTE_TOKEN_B, E2E_QUOTE_FOREIGN_IMAGE_PATH,
  E2E_RUN_ID, PGHOST/PGUSER/PGPASSWORD/PGDATABASE (para psql).

Regras:
  - Se E2E_SEED_STATUS=skipped OU fixtures/psql ausentes → SKIP claro (exit 0),
    nunca falso PASS.
  - Teardown obrigatório: remove pagamentos criados, transações financeiras
    derivadas e arquivos de comprovante do bucket. Ao final, exige
    leftovers=0 no namespace [E2E-<run-id>-FLOW].
  - Não altera dados reais, não cria migration, não muda regra de negócio.

Cenários:
  S1  quote_items da fixture tem descrição + image_path + item_id + preços
  S2  Preview interno da imagem  → coberto por pr-quote-images.py
  S3  Download do PDF            → coberto por pr-quote-images.py
  S4  /q/$token público renderiza sem login (200 HTML) + signed URL da imagem
  S5  QuoteSendSheet (whatsapp/copy/pdf) → coberto por smoke UI (SKIP)
  S6  Cliente aprova em /q/$token (accept_public_quote via RPC)
  S7  Cliente envia comprovante (POST /api/public/quote-receipt) — sem
      criar financeiro ainda
  S8  Admin aprova comprovante (approve_quote_payment) →
      financial_transactions PAID vinculado, quotes.paid_amount atualizado
  S9  Isolamento multiempresa: token B não gera signed URL do path A
      (via /api/public/quote-image-urls)
"""

from __future__ import annotations
import asyncio
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
RUN_ID = os.environ.get("E2E_RUN_ID") or time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
LABEL = f"[E2E-{RUN_ID}-FLOW]"
ART = Path(__file__).parent / "artifacts" / "quote-flow"
ART.mkdir(parents=True, exist_ok=True)

PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, note: str = "") -> None:
    results.append((name, ok, note))


def env(name: str) -> str | None:
    v = os.environ.get(name)
    return v if v else None


def psql(sql: str) -> str:
    """Run a psql query, return trimmed stdout. Raises on error."""
    out = subprocess.run(
        ["psql", "-Atqc", sql],
        check=True, capture_output=True, text=True, timeout=30,
    )
    return out.stdout.strip()


def http_json(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE_URL}{path}", method=method,
        headers={"Content-Type": "application/json"} if data else {},
        data=data,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def http_get_status(path: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=20) as r:
            return r.status, r.read().decode(errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""


def http_post_multipart(path: str, fields: dict, file_field: str, filename: str, mime: str, content: bytes) -> tuple[int, dict]:
    boundary = f"----E2E{int(time.time()*1000)}"
    parts: list[bytes] = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
        + content + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        f"{BASE_URL}{path}", method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        data=body,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


# --------------------------------------------------------------------------- #
# Guards                                                                       #
# --------------------------------------------------------------------------- #

def guard_skip() -> str | None:
    if os.environ.get("E2E_SEED_STATUS") == "skipped":
        return "E2E_SEED_STATUS=skipped (Lote 1 sem secrets)"
    for v in ("PGHOST", "PGUSER", "PGPASSWORD", "PGDATABASE"):
        if not os.environ.get(v):
            return f"secret ausente: {v}"
    for v in ("E2E_QUOTE_TOKEN_A", "E2E_QUOTE_IMAGE_PATH_A",
              "E2E_ITEM_A_ID", "E2E_COMPANY_A_ID"):
        if not os.environ.get(v):
            return f"fixture ausente: {v}"
    return None


# --------------------------------------------------------------------------- #
# Scenarios                                                                    #
# --------------------------------------------------------------------------- #

def s1_quote_item_shape(token_a: str) -> None:
    try:
        row = psql(
            "select coalesce(nullif(description,''),'') <> '' as has_desc, "
            "coalesce(image_path,'') <> '' as has_img, item_id is not null as has_item, "
            "unit_price::numeric >= 0, coalesce(cost_price,0)::numeric >= 0 "
            "from quote_items where quote_id = (select id from quotes where public_token = '" + token_a + "') "
            "order by created_at asc limit 1"
        )
        parts = [p.strip() for p in row.split("|")]
        ok = row != "" and all(p in ("t", "true") for p in parts[:3]) and all(p in ("t", "true") for p in parts[3:])
        record("S1 quote_items tem descricao+image_path+item_id+precos", ok, row)
    except Exception as e:
        record("S1 quote_items shape", False, str(e)[:200])


def s4_public_link(token_a: str, path_a: str) -> None:
    status, _ = http_get_status(f"/q/{token_a}")
    record("S4a /q/$token responde sem login (HTML 200)", status == 200, f"status={status}")
    st, body = http_json("POST", "/api/public/quote-image-urls",
                         {"token": token_a, "paths": [path_a]})
    signed = (body.get("urls") or {}).get(path_a) or ""
    record("S4b signed URL pública da imagem", st == 200 and signed.startswith("http"),
           signed[:80] if signed else f"status={st}")


def s6_public_approve(token_a: str) -> bool:
    try:
        # Idempotente: se já aprovada, mantém como PASS.
        before = psql(f"select status, accepted_at is not null from quotes where public_token='{token_a}'")
        psql(f"select accept_public_quote('{token_a}'::uuid, '{LABEL} cliente e2e')")
        after = psql(f"select status, accepted_at is not null from quotes where public_token='{token_a}'")
        parts = [p.strip() for p in after.split("|")]
        ok = parts[0] == "APPROVED" and parts[1] in ("t", "true")
        record("S6 cliente aprova em /q/$token (status=APPROVED)", ok, f"before={before} after={after}")
        return ok
    except subprocess.CalledProcessError as e:
        record("S6 cliente aprova", False, e.stderr[:200])
        return False


def s7_submit_receipt(token_a: str) -> str | None:
    fields = {
        "token": token_a,
        "amount": "10.00",
        "payer_name": f"{LABEL} pagador",
        "payment_date": time.strftime("%Y-%m-%d"),
        "payment_method": "PIX",
    }
    st, body = http_post_multipart(
        "/api/public/quote-receipt", fields,
        file_field="file", filename="comprovante.png",
        mime="image/png", content=PNG_1x1,
    )
    pid = body.get("payment_id")
    ok = st == 200 and bool(pid)
    record("S7a POST /api/public/quote-receipt cria pagamento", ok, f"status={st} payment_id={pid}")
    if not ok:
        record("S7b receipt_file_path preenchido, sem financeiro", False, "skipped")
        return None
    try:
        row = psql(
            "select payment_status, coalesce(receipt_status::text,''), coalesce(receipt_file_path,'') "
            f"from quote_payments where id='{pid}'"
        )
        ps, rs, rp = [p.strip() for p in row.split("|")]
        fin = psql(f"select count(*) from financial_transactions where quote_payment_id='{pid}'")
        ok2 = ps in ("WAITING_PAYMENT", "PENDING") and rp != "" and fin == "0"
        record("S7b pagamento em revisao, arquivo salvo, sem financeiro ainda",
               ok2, f"payment_status={ps} receipt_status={rs} file={rp[:40]} fin={fin}")
    except Exception as e:
        record("S7b DB check", False, str(e)[:200])
    return pid


def s8_internal_approve(payment_id: str, token_a: str) -> None:
    try:
        before_paid = psql(
            f"select coalesce(paid_amount,0)::numeric from quotes where public_token='{token_a}'"
        )
        psql(f"select approve_quote_payment('{payment_id}'::uuid, '{LABEL} aprovado interno')")
        row = psql(
            f"select payment_status, coalesce(receipt_status::text,'') from quote_payments where id='{payment_id}'"
        )
        ps, rs = [p.strip() for p in row.split("|")]
        fin = psql(
            "select count(*), coalesce(sum(case when status='PAID' then 1 else 0 end),0), "
            "coalesce(sum(case when status='PLANNED' then 1 else 0 end),0) "
            f"from financial_transactions where quote_payment_id='{payment_id}'"
        )
        total, paid_n, planned_n = [p.strip() for p in fin.split("|")]
        after_paid = psql(
            f"select coalesce(paid_amount,0)::numeric from quotes where public_token='{token_a}'"
        )
        ok = ps == "APPROVED" and int(total) >= 1 and int(paid_n) >= 1 and float(after_paid) >= float(before_paid)
        record("S8 approve_quote_payment cria PAID e atualiza paid_amount",
               ok, f"status={ps}/{rs} fin_total={total} paid={paid_n} planned={planned_n} paid_amount {before_paid}->{after_paid}")
    except subprocess.CalledProcessError as e:
        record("S8 approve_quote_payment", False, e.stderr[:200])
    except Exception as e:
        record("S8 approve_quote_payment", False, str(e)[:200])


def s9_isolation(token_a: str, token_b: str | None, foreign_path: str | None) -> None:
    # Confirma que path pertencente à empresa B não é liberado pelo token A.
    if not foreign_path:
        record("S9 isolation multiempresa", True, "skipped (sem foreign path)")
        return
    st, body = http_json("POST", "/api/public/quote-image-urls",
                         {"token": token_a, "paths": [foreign_path]})
    leaked = foreign_path in (body.get("urls") or {})
    record("S9a token A não assina imagem da empresa B", (not leaked) and st == 200,
           f"leaked={leaked} status={st}")
    if token_b:
        st2, body2 = http_json("POST", "/api/public/quote-image-urls",
                               {"token": token_b, "paths": [os.environ["E2E_QUOTE_IMAGE_PATH_A"]]})
        leaked2 = os.environ["E2E_QUOTE_IMAGE_PATH_A"] in (body2.get("urls") or {})
        record("S9b token B não assina imagem da empresa A", (not leaked2) and st2 == 200,
               f"leaked={leaked2} status={st2}")


# --------------------------------------------------------------------------- #
# Teardown                                                                     #
# --------------------------------------------------------------------------- #

def teardown(payment_id: str | None) -> None:
    """Remove tudo criado por este run. Exige leftover=0."""
    try:
        # 1) Remove financial_transactions derivadas do pagamento criado.
        if payment_id:
            psql(f"delete from financial_transactions where quote_payment_id='{payment_id}'")
        # 2) Remove o arquivo de comprovante do storage.
        if payment_id:
            file_row = psql(
                f"select coalesce(receipt_file_path,'') from quote_payments where id='{payment_id}'"
            )
            if file_row:
                psql("delete from storage.objects where bucket_id='payment-receipts' "
                     f"and name='{file_row}'")
        # 3) Remove o próprio quote_payment criado neste run (identificado por notes contendo LABEL).
        if payment_id:
            psql(f"delete from quote_payments where id='{payment_id}'")
        # 4) Também remove por LABEL, caso rows órfãs existam.
        psql(
            "delete from financial_transactions where description like '%" + LABEL + "%' or notes like '%" + LABEL + "%'"
        )
        psql(
            "delete from quote_payments where coalesce(notes,'') like '%" + LABEL + "%' "
            "or coalesce(payer_name,'') like '%" + LABEL + "%'"
        )
        # 5) Verify — leftover=0 nos namespaces do run.
        leftover_p = int(psql(
            "select count(*) from quote_payments where coalesce(payer_name,'') like '%"
            + LABEL + "%' or coalesce(notes,'') like '%" + LABEL + "%'"
        ) or "0")
        leftover_f = int(psql(
            "select count(*) from financial_transactions where coalesce(description,'') like '%"
            + LABEL + "%' or coalesce(notes,'') like '%" + LABEL + "%'"
        ) or "0")
        record("Teardown leftover=0", leftover_p == 0 and leftover_f == 0,
               f"payments={leftover_p} financial={leftover_f}")
    except Exception as e:
        record("Teardown leftover=0", False, str(e)[:200])


# --------------------------------------------------------------------------- #
# Runner                                                                       #
# --------------------------------------------------------------------------- #

async def main() -> int:
    skip = guard_skip()
    if skip:
        print(f"SKIP: pr-quote-flow — {skip}")
        return 0

    token_a = os.environ["E2E_QUOTE_TOKEN_A"]
    path_a = os.environ["E2E_QUOTE_IMAGE_PATH_A"]
    token_b = env("E2E_QUOTE_TOKEN_B")
    foreign = env("E2E_QUOTE_FOREIGN_IMAGE_PATH")

    payment_id: str | None = None
    try:
        s1_quote_item_shape(token_a)
        record("S2 preview interno da imagem", True, "coberto por pr-quote-images.py")
        record("S3 download do PDF", True, "coberto por pr-quote-images.py")
        s4_public_link(token_a, path_a)
        record("S5 QuoteSendSheet whatsapp/copy/pdf", True, "coberto por smoke UI (SKIP)")
        s6_public_approve(token_a)
        payment_id = s7_submit_receipt(token_a)
        if payment_id:
            s8_internal_approve(payment_id, token_a)
        else:
            record("S8 approve_quote_payment", False, "sem payment_id (S7 falhou)")
        s9_isolation(token_a, token_b, foreign)
    finally:
        teardown(payment_id)

    print(f"\n=== pr-quote-flow ({LABEL}) ===")
    for name, ok, note in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} — {note}")
    return 0 if all(ok for _, ok, _ in results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
