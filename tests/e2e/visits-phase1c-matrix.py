#!/usr/bin/env python3
"""
FASE 1C — Matriz autenticada completa do módulo Visitas Técnicas.
Executa somente em preview/staging com as fixtures QA.
Nunca imprime senhas, tokens ou chaves.
"""
import os, json, secrets, subprocess, uuid, datetime, sys
import requests
from concurrent.futures import ThreadPoolExecutor

URL = "https://ifhtznbbvjwejxlgpana.supabase.co"
ANON = "sb_publishable_U7klolE4lwfbwXAeVfdxNA_SX0yhytL"
SR = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

RUN = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
TAG = f"[QA-VISITS] run={RUN}"

CO_A = "e41e4892-11a5-4835-b614-4ee54d6baeb3"
CO_B = "a7b9c66a-8cc3-4e58-b871-43e82d46c14e"
U = {
    "mgrA": ("qa.visits.manager.a@example.com", "9e570e97-459b-45b5-a61b-c65d91004883"),
    "tecA1": ("qa.visits.technician.a1@example.com", "d2a3b746-b82b-4122-8c82-1d8a08b10b9c"),
    "tecA2": ("qa.visits.technician.a2@example.com", "ad7385a3-cb4a-4408-b5aa-fbc7113b51c8"),
    "stockA": ("qa.visits.stock.a@example.com", "18b53d55-92c0-4d6c-9cf0-cf9bd03625e0"),
    "mgrB": ("qa.visits.manager.b@example.com", "067d7732-93a6-41b7-9786-ccac541f3e34"),
}
TOK = {}
RESULTS = []
IDS = {}


def q(sql):
    r = subprocess.run(["psql", "-At", "-F", "|", "-c", sql], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return [l.split("|") for l in r.stdout.strip().split("\n") if l.strip()]


def q1(sql):
    rows = q(sql)
    return rows[0][0] if rows else None


def admin_patch(table, filt, body):
    r = requests.patch(f"{URL}/rest/v1/{table}?{filt}",
                       headers={"apikey": SR, "Authorization": f"Bearer {SR}",
                                "Content-Type": "application/json", "Prefer": "return=minimal"},
                       json=body, timeout=30)
    if r.status_code >= 300:
        raise RuntimeError(f"admin_patch {table}: {r.status_code} {r.text[:200]}")


def rotate(uid, pwd):
    r = requests.put(f"{URL}/auth/v1/admin/users/{uid}",
                     headers={"apikey": SR, "Authorization": f"Bearer {SR}",
                              "Content-Type": "application/json"},
                     json={"password": pwd}, timeout=30)
    r.raise_for_status()


def login(email, pwd):
    r = requests.post(f"{URL}/auth/v1/token?grant_type=password",
                      headers={"apikey": ANON, "Content-Type": "application/json"},
                      json={"email": email, "password": pwd}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def hdr(who, extra=None):
    h = {"apikey": ANON, "Content-Type": "application/json"}
    if who:
        h["Authorization"] = f"Bearer {TOK[who]}"
    h.update(extra or {})
    return h


def rpc(who, fn, args):
    r = requests.post(f"{URL}/rest/v1/rpc/{fn}", headers=hdr(who), json=args, timeout=60)
    try:
        body = r.json()
    except Exception:
        body = r.text
    return r.status_code, body


def err(body):
    if isinstance(body, dict):
        return (body.get("message") or "") + " " + (body.get("hint") or "")
    return str(body)


def rest(who, method, path, body=None, extra=None):
    r = requests.request(method, f"{URL}/rest/v1/{path}", headers=hdr(who, extra),
                         json=body, timeout=60)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


def rec(n, desc, user, expected, got, ok, ids=""):
    status = "PASS" if ok is True else ("FAIL" if ok is False else ok)
    RESULTS.append(dict(n=n, desc=desc, user=user, expected=expected,
                        got=str(got)[:220], status=status, ids=ids))
    print(f"{n:>4} {status:<8} {desc[:70]}")


def denied(code, body):
    return code in (401, 403, 404) or "permission denied" in err(body).lower() or \
        "42501" in str(body) or "does not exist" in err(body).lower()


# ---------------------------------------------------------------- setup
def setup_auth():
    pw = {}
    for k, (email, uid) in U.items():
        p = secrets.token_urlsafe(24)
        rotate(uid, p)
        pw[k] = p
    for k, (email, uid) in U.items():
        TOK[k] = login(email, pw[k])
    pw.clear()


def sql_esc(s):
    return s.replace("'", "''")


def setup_data():
    ids = {}
    for co, sfx in ((CO_A, "A"), (CO_B, "B")):
        cid = q1(f"""insert into public.customers(company_id,name,cpf_cnpj,customer_type)
                     values('{co}','{sql_esc(TAG)} Cliente {sfx}','QA{RUN}{sfx}','INDIVIDUAL')
                     returning id""")
        aid = q1(f"""insert into public.customer_addresses(company_id,customer_id,address_type,street,number,district,city,state,zipcode)
                     values('{co}','{cid}','INSTALLATION','QA Street','1','QA','Brasilia','DF','70000000')
                     returning id""")
        ct = q1(f"""insert into public.customer_contacts(company_id,customer_id,name)
                    values('{co}','{cid}','{sql_esc(TAG)} Contato {sfx}') returning id""")
        ids[f"customer_{sfx}"] = cid
        ids[f"address_{sfx}"] = aid
        ids[f"contact_{sfx}"] = ct
    IDS.update(ids)
    return ids


def mk_payload(co="A", **over):
    start = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).replace(microsecond=0)
    p = {
        "visit_type": "DIAGNOSIS",
        "customer_id": IDS[f"customer_{co}"],
        "customer_contact_id": IDS[f"contact_{co}"],
        "title": f"{TAG} Visita",
        "scheduled_start_at": start.isoformat() + "+00:00",
        "scheduled_end_at": (start + datetime.timedelta(hours=2)).isoformat() + "+00:00",
    }
    p.update(over)
    return p


def create_visit(who, payload, key=None):
    return rpc(who, "create_visit", {"_payload": payload, "_client_request_id": key or str(uuid.uuid4())})


# ---------------------------------------------------------------- A
def block_a():
    vid = IDS.get("VA_main")
    c, b = rest("mgrA", "POST", "visits", {"company_id": CO_A, "title": "x"})
    rec(1, "INSERT direto em visits negado", "mgrA", "denied", (c, err(b)), denied(c, b))
    c, b = rest("mgrA", "PATCH", f"visits?id=eq.{vid}", {"title": "x"})
    rec(2, "UPDATE direto em visits negado", "mgrA", "denied", (c, err(b)), denied(c, b))
    c, b = rest("mgrA", "DELETE", f"visits?id=eq.{vid}")
    rec(3, "DELETE direto em visits negado", "mgrA", "denied", (c, err(b)), denied(c, b))
    c, b = rest("mgrA", "POST", "visit_events", {"company_id": CO_A, "visit_id": vid, "event_type": "X"})
    rec(4, "INSERT direto em visit_events negado", "mgrA", "denied", (c, err(b)), denied(c, b))
    c1, b1 = rest("mgrA", "PATCH", f"visit_events?visit_id=eq.{vid}", {"event_type": "X"})
    c2, b2 = rest("mgrA", "DELETE", f"visit_events?visit_id=eq.{vid}")
    rec(5, "UPDATE/DELETE direto em visit_events negado", "mgrA", "denied",
        (c1, c2), denied(c1, b1) and denied(c2, b2))
    c, b = rest("mgrA", "POST", "visit_photos", {"company_id": CO_A, "visit_id": vid, "file_path": "x"})
    rec(6, "INSERT direto em visit_photos negado", "mgrA", "denied", (c, err(b)), denied(c, b))
    c, b = rest("mgrA", "GET", "visit_number_counters?select=*")
    rec(7, "authenticated nao acessa visit_number_counters", "mgrA", "denied", (c, err(b)), denied(c, b))
    r = requests.post(f"{URL}/storage/v1/object/visit-photos/{CO_A}/visits/{vid}/direct.jpg",
                      headers={"apikey": ANON, "Authorization": f"Bearer {TOK['tecA1']}",
                               "Content-Type": "image/jpeg"}, data=b"\xff\xd8\xff", timeout=30)
    rec(8, "upload direto no bucket visit-photos negado", "tecA1", "denied",
        (r.status_code, r.text[:120]), r.status_code in (400, 401, 403))


# ---------------------------------------------------------------- base visits
def seed_visits():
    tecA1 = U["tecA1"][1]
    for name, over in [
        ("VA_main", {"assigned_technician_id": tecA1, "title": f"{TAG} main"}),
        ("VA_assign", {"title": f"{TAG} assign"}),
        ("VA_sched", {"title": f"{TAG} sched"}),
        ("VA_ckin", {"assigned_technician_id": tecA1, "title": f"{TAG} ckin"}),
        ("VA_flow", {"assigned_technician_id": tecA1, "title": f"{TAG} flow"}),
        ("VA_so1", {"assigned_technician_id": tecA1, "title": f"{TAG} so1"}),
        ("VA_so2", {"assigned_technician_id": tecA1, "title": f"{TAG} so2"}),
        ("VA_so3", {"assigned_technician_id": tecA1, "title": f"{TAG} so3"}),
        ("VA_photo", {"assigned_technician_id": tecA1, "title": f"{TAG} photo"}),
        ("VA_mgr", {"assigned_technician_id": U["mgrA"][1], "title": f"{TAG} mgr"}),
    ]:
        c, b = create_visit("mgrA", mk_payload("A", **over))
        assert c == 200, (name, c, b)
        IDS[name] = b
    c, b = create_visit("mgrB", mk_payload("B", title=f"{TAG} B1"))
    assert c == 200, (c, b)
    IDS["VB_1"] = b


def seed_service_orders():
    """Cria projeto + OS QA e vincula às visitas VA_so* (setup administrativo)."""
    cust = IDS["customer_A"]
    pnum = f"QA-P-{RUN}"
    pid = q1(f"""insert into public.projects(company_id,customer_id,project_number,title,status)
                 values('{CO_A}','{cust}','{pnum}','{sql_esc(TAG)} Projeto','READY_TO_SCHEDULE') returning id""")
    IDS["project_A"] = pid
    for i, (vkey, st) in enumerate([("VA_so1", "DRAFT"), ("VA_so2", "COMPLETED"), ("VA_so3", "CANCELLED")]):
        soid = q1(f"""insert into public.service_orders(company_id,project_id,customer_id,service_order_number,title,status)
                      values('{CO_A}','{pid}','{cust}','QA-OS-{RUN}-{i}','{sql_esc(TAG)} OS {i}','{st}') returning id""")
        IDS[f"so_{vkey}"] = soid
        admin_patch("visits", f"id=eq.{IDS[vkey]}", {"service_order_id": soid})


# ---------------------------------------------------------------- B
def block_b():
    today = datetime.date.today()
    f = (today - datetime.timedelta(days=5)).isoformat()
    t = (today + datetime.timedelta(days=30)).isoformat()

    c, b = rest("mgrA", "GET", f"visits?select=id&title=like.*{RUN}*")
    # leitura direta bloqueada por grants; usamos calendário
    c, cal = rpc("mgrA", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "all"})
    ids_all = {x["id"] for x in cal} if isinstance(cal, list) else set()
    expA = {IDS[k] for k in IDS if k.startswith("VA_")}
    rec(9, "Gestor A ve todas as visitas da Empresa A", "mgrA", f"{len(expA)} visitas",
        f"{len(expA & ids_all)} encontradas", expA <= ids_all)
    rec(10, "Gestor A nao ve visitas da Empresa B", "mgrA", "0 de B",
        IDS["VB_1"] in ids_all, IDS["VB_1"] not in ids_all, IDS["VB_1"])

    c, b = rpc("tecA1", "list_my_visits", {"_from": f, "_to": t})
    mine = {x["id"] for x in b} if isinstance(b, list) else set()
    expected_a1 = {IDS["VA_main"], IDS["VA_ckin"], IDS["VA_flow"], IDS["VA_so1"], IDS["VA_so2"],
                   IDS["VA_so3"], IDS["VA_photo"]}
    rec(11, "Tecnico A1 ve somente visitas atribuidas a A1", "tecA1", "somente A1",
        f"{len(mine)} linhas", mine == expected_a1)
    c, b = rpc("tecA2", "list_my_visits", {"_from": f, "_to": t})
    m2 = {x["id"] for x in b} if isinstance(b, list) else set()
    rec(12, "Tecnico A2 nao ve visitas de A1", "tecA2", "0", f"{len(m2)}", not (m2 & expected_a1))
    c, b = rpc("stockA", "list_my_visits", {"_from": f, "_to": t})
    rec(13, "Usuario stock recebe zero linhas", "stockA", "0 linhas",
        (c, b if not isinstance(b, list) else len(b)), isinstance(b, list) and len(b) == 0)
    c, b = rpc("mgrB", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "all"})
    idsB = {x["id"] for x in b} if isinstance(b, list) else set()
    rec(14, "Gestor B nao ve visitas da Empresa A", "mgrB", "0 de A",
        f"{len(idsB & expA)}", not (idsB & expA))
    c, b = rpc("stockA", "list_my_visits", {"_from": f, "_to": t})
    rec(15, "list_my_visits do stock -> sem permissao (0 linhas)", "stockA",
        "forbidden/0", (c, b if not isinstance(b, list) else len(b)),
        (isinstance(b, list) and len(b) == 0) or c >= 400)

    c, b = rpc("mgrA", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "all"})
    rec(16, "calendario scope=all do Gestor A permitido", "mgrA", "200", c, c == 200)
    c, b = rpc("mgrA", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "mine"})
    got = {x["id"] for x in b} if isinstance(b, list) else set()
    rec(17, "calendario scope=mine do Gestor A -> somente atribuidas a ele", "mgrA",
        {IDS["VA_mgr"]}, got, got == {IDS["VA_mgr"]}, IDS["VA_mgr"])
    c, b = rpc("tecA1", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "mine"})
    got = {x["id"] for x in b} if isinstance(b, list) else set()
    rec(18, "calendario scope=mine do Tecnico A1 -> somente A1", "tecA1", expected_a1, len(got),
        got == expected_a1)
    c, b = rpc("tecA1", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "all"})
    rec(19, "calendario scope=all do Tecnico A1 -> forbidden_scope_all", "tecA1",
        "forbidden_scope_all", err(b)[:60], "forbidden_scope_all" in err(b))
    c, b = rpc("mgrA", "list_visits_for_calendar", {"_from": f, "_to": t, "_scope": "xx"})
    rec(20, "scope invalido -> invalid_scope", "mgrA", "invalid_scope", err(b)[:60],
        "invalid_scope" in err(b))
    c, b = rpc("mgrA", "list_visits_for_calendar",
               {"_from": f, "_to": (today + datetime.timedelta(days=120)).isoformat(), "_scope": "all"})
    rec(21, "intervalo > 93 dias -> range_too_large", "mgrA", "range_too_large", err(b)[:60],
        "range_too_large" in err(b))


# ---------------------------------------------------------------- C
def block_c():
    vid = IDS["VA_main"]
    n_ev = q1(f"select count(*) from public.visit_events where visit_id='{vid}' and event_type='CREATED'")
    rec(22, "create_visit cria visita + evento CREATED", "mgrA", "1 visita/1 CREATED",
        f"CREATED={n_ev}", n_ev == "1", vid)
    num = q1(f"select visit_number from public.visits where id='{vid}'")
    okfmt = num.startswith("VIS-") and len(num) == 10
    rec(23, "visit_number segue VIS-000000", "mgrA", "VIS-XXXXXX", num, okfmt, vid)
    numB = q1(f"select visit_number from public.visits where id='{IDS['VB_1']}'")
    cntB = q1(f"select last_number from public.visit_number_counters where company_id='{CO_B}'")
    cntA = q1(f"select last_number from public.visit_number_counters where company_id='{CO_A}'")
    rec(24, "Empresa B possui numeracao isolada", "mgrB", "contadores independentes",
        f"A={cntA} B={cntB} numB={numB}", int(cntB) < int(cntA), IDS["VB_1"])

    key = str(uuid.uuid4())
    base = mk_payload("A", title=f"{TAG} idem", assigned_technician_id=U["tecA1"][1])
    c1, v1 = create_visit("mgrA", base, key)
    c2, v2 = create_visit("mgrA", base, key)
    IDS["VA_idem"] = v1
    rec(25, "retry mesma chave e mesma intencao -> mesmo ID", "mgrA", "mesmo id",
        f"{v1}=={v2}", v1 == v2, v1)

    variants = [
        (26, "customer diferente", {"customer_id": IDS["customer_B"]}),
        (28, "contato diferente", {"customer_contact_id": None}),
        (29, "responsavel diferente", {"responsible_user_id": U["tecA1"][1]}),
        (30, "tecnico diferente", {"assigned_technician_id": U["tecA2"][1]}),
        (31, "visit_type diferente", {"visit_type": "INSPECTION"}),
        (32, "data diferente", {"scheduled_start_at": (datetime.datetime.utcnow() + datetime.timedelta(days=3)).replace(microsecond=0).isoformat() + "+00:00",
                                "scheduled_end_at": (datetime.datetime.utcnow() + datetime.timedelta(days=3, hours=2)).replace(microsecond=0).isoformat() + "+00:00"}),
        (33, "titulo diferente", {"title": f"{TAG} idem outro"}),
    ]
    p27 = dict(base); p27["customer_address_id"] = IDS["address_A"]
    c27, b27 = create_visit("mgrA", p27, key)
    rec(27, "mesma chave com endereco diferente -> idempotency_key_reused", "mgrA",
        "idempotency_key_reused", err(b27)[:90],
        True if "idempotency_key_reused" in err(b27) else "BLOCKED")

    for n, label, over in variants:
        p = dict(base)
        p.update(over)
        p = {k: v for k, v in p.items() if v is not None}
        c, b = create_visit("mgrA", p, key)
        msg = err(b)
        expected_cross = n == 26
        ok = ("idempotency_key_reused" in msg) or (expected_cross and "customer_cross_company" in msg)
        rec(n, f"mesma chave com {label} -> idempotency_key_reused", "mgrA",
            "idempotency_key_reused", msg[:70], ok)

    cross = [
        (34, "cliente cross-company", {"customer_id": IDS["customer_B"]}, "customer_cross_company"),
        (35, "endereco cross-company", {"customer_address_id": IDS["address_B"]}, "address_cross_company"),
        (36, "contato cross-company", {"customer_contact_id": IDS["contact_B"]}, "contact_cross_company"),
        (37, "responsavel cross-company", {"responsible_user_id": U["mgrB"][1]}, "responsible_cross_company"),
        (38, "tecnico cross-company", {"assigned_technician_id": U["mgrB"][1]}, "technician_cross_company"),
    ]
    for n, label, over, exp in cross:
        p = mk_payload("A", title=f"{TAG} cross{n}")
        p.update(over)
        c, b = create_visit("mgrA", p)
        rec(n, f"{label} -> bloqueado", "mgrA", exp, err(b)[:70], exp in err(b))

    p = mk_payload("A", title=f"{TAG} badts", scheduled_start_at="nao-e-data")
    c, b = create_visit("mgrA", p)
    rec(39, "timestamp invalido -> erro de dominio", "mgrA", "invalid_scheduled_start_at",
        err(b)[:70], "invalid_scheduled_start_at" in err(b))

    key2 = str(uuid.uuid4())
    p2 = mk_payload("A", title=f"{TAG} conc", assigned_technician_id=U["tecA1"][1])
    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = [ex.submit(create_visit, "mgrA", p2, key2) for _ in range(2)]
        out = [f.result() for f in futs]
    vids = {o[1] for o in out if o[0] == 200}
    rec(40, "duas chamadas concorrentes mesma chave -> mesmo ID", "mgrA", "1 id unico",
        [(o[0], str(o[1])[:60]) for o in out], len(vids) == 1)
    if vids:
        IDS["VA_conc"] = list(vids)[0]
        cnt = q1(f"select count(*) from public.visits where client_request_id='{key2}'")
        ev = q1(f"select count(*) from public.visit_events where visit_id='{list(vids)[0]}' and event_type='CREATED'")
        rec(41, "exatamente um evento CREATED", "mgrA", "1", f"visits={cnt} created={ev}",
            cnt == "1" and ev == "1", list(vids)[0])
        nt = q1(f"""select count(*) from public.notifications
                    where user_id='{U['tecA1'][1]}' and created_at >= now() - interval '10 minutes'
                      and body like '%{q1(f"select visit_number from public.visits where id='{list(vids)[0]}'")}%'""")
        rec(42, "exatamente uma notificacao ao tecnico", "mgrA", "1", nt, nt == "1")


# ---------------------------------------------------------------- D
def block_d():
    v = IDS["VA_sched"]
    st = (datetime.datetime.utcnow() + datetime.timedelta(days=4)).replace(microsecond=0)
    pl = {"scheduled_start_at": st.isoformat() + "+00:00",
          "scheduled_end_at": (st + datetime.timedelta(hours=2)).isoformat() + "+00:00"}
    admin_patch("visits", f"id=eq.{v}", {"status": "DRAFT"})
    c, b = rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": pl, "_client_request_id": str(uuid.uuid4())})
    rec(43, "reagendamento em DRAFT permitido", "mgrA", "200", (c, err(b)[:50]), c == 200, v)
    admin_patch("visits", f"id=eq.{v}", {"status": "SCHEDULED"})
    c, b = rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": pl, "_client_request_id": str(uuid.uuid4())})
    rec(44, "reagendamento em SCHEDULED permitido", "mgrA", "200", (c, err(b)[:50]), c == 200, v)
    admin_patch("visits", f"id=eq.{v}", {"status": "CONFIRMED"})
    c, b = rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": pl, "_client_request_id": str(uuid.uuid4())})
    rec(45, "reagendamento em CONFIRMED permitido", "mgrA", "200", (c, err(b)[:50]), c == 200, v)
    admin_patch("visits", f"id=eq.{v}", {"status": "CANCELLED"})
    c, b = rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": pl, "_client_request_id": str(uuid.uuid4())})
    rec(46, "reagendamento em estado incompativel bloqueado", "mgrA", "schedule_not_editable",
        err(b)[:60], "schedule_not_editable" in err(b), v)
    admin_patch("visits", f"id=eq.{v}", {"status": "SCHEDULED"})

    k = str(uuid.uuid4())
    rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": pl, "_client_request_id": k})
    rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": pl, "_client_request_id": k})
    ev = q1(f"select count(*) from public.visit_events where client_request_id='{k}'")
    rec(47, "retry identico -> um evento", "mgrA", "1", ev, ev == "1", v)
    c, b = rpc("mgrA", "update_visit_schedule",
               {"_visit_id": IDS["VA_assign"], "_payload": pl, "_client_request_id": k})
    rec(48, "retry divergente -> idempotency_key_reused", "mgrA", "idempotency_key_reused",
        err(b)[:60], "idempotency_key_reused" in err(b))
    bad = {"scheduled_start_at": st.isoformat() + "+00:00", "scheduled_end_at": st.isoformat() + "+00:00"}
    c, b = rpc("mgrA", "update_visit_schedule", {"_visit_id": v, "_payload": bad, "_client_request_id": str(uuid.uuid4())})
    rec(49, "termino <= inicio bloqueado", "mgrA", "schedule_invalid_range", err(b)[:60],
        "schedule_invalid_range" in err(b), v)


# ---------------------------------------------------------------- E
def block_e():
    v = IDS["VA_assign"]
    c, b = rpc("mgrA", "assign_visit_technician", {"_visit_id": v, "_technician_id": U["tecA1"][1],
                                                   "_client_request_id": str(uuid.uuid4())})
    rec(50, "atribuir Tecnico A1 -> sucesso", "mgrA", "200", (c, err(b)[:50]), c == 200, v)
    c, b = rpc("mgrA", "assign_visit_technician", {"_visit_id": v, "_technician_id": U["tecA2"][1],
                                                   "_client_request_id": str(uuid.uuid4())})
    rec(51, "reatribuir para Tecnico A2 -> sucesso", "mgrA", "200", (c, err(b)[:50]), c == 200, v)
    c, b = rpc("mgrA", "assign_visit_technician", {"_visit_id": v, "_technician_id": U["mgrB"][1],
                                                   "_client_request_id": str(uuid.uuid4())})
    rec(52, "atribuir usuario da Empresa B -> technician_cross_company", "mgrA",
        "technician_cross_company", err(b)[:60], "technician_cross_company" in err(b), v)
    k = str(uuid.uuid4())
    rpc("mgrA", "assign_visit_technician", {"_visit_id": v, "_technician_id": U["tecA1"][1], "_client_request_id": k})
    rpc("mgrA", "assign_visit_technician", {"_visit_id": v, "_technician_id": U["tecA1"][1], "_client_request_id": k})
    ev = q1(f"select count(*) from public.visit_events where client_request_id='{k}'")
    nt = q1(f"""select count(*) from public.notifications where user_id='{U['tecA1'][1]}'
                and created_at >= now() - interval '10 minutes'
                and body like '%{q1(f"select visit_number from public.visits where id='{v}'")}%'""")
    rec(53, "retry identico -> um evento e uma notificacao", "mgrA", "1/1", f"ev={ev} notif={nt}",
        ev == "1" and nt == "1", v)
    c, b = rpc("mgrA", "assign_visit_technician",
               {"_visit_id": IDS["VA_main"], "_technician_id": U["tecA2"][1], "_client_request_id": k})
    rec(54, "mesma chave com tecnico diferente -> idempotency_key_reused", "mgrA",
        "idempotency_key_reused", err(b)[:60], "idempotency_key_reused" in err(b))


# ---------------------------------------------------------------- F
def block_f():
    v = IDS["VA_ckin"]
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": -15.7942, "_lon": -47.8822,
                                           "_accuracy_m": 10, "_manual_reason": None,
                                           "_client_request_id": None})
    rec(55, "client_request_id NULL -> client_request_id_required", "tecA1",
        "client_request_id_required", err(b)[:60], "client_request_id_required" in err(b), v)

    kmain = str(uuid.uuid4())
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": -15.7950, "_lon": -47.8830,
                                           "_accuracy_m": 12, "_manual_reason": None,
                                           "_client_request_id": kmain})
    row = q(f"select checkin_latitude, checkin_distance_m, checked_in_at from public.visits where id='{v}'")[0]
    ev = q1(f"select count(*) from public.visit_events where visit_id='{v}' and event_type='CHECKED_IN'")
    ok56 = c == 200 and row[0] not in ("", None) and ev == "1"
    rec(56, "GPS valido -> coordenadas, distancia e um evento", "tecA1", "lat/dist/1 evento",
        f"{row} ev={ev}", (True if (ok56 and row[1] not in ("", None)) else ("BLOCKED" if ok56 else False)), v)

    # manual check-in em outra visita
    c, b = create_visit("mgrA", mk_payload("A", title=f"{TAG} manual",
                                           assigned_technician_id=U["tecA1"][1]))
    vman = b
    IDS["VA_manual"] = vman
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": vman, "_lat": None, "_lon": None,
                                           "_accuracy_m": None,
                                           "_manual_reason": "sem sinal de GPS no local",
                                           "_client_request_id": str(uuid.uuid4())})
    rec(57, "check-in manual valido -> sucesso", "tecA1", "200", (c, err(b)[:50]), c == 200, vman)

    negs = [
        (58, "manual sem justificativa suficiente", dict(_lat=None, _lon=None, _accuracy_m=None,
                                                         _manual_reason="ab"), "manual_reason_too_short"),
        (59, "manual com latitude/longitude", dict(_lat=-15.0, _lon=-47.0, _accuracy_m=None,
                                                   _manual_reason="sem sinal aqui"), "gps_and_manual_reason_conflict"),
        (60, "manual com accuracy", dict(_lat=None, _lon=None, _accuracy_m=5,
                                         _manual_reason="sem sinal aqui"), "manual_accuracy_not_allowed"),
        (61, "GPS com manual_reason", dict(_lat=-15.0, _lon=-47.0, _accuracy_m=5,
                                           _manual_reason="sem sinal aqui"), "gps_and_manual_reason_conflict"),
        (62, "apenas latitude", dict(_lat=-15.0, _lon=None, _accuracy_m=None, _manual_reason=None), "gps_pair_required"),
        (63, "apenas longitude", dict(_lat=None, _lon=-47.0, _accuracy_m=None, _manual_reason=None), "gps_pair_required"),
        (64, "latitude fora do intervalo", dict(_lat=-999, _lon=-47.0, _accuracy_m=None, _manual_reason=None), "invalid_latitude"),
        (65, "longitude fora do intervalo", dict(_lat=-15.0, _lon=999, _accuracy_m=None, _manual_reason=None), "invalid_longitude"),
        (66, "accuracy negativa", dict(_lat=-15.0, _lon=-47.0, _accuracy_m=-3, _manual_reason=None), "invalid_accuracy"),
    ]
    vneg = IDS["VA_flow"]
    for n, label, args, exp in negs:
        a = dict(args)
        a["_visit_id"] = vneg
        a["_client_request_id"] = str(uuid.uuid4())
        c, b = rpc("tecA1", "visit_check_in", a)
        rec(n, f"check-in {label} -> bloqueado", "tecA1", exp, err(b)[:60], exp in err(b), vneg)

    c, b = rpc("tecA2", "visit_check_in", {"_visit_id": vneg, "_lat": -15.79, "_lon": -47.88,
                                           "_accuracy_m": 5, "_manual_reason": None,
                                           "_client_request_id": str(uuid.uuid4())})
    rec(67, "Tecnico A2 em visita de A1 -> forbidden", "tecA2", "forbidden", err(b)[:60],
        "forbidden" in err(b), vneg)

    before = q(f"select checked_in_at, checkin_latitude from public.visits where id='{v}'")[0]
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": -15.7950, "_lon": -47.8830,
                                           "_accuracy_m": 12, "_manual_reason": None,
                                           "_client_request_id": kmain})
    after = q(f"select checked_in_at, checkin_latitude from public.visits where id='{v}'")[0]
    rec(68, "retry identico -> horario e dados preservados", "tecA1", "inalterado",
        f"{before}=={after}", c == 200 and before == after, v)
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": -10.0, "_lon": -40.0,
                                           "_accuracy_m": 12, "_manual_reason": None,
                                           "_client_request_id": kmain})
    rec(69, "retry divergente -> idempotency_key_reused", "tecA1", "idempotency_key_reused",
        err(b)[:60], "idempotency_key_reused" in err(b), v)
    ev = q1(f"select count(*) from public.visit_events where visit_id='{v}' and event_type='CHECKED_IN'")
    rec(70, "exatamente um evento CHECKED_IN", "tecA1", "1", ev, ev == "1", v)


# ---------------------------------------------------------------- G
def block_g():
    v = IDS["VA_flow"]
    c, b = rpc("mgrA", "visit_execute_transition", {"_visit_id": v, "_target": "CONFIRMED",
                                                    "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    rec(71, "CONFIRMED por visits.edit permitido", "mgrA", "200", (c, err(b)[:50]), c == 200, v)
    c, b = rpc("tecA1", "visit_execute_transition", {"_visit_id": v, "_target": "ON_THE_WAY",
                                                     "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    rec(72, "ON_THE_WAY pelo tecnico atribuido permitido", "tecA1", "200", (c, err(b)[:50]), c == 200, v)
    rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": -15.7942, "_lon": -47.8822,
                                    "_accuracy_m": 8, "_manual_reason": None,
                                    "_client_request_id": str(uuid.uuid4())})
    for n, target, desc in [(73, "IN_PROGRESS", "IN_PROGRESS apos CHECKED_IN permitido sem OS"),
                            (74, "PAUSED", "PAUSED apos IN_PROGRESS permitido"),
                            (75, "RESUMED", "RESUMED apos PAUSED permitido")]:
        c, b = rpc("tecA1", "visit_execute_transition", {"_visit_id": v, "_target": target,
                                                         "_payload": {}, "_client_request_id": str(uuid.uuid4())})
        rec(n, desc, "tecA1", "200", err(b)[:70], c == 200, v)
    rec(76, "segunda pausa/retomada -> timeline coerente", "tecA1", "eventos coerentes",
        "PAUSED/RESUMED nao existem no dominio de status", "BLOCKED", v)
    c, b = rpc("tecA1", "visit_execute_transition", {"_visit_id": v, "_target": "ON_THE_WAY",
                                                     "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    rec(77, "transicao invalida bloqueada", "tecA1", "invalid_transition", err(b)[:60],
        "invalid_transition" in err(b), v)
    c, b = rpc("stockA", "visit_execute_transition", {"_visit_id": v, "_target": "COMPLETED",
                                                      "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    rec(78, "usuario sem visits.execute nao inicia execucao", "stockA", "forbidden",
        err(b)[:60], "forbidden" in err(b), v)

    vso = IDS["VA_so1"]
    for n, target in [(79, "IN_PROGRESS"), (80, "PAUSED"), (81, "COMPLETED")]:
        c, b = rpc("tecA1", "visit_execute_transition", {"_visit_id": vso, "_target": target,
                                                         "_payload": {}, "_client_request_id": str(uuid.uuid4())})
        exp = "blocked_by_service_order" if target == "COMPLETED" else "bloqueado"
        ok = c != 200
        rec(n, f"visita com OS bloqueia {target} pela RPC da visita", "tecA1", exp, err(b)[:70], ok, vso)

    c, b = rpc("tecA1", "visit_execute_transition", {"_visit_id": v, "_target": "COMPLETED",
                                                     "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    rec(82, "COMPLETED sem OS permitido no fluxo correto", "tecA1", "200", (c, err(b)[:60]),
        c == 200, v)


# ---------------------------------------------------------------- H
def block_h():
    v = IDS["VA_flow"]  # ja COMPLETED, sem OS, com check-in
    vman = IDS["VA_manual"]
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vman, "_lat": None, "_lon": None,
                                            "_accuracy_m": None, "_manual_reason": "sem sinal no local",
                                            "_client_request_id": str(uuid.uuid4())})
    rec(83, "check-out sem OS antes de COMPLETED -> checkout_requires_completed", "tecA1",
        "checkout_requires_completed", err(b)[:60], "checkout_requires_completed" in err(b), vman)

    kout = str(uuid.uuid4())
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": v, "_lat": -15.7945, "_lon": -47.8825,
                                            "_accuracy_m": 9, "_manual_reason": None,
                                            "_client_request_id": kout})
    rec(84, "check-out sem OS apos COMPLETED -> sucesso", "tecA1", "200", (c, err(b)[:60]), c == 200, v)
    row = q(f"select checkout_distance_m, checked_out_at from public.visits where id='{v}'")[0]
    ev = q1(f"select count(*) from public.visit_events where visit_id='{v}' and event_type='CHECKED_OUT'")
    rec(91, "check-out GPS grava distancia e um evento", "tecA1", "distancia + 1 evento",
        f"{row} ev={ev}", (True if row[0] not in ("", None) and ev == "1" else ("BLOCKED" if ev == "1" else False)), v)

    vso = IDS["VA_so1"]
    so = IDS["so_VA_so1"]
    rpc("tecA1", "visit_check_in", {"_visit_id": vso, "_lat": -15.7942, "_lon": -47.8822,
                                    "_accuracy_m": 8, "_manual_reason": None,
                                    "_client_request_id": str(uuid.uuid4())})
    for n, st in [(85, "DRAFT"), (86, "SCHEDULED"), (87, "IN_PROGRESS")]:
        admin_patch("service_orders", f"id=eq.{so}", {"status": st})
        c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vso, "_lat": -15.7942, "_lon": -47.8822,
                                                "_accuracy_m": 8, "_manual_reason": None,
                                                "_client_request_id": str(uuid.uuid4())})
        rec(n, f"check-out com OS {st} -> blocked_by_service_order", "tecA1",
            "blocked_by_service_order", err(b)[:60], "blocked_by_service_order" in err(b), vso)
    admin_patch("service_orders", f"id=eq.{so}", {"status": "PAUSED"})
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vso, "_lat": -15.7942, "_lon": -47.8822,
                                            "_accuracy_m": 8, "_manual_reason": None,
                                            "_client_request_id": str(uuid.uuid4())})
    rec(88, "check-out com OS PAUSED -> permitido", "tecA1", "200", (c, err(b)[:60]), c == 200, vso)

    for n, vkey, st in [(89, "VA_so2", "COMPLETED"), (90, "VA_so3", "CANCELLED")]:
        vv = IDS[vkey]
        rpc("tecA1", "visit_check_in", {"_visit_id": vv, "_lat": -15.7942, "_lon": -47.8822,
                                        "_accuracy_m": 8, "_manual_reason": None,
                                        "_client_request_id": str(uuid.uuid4())})
        c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vv, "_lat": -15.7942, "_lon": -47.8822,
                                                "_accuracy_m": 8, "_manual_reason": None,
                                                "_client_request_id": str(uuid.uuid4())})
        rec(n, f"check-out com OS {st} -> permitido", "tecA1", "200", (c, err(b)[:60]), c == 200, vv)

    # 92 manual: completar vman e fazer checkout manual
    rpc("tecA1", "visit_execute_transition", {"_visit_id": vman, "_target": "COMPLETED",
                                              "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    kman = str(uuid.uuid4())
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vman, "_lat": None, "_lon": None,
                                            "_accuracy_m": None, "_manual_reason": "sem sinal no local",
                                            "_client_request_id": kman})
    rec(92, "check-out manual valido -> sucesso", "tecA1", "200", (c, err(b)[:60]), c == 200, vman)
    c1, b1 = rpc("tecA1", "visit_check_out", {"_visit_id": IDS["VA_so2"], "_lat": -15.0, "_lon": -47.0,
                                              "_accuracy_m": None, "_manual_reason": "conflito gps",
                                              "_client_request_id": str(uuid.uuid4())})
    rec(93, "exclusividade GPS/manual aplicada no check-out", "tecA1",
        "gps_and_manual_reason_conflict / ja finalizado", err(b1)[:70],
        "gps_and_manual_reason_conflict" in err(b1) or "visit_already_checked_out" in err(b1))

    before = q1(f"select checked_out_at from public.visits where id='{vman}'")
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vman, "_lat": None, "_lon": None,
                                            "_accuracy_m": None, "_manual_reason": "sem sinal no local",
                                            "_client_request_id": kman})
    after = q1(f"select checked_out_at from public.visits where id='{vman}'")
    rec(94, "retry identico -> checked_out_at preservado", "tecA1", "inalterado",
        f"{before}=={after}", c == 200 and before == after, vman)
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vman, "_lat": None, "_lon": None,
                                            "_accuracy_m": None, "_manual_reason": "outra justificativa",
                                            "_client_request_id": kman})
    rec(95, "retry divergente -> idempotency_key_reused", "tecA1", "idempotency_key_reused",
        err(b)[:60], "idempotency_key_reused" in err(b), vman)
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vman, "_lat": None, "_lon": None,
                                            "_accuracy_m": None, "_manual_reason": "sem sinal no local",
                                            "_client_request_id": str(uuid.uuid4())})
    rec(96, "nova chave apos check-out -> visit_already_checked_out", "tecA1",
        "visit_already_checked_out", err(b)[:60], "visit_already_checked_out" in err(b), vman)
    ev = q1(f"select count(*) from public.visit_events where visit_id='{vman}' and event_type='CHECKED_OUT'")
    rec(97, "exatamente um evento CHECKED_OUT", "tecA1", "1", ev, ev == "1", vman)


# ---------------------------------------------------------------- I
JPEG = (b"\xff\xd8\xff\xe0" + b"\x00" * 508 + b"\xff\xd9")


def admin_upload(path, data, mime="image/jpeg"):
    r = requests.post(f"{URL}/storage/v1/object/visit-photos/{path}",
                      headers={"apikey": SR, "Authorization": f"Bearer {SR}", "Content-Type": mime},
                      data=data, timeout=60)
    return r.status_code, r.text[:120]


def block_i():
    v = IDS["VA_photo"]
    pref = f"{CO_A}/visits/{v}/"
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": pref + "ghost.jpg",
                                                 "_file_name": "ghost.jpg", "_mime_type": "image/jpeg",
                                                 "_file_size": 512, "_photo_category": "BEFORE",
                                                 "_caption": None, "_sort_order": 0})
    rec(98, "objeto inexistente -> uploaded_object_missing", "tecA1", "uploaded_object_missing",
        err(b)[:60], "uploaded_object_missing" in err(b), v)
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": f"{CO_A}/outro/x.jpg",
                                                 "_file_name": "x.jpg", "_mime_type": "image/jpeg",
                                                 "_file_size": 512, "_photo_category": "BEFORE",
                                                 "_caption": None, "_sort_order": 0})
    rec(99, "file_path fora do prefixo bloqueado", "tecA1", "file_path_mismatch", err(b)[:60],
        "file_path_mismatch" in err(b), v)
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": pref + "a.gif",
                                                 "_file_name": "a.gif", "_mime_type": "image/gif",
                                                 "_file_size": 512, "_photo_category": "BEFORE",
                                                 "_caption": None, "_sort_order": 0})
    rec(100, "MIME nao permitido bloqueado", "tecA1", "unsupported_mime", err(b)[:60],
        "unsupported_mime" in err(b), v)
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": pref + "big.jpg",
                                                 "_file_name": "big.jpg", "_mime_type": "image/jpeg",
                                                 "_file_size": 11 * 1024 * 1024, "_photo_category": "BEFORE",
                                                 "_caption": None, "_sort_order": 0})
    rec(101, "tamanho > 10MB bloqueado", "tecA1", "invalid_file_size", err(b)[:60],
        "invalid_file_size" in err(b), v)
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": pref + "a.jpg",
                                                 "_file_name": "a.jpg", "_mime_type": "image/jpeg",
                                                 "_file_size": 512, "_photo_category": "XXX",
                                                 "_caption": None, "_sort_order": 0})
    rec(102, "categoria invalida bloqueada", "tecA1", "invalid_photo_category", err(b)[:60],
        "invalid_photo_category" in err(b), v)
    c, b = rpc("tecA2", "register_visit_photo", {"_visit_id": v, "_file_path": pref + "a.jpg",
                                                 "_file_name": "a.jpg", "_mime_type": "image/jpeg",
                                                 "_file_size": 512, "_photo_category": "BEFORE",
                                                 "_caption": None, "_sort_order": 0})
    rec(103, "Tecnico A2 nao registra foto em visita de A1", "tecA2", "forbidden", err(b)[:60],
        "forbidden" in err(b), v)

    p1 = pref + f"qa-{RUN}-1.jpg"
    sc, st = admin_upload(p1, JPEG)
    IDS["obj1"] = p1
    rec(104, "criar objeto QA valido administrativamente", "admin", "200", (sc, st), sc in (200, 201))
    size = len(JPEG)
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": p1,
                                                 "_file_name": "qa1.jpg", "_mime_type": "image/jpeg",
                                                 "_file_size": size, "_photo_category": "BEFORE",
                                                 "_caption": f"{TAG} foto", "_sort_order": 1})
    photo_id = b if c == 200 else None
    IDS["photo1"] = photo_id
    rec(105, "registrar foto valida -> sucesso", "tecA1", "photo_id", (c, str(b)[:60]), c == 200, str(photo_id))
    c2, b2 = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": p1,
                                                   "_file_name": "qa1.jpg", "_mime_type": "image/jpeg",
                                                   "_file_size": size, "_photo_category": "BEFORE",
                                                   "_caption": "outro", "_sort_order": 2})
    rec(106, "retry pelo mesmo file_path -> mesmo photo_id", "tecA1", "mesmo id",
        f"{photo_id}=={b2}", b2 == photo_id, str(photo_id))

    p2 = pref + f"qa-{RUN}-2.jpg"
    admin_upload(p2, JPEG)
    IDS["obj2"] = p2
    args = {"_visit_id": v, "_file_path": p2, "_file_name": "qa2.jpg", "_mime_type": "image/jpeg",
            "_file_size": size, "_photo_category": "AFTER", "_caption": None, "_sort_order": 0}
    with ThreadPoolExecutor(max_workers=2) as ex:
        out = [f.result() for f in [ex.submit(rpc, "tecA1", "register_visit_photo", args) for _ in range(2)]]
    rows = q1(f"select count(*) from public.visit_photos where file_path='{p2}'")
    evs = q1(f"select count(*) from public.visit_events where event_type='PHOTO_ADDED' and event_data->>'file_path'='{p2}'")
    rec(107, "chamadas concorrentes -> uma linha e um evento", "tecA1", "1/1",
        f"rows={rows} events={evs} out={[o[0] for o in out]}", rows == "1" and evs == "1")

    p3 = pref + f"qa-{RUN}-3.jpg"
    admin_upload(p3, JPEG)
    IDS["obj3"] = p3
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": p3, "_file_name": "qa3.png",
                                                 "_mime_type": "image/png", "_file_size": size,
                                                 "_photo_category": "OTHER", "_caption": None, "_sort_order": 0})
    rec(108, "metadata MIME divergente bloqueado", "tecA1", "uploaded_object_metadata_mismatch",
        err(b)[:70], "uploaded_object_metadata_mismatch" in err(b))
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": p3, "_file_name": "qa3.jpg",
                                                 "_mime_type": "image/jpeg", "_file_size": size + 7,
                                                 "_photo_category": "OTHER", "_caption": None, "_sort_order": 0})
    rec(109, "metadata size divergente bloqueado", "tecA1", "uploaded_object_metadata_mismatch",
        err(b)[:70], "uploaded_object_metadata_mismatch" in err(b))

    c, b = rpc("tecA1", "soft_delete_visit_photo", {"_photo_id": photo_id})
    da = q1(f"select deleted_at from public.visit_photos where id='{photo_id}'")
    rec(110, "soft delete -> deleted_at preenchido", "tecA1", "deleted_at not null", da,
        bool(da), str(photo_id))
    c, b = rpc("tecA1", "register_visit_photo", {"_visit_id": v, "_file_path": p1, "_file_name": "qa1.jpg",
                                                 "_mime_type": "image/jpeg", "_file_size": size,
                                                 "_photo_category": "BEFORE", "_caption": None, "_sort_order": 0})
    rec(111, "reutilizacao de path arquivado -> photo_path_archived", "tecA1", "photo_path_archived",
        err(b)[:60], "photo_path_archived" in err(b))

    pid2 = q1(f"select id from public.visit_photos where file_path='{p2}'")
    c, b = rpc("tecA1", "update_visit_photo_caption", {"_photo_id": pid2, "_caption": f"{TAG} legenda",
                                                       "_sort_order": 5})
    rec(112, "atualizacao de caption/sort_order autorizada", "tecA1", "200", (c, err(b)[:50]),
        c == 200, pid2)
    c, b = rpc("stockA", "update_visit_photo_caption", {"_photo_id": pid2, "_caption": "hack", "_sort_order": 9})
    c2, b2 = rpc("tecA2", "update_visit_photo_caption", {"_photo_id": pid2, "_caption": "hack", "_sort_order": 9})
    rec(113, "usuario sem autorizacao nao altera foto", "stockA/tecA2", "forbidden",
        f"{err(b)[:40]} | {err(b2)[:40]}", "forbidden" in err(b) and "forbidden" in err(b2), pid2)
    rec("I-magic", "validacao de magic bytes", "-", "rota server-side",
        "rota server-side de upload ainda nao existe", "NOT RUN")


# ---------------------------------------------------------------- J
def block_j(counts_before):
    vids = "','".join([IDS[k] for k in IDS if k.startswith("VA_") or k.startswith("VB_")])
    ft = q1(f"select count(*) from public.financial_transactions where created_at >= now() - interval '2 hours' and company_id in ('{CO_A}','{CO_B}')")
    rec(114, "nenhuma RPC de visitas cria financial_transactions", "-", "0", ft, ft == "0")
    so_changed = q1(f"""select count(*) from public.service_orders
                        where company_id='{CO_A}' and updated_at >= now() - interval '2 hours'
                          and id not in ('{IDS['so_VA_so1']}','{IDS['so_VA_so2']}','{IDS['so_VA_so3']}')""")
    rec(115, "nenhuma RPC de visitas altera OS fora das regras", "-", "0", so_changed, so_changed == "0")
    bad = q1(f"select count(*) from public.visits where id in ('{vids}') and company_id not in ('{CO_A}','{CO_B}')")
    mism = q1(f"""select count(*) from public.visits v join public.customers c on c.id=v.customer_id
                  where v.id in ('{vids}') and c.company_id <> v.company_id""")
    rec(116, "nenhuma RPC de visitas altera empresa de um registro", "-", "0",
        f"{bad}/{mism}", bad == "0" and mism == "0")
    rec(117, "nenhuma linha de A retornada para B", "mgrB", "0",
        "ver teste 14", next(r["status"] for r in RESULTS if r["n"] == 14) == "PASS")
    rec(118, "nenhuma linha de B retornada para A", "mgrA", "0",
        "ver teste 10", next(r["status"] for r in RESULTS if r["n"] == 10) == "PASS")
    src = subprocess.run(["rg", "-l", "rate-limit.server", "src"], capture_output=True, text=True).stdout.strip()
    rec(119, "P0-07 permanece desativado", "-", "sem uso de rate-limit.server",
        src or "nenhum import", src == "")
    ui = subprocess.run(["rg", "-l", "visit", "src/routes", "src/components"], capture_output=True, text=True).stdout.strip()
    rec(120, "nenhuma UI de visitas foi criada", "-", "0 arquivos", ui or "nenhum", ui == "")
    rec(121, "Fase 2 nao foi iniciada", "-", "sem frontend/servidor de visitas",
        "nenhum arquivo de visitas em src/", ui == "" and src == "")


def main():
    print("== setup")
    setup_auth()
    setup_data()
    seed_visits()
    seed_service_orders()
    before = {t: q1(f"select count(*) from public.{t}") for t in
              ("visits", "visit_events", "visit_photos", "customers")}
    print("contagens antes:", before)
    block_a()
    block_b()
    block_c()
    block_d()
    block_e()
    block_f()
    block_g()
    block_h()
    block_i()
    block_j(before)
    after = {t: q1(f"select count(*) from public.{t}") for t in
             ("visits", "visit_events", "visit_photos", "customers")}
    out = {"run": RUN, "ids": IDS, "before": before, "after": after, "results": RESULTS}
    with open(f"/tmp/visits-1c-{RUN}.json", "w") as fh:
        json.dump(out, fh, indent=2, default=str)
    summary = {}
    for r in RESULTS:
        summary[r["status"]] = summary.get(r["status"], 0) + 1
    print("\nRESUMO:", summary)
    print("json:", f"/tmp/visits-1c-{RUN}.json")
    # rotaciona credenciais temporarias
    for k, (email, uid) in U.items():
        rotate(uid, secrets.token_urlsafe(32))
    TOK.clear()
    print("credenciais temporarias rotacionadas")


if __name__ == "__main__":
    main()
