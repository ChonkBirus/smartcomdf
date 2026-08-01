#!/usr/bin/env python3
"""
FASE 1C — Reexecucao dirigida apos as correcoes VIS-DRIFT-01 e VIS-DRIFT-02.
Cobre: snapshot de endereco/coordenadas, distancia, dominio de status,
transicoes com pausas multiplas, visita com OS e smoke tests.
Somente fixtures QA. Nunca imprime senhas ou tokens.
"""
import os, secrets, subprocess, uuid, datetime, json
import requests

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
    "mgrB": ("qa.visits.manager.b@example.com", "067d7732-93a6-41b7-9786-ccac541f3e34"),
}
TOK, IDS, RESULTS = {}, {}, []

# ponto de referencia conhecido (Brasilia) e ponto de check-in a ~1.2 km
REF_LAT, REF_LON = -15.794200, -47.882200
IN_LAT, IN_LON = -15.805000, -47.882200   # ~1200 m ao sul


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


def admin_delete(table, filt):
    r = requests.delete(f"{URL}/rest/v1/{table}?{filt}",
                        headers={"apikey": SR, "Authorization": f"Bearer {SR}",
                                 "Prefer": "return=minimal"}, timeout=30)
    if r.status_code >= 300:
        raise RuntimeError(f"admin_delete {table}: {r.status_code} {r.text[:200]}")


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


def hdr(who):
    h = {"apikey": ANON, "Content-Type": "application/json"}
    if who:
        h["Authorization"] = f"Bearer {TOK[who]}"
    return h


def rpc(who, fn, args):
    r = requests.post(f"{URL}/rest/v1/rpc/{fn}", headers=hdr(who), json=args, timeout=60)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, r.text


def ok(code):
    return code in (200, 204)


def err(body):
    if isinstance(body, dict):
        return (body.get("message") or "") + " " + (body.get("hint") or "")
    return str(body)


def rec(n, desc, user, expected, got, res, ids=""):
    status = "PASS" if res is True else ("FAIL" if res is False else res)
    RESULTS.append(dict(n=str(n), desc=desc, user=user, expected=expected,
                        got=str(got)[:200], status=status, ids=ids))
    print(f"{str(n):>6} {status:<8} {desc[:74]}")


def sql_esc(s):
    return s.replace("'", "''")


def setup_auth():
    pw = {}
    for k, (email, uid) in U.items():
        p = secrets.token_urlsafe(24)
        rotate(uid, p)
        pw[k] = p
    for k, (email, uid) in U.items():
        TOK[k] = login(email, pw[k])
    pw.clear()


def setup_data():
    for co, sfx in ((CO_A, "A"), (CO_B, "B")):
        cid = q1(f"""insert into public.customers(company_id,name,cpf_cnpj,customer_type)
                     values('{co}','{sql_esc(TAG)} Cliente {sfx}','QA{RUN}{sfx}','INDIVIDUAL')
                     returning id""")
        # endereco SEM coordenadas
        aid = q1(f"""insert into public.customer_addresses(company_id,customer_id,address_type,street,number,district,city,state,zipcode)
                     values('{co}','{cid}','INSTALLATION','QA Street','1','QA','Brasilia','DF','70000{sfx=="A" and "000" or "111"}')
                     returning id""")
        ct = q1(f"""insert into public.customer_contacts(company_id,customer_id,name)
                    values('{co}','{cid}','{sql_esc(TAG)} Contato {sfx}') returning id""")
        IDS[f"customer_{sfx}"] = cid
        IDS[f"address_{sfx}"] = aid
        IDS[f"contact_{sfx}"] = ct
    # endereco COM coordenadas (empresa A)
    IDS["address_A_geo"] = q1(f"""insert into public.customer_addresses(
        company_id,customer_id,address_type,street,number,district,city,state,zipcode,latitude,longitude)
        values('{CO_A}','{IDS['customer_A']}','INSTALLATION','QA Geo','99','QA','Brasilia','DF','70000999',
               {REF_LAT},{REF_LON}) returning id""")


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


def snap(vid):
    s = q1(f"select coalesce(address_snapshot::text,'null') from public.visits where id='{vid}'")
    return json.loads(s)


def events(vid):
    return [r[0] for r in q(f"""select event_type from public.visit_events
             where visit_id='{vid}' order by created_at, id""")]


# =====================================================================
# VIS-DRIFT-01
# =====================================================================
def drift01():
    # 1-4: endereco sem coordenadas
    p = mk_payload("A", customer_address_id=IDS["address_A"],
                   assigned_technician_id=U["tecA1"][1], title=f"{TAG} sem coord")
    c, v = create_visit("mgrA", p)
    rec("D01.1", "create_visit com endereco sem coordenadas nao falha", "mgrA",
        "200 + uuid", (c, str(v)[:40]), ok(c) and isinstance(v, str))
    if not ok(c):
        return
    IDS["V_nocoord"] = v
    s = snap(v)
    zc = q1(f"select zipcode from public.customer_addresses where id='{IDS['address_A']}'")
    rec("D01.3", "address_snapshot.zip_code vem de customer_addresses.zipcode", "mgrA",
        zc, s.get("zip_code"), s.get("zip_code") == zc, v)
    rec("D01.4", "latitude/longitude nulas no snapshot", "mgrA", "null/null",
        (s.get("latitude"), s.get("longitude")),
        s.get("latitude") is None and s.get("longitude") is None, v)

    # 5: check-in GPS -> distance_m null
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": IN_LAT, "_lon": IN_LON,
                                           "_accuracy_m": 10, "_manual_reason": None,
                                           "_client_request_id": str(uuid.uuid4())})
    d = q1(f"select coalesce(checkin_distance_m::text,'NULL') from public.visits where id='{v}'")
    rec("D01.5", "check-in GPS sem coordenadas no snapshot -> distance_m null", "tecA1",
        "200 + NULL", (c, d), ok(c) and d == "NULL", v)

    # 6-8: endereco COM coordenadas -> congelamento
    p = mk_payload("A", customer_address_id=IDS["address_A_geo"],
                   assigned_technician_id=U["tecA1"][1], title=f"{TAG} com coord")
    c, v2 = create_visit("mgrA", p)
    IDS["V_geo"] = v2
    s2 = snap(v2)
    rec("D01.8", "coordenadas congeladas no snapshot", "mgrA", f"{REF_LAT}/{REF_LON}",
        (s2.get("latitude"), s2.get("longitude")),
        abs(float(s2.get("latitude")) - REF_LAT) < 1e-6 and
        abs(float(s2.get("longitude")) - REF_LON) < 1e-6, v2)

    # 9-10: alterar endereco depois nao muda o snapshot
    admin_patch("customer_addresses", f"id=eq.{IDS['address_A_geo']}",
                {"latitude": -10.0, "longitude": -40.0})
    s3 = snap(v2)
    rec("D01.10", "alteracao posterior no endereco nao altera o snapshot", "mgrA",
        "snapshot inalterado", (s3.get("latitude"), s3.get("longitude")),
        s3 == s2, v2)

    # 11-12: check-in em coordenada conhecida -> distancia com tolerancia
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v2, "_lat": IN_LAT, "_lon": IN_LON,
                                           "_accuracy_m": 8, "_manual_reason": None,
                                           "_client_request_id": str(uuid.uuid4())})
    dist = q1(f"select coalesce(checkin_distance_m::text,'NULL') from public.visits where id='{v2}'")
    good = dist != "NULL" and 1100 <= float(dist) <= 1300
    rec("D01.12", "distance_m calculada com tolerancia (~1200 m +/-100)", "tecA1",
        "1100..1300 m", dist, ok(c) and good, v2)

    # 13: check-out grava checkout_distance_m (fluxo completo pos VIS-DRIFT-02)
    for tgt in ("IN_PROGRESS", "COMPLETED"):
        rpc("tecA1", "visit_execute_transition", {"_visit_id": v2, "_target": tgt,
                                                  "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": v2, "_lat": IN_LAT, "_lon": IN_LON,
                                            "_accuracy_m": 8, "_manual_reason": None,
                                            "_client_request_id": str(uuid.uuid4())})
    od = q1(f"select coalesce(checkout_distance_m::text,'NULL') from public.visits where id='{v2}'")
    rec("D01.13", "check-out grava checkout_distance_m", "tecA1", "1100..1300 m",
        (c, od), ok(c) and od != "NULL" and 1100 <= float(od) <= 1300, v2)

    # ---- reexecucao dos testes originais 27, 56 e 91 ----
    key = str(uuid.uuid4())
    base = mk_payload("A", title=f"{TAG} idem", assigned_technician_id=U["tecA1"][1])
    c1, v1 = create_visit("mgrA", base, key)
    IDS["V_idem"] = v1
    p27 = dict(base); p27["customer_address_id"] = IDS["address_A"]
    c27, b27 = create_visit("mgrA", p27, key)
    rec(27, "mesma chave com endereco diferente -> idempotency_key_reused", "mgrA",
        "idempotency_key_reused", err(b27)[:90], "idempotency_key_reused" in err(b27), v1)

    c, v56 = create_visit("mgrA", mk_payload("A", customer_address_id=IDS["address_A_geo"],
                                             assigned_technician_id=U["tecA1"][1],
                                             title=f"{TAG} t56"))
    IDS["V_56"] = v56
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": v56, "_lat": IN_LAT, "_lon": IN_LON,
                                           "_accuracy_m": 12, "_manual_reason": None,
                                           "_client_request_id": str(uuid.uuid4())})
    row = q(f"""select coalesce(checkin_latitude::text,'NULL'),
                       coalesce(checkin_distance_m::text,'NULL'),
                       coalesce(checked_in_at::text,'NULL') from public.visits where id='{v56}'""")[0]
    ev = q1(f"select count(*) from public.visit_events where visit_id='{v56}' and event_type='CHECKED_IN'")
    rec(56, "GPS valido -> coordenadas, distancia e um evento", "tecA1",
        "lat/dist/1 evento", f"{row} ev={ev}",
        ok(c) and row[0] != "NULL" and row[1] != "NULL" and ev == "1", v56)

    for tgt in ("IN_PROGRESS", "COMPLETED"):
        rpc("tecA1", "visit_execute_transition", {"_visit_id": v56, "_target": tgt,
                                                  "_payload": {}, "_client_request_id": str(uuid.uuid4())})
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": v56, "_lat": IN_LAT, "_lon": IN_LON,
                                            "_accuracy_m": 9, "_manual_reason": None,
                                            "_client_request_id": str(uuid.uuid4())})
    row = q(f"""select coalesce(checkout_distance_m::text,'NULL'),
                       coalesce(checked_out_at::text,'NULL') from public.visits where id='{v56}'""")[0]
    ev = q1(f"select count(*) from public.visit_events where visit_id='{v56}' and event_type='CHECKED_OUT'")
    rec(91, "check-out GPS grava distancia e um evento", "tecA1", "distancia + 1 evento",
        f"{row} ev={ev}", ok(c) and row[0] != "NULL" and ev == "1", v56)


# =====================================================================
# VIS-DRIFT-02
# =====================================================================
def drift02():
    c, v = create_visit("mgrA", mk_payload("A", assigned_technician_id=U["tecA1"][1],
                                           title=f"{TAG} fluxo"))
    IDS["V_flow"] = v
    rpc("tecA1", "visit_check_in", {"_visit_id": v, "_lat": REF_LAT, "_lon": REF_LON,
                                    "_accuracy_m": 8, "_manual_reason": None,
                                    "_client_request_id": str(uuid.uuid4())})

    def tr(target):
        return rpc("tecA1", "visit_execute_transition",
                   {"_visit_id": v, "_target": target, "_payload": {},
                    "_client_request_id": str(uuid.uuid4())})

    def st():
        return q1(f"select status from public.visits where id='{v}'")

    c, b = tr("IN_PROGRESS")
    rec(73, "CHECKED_IN -> IN_PROGRESS", "tecA1", "200", (c, err(b)[:60]), ok(c), v)
    rec("D02.2", "status persistido = IN_PROGRESS", "tecA1", "IN_PROGRESS", st(), st() == "IN_PROGRESS", v)
    rec("D02.3", "evento STARTED registrado", "tecA1", "STARTED", events(v)[-1],
        events(v)[-1] == "STARTED", v)

    c, b = tr("PAUSED")
    rec(74, "IN_PROGRESS -> PAUSED", "tecA1", "200", (c, err(b)[:60]), ok(c), v)
    rec("D02.5", "status persistido = PAUSED", "tecA1", "PAUSED", st(), st() == "PAUSED", v)
    rec("D02.6", "evento PAUSED registrado", "tecA1", "PAUSED", events(v)[-1],
        events(v)[-1] == "PAUSED", v)

    c, b = tr("IN_PROGRESS")
    rec(75, "PAUSED -> IN_PROGRESS (retomada)", "tecA1", "200", (c, err(b)[:60]), ok(c), v)
    rec("D02.8", "status persistido = IN_PROGRESS", "tecA1", "IN_PROGRESS", st(),
        st() == "IN_PROGRESS", v)
    rec("D02.9", "evento RESUMED registrado", "tecA1", "RESUMED", events(v)[-1],
        events(v)[-1] == "RESUMED", v)

    tr("PAUSED"); tr("IN_PROGRESS")
    seq = events(v)
    rec("D02.10", "segunda pausa/retomada registra PAUSED e RESUMED", "tecA1",
        "...PAUSED,RESUMED", seq[-2:], seq[-2:] == ["PAUSED", "RESUMED"], v)

    c, b = tr("COMPLETED")
    rec(76, "IN_PROGRESS -> COMPLETED", "tecA1", "200", (c, err(b)[:60]),
        ok(c) and st() == "COMPLETED", v)
    full = events(v)
    expected_tail = ["CHECKED_IN", "STARTED", "PAUSED", "RESUMED", "PAUSED", "RESUMED", "COMPLETED"]
    rec("D02.11b", "sequencia completa de eventos", "tecA1", str(expected_tail),
        str(full[-7:]), full[-7:] == expected_tail, v)

    n_res = q1(f"""select count(*) from public.visits where status='RESUMED'""")
    rec("D02.12", "nenhum status RESUMED persistido em visits", "-", "0", n_res, n_res == "0")

    c, b = rpc("tecA1", "visit_execute_transition",
               {"_visit_id": v, "_target": "RESUMED", "_payload": {},
                "_client_request_id": str(uuid.uuid4())})
    rec("D02.13", "target RESUMED -> invalid_target_status", "tecA1",
        "invalid_target_status", err(b)[:60], "invalid_target_status" in err(b), v)

    # 14: visita com OS bloqueia IN_PROGRESS, PAUSED e COMPLETED
    c, vso = create_visit("mgrA", mk_payload("A", assigned_technician_id=U["tecA1"][1],
                                             title=f"{TAG} com OS"))
    IDS["V_so"] = vso
    pid = q1(f"""insert into public.projects(company_id,customer_id,project_number,title,status)
                 values('{CO_A}','{IDS['customer_A']}','QA-{RUN}','{sql_esc(TAG)} Projeto','DRAFT')
                 returning id""")
    IDS["project"] = pid
    soid = q1(f"""insert into public.service_orders(company_id,project_id,customer_id,service_order_number,title,status)
                  values('{CO_A}','{pid}','{IDS['customer_A']}','QAOS-{RUN}','{sql_esc(TAG)} OS','SCHEDULED')
                  returning id""")
    IDS["so"] = soid
    admin_patch("visits", f"id=eq.{vso}", {"service_order_id": soid})
    rpc("tecA1", "visit_check_in", {"_visit_id": vso, "_lat": REF_LAT, "_lon": REF_LON,
                                    "_accuracy_m": 8, "_manual_reason": None,
                                    "_client_request_id": str(uuid.uuid4())})
    allb = []
    for tgt in ("IN_PROGRESS", "PAUSED", "COMPLETED"):
        c, b = rpc("tecA1", "visit_execute_transition",
                   {"_visit_id": vso, "_target": tgt, "_payload": {},
                    "_client_request_id": str(uuid.uuid4())})
        allb.append((tgt, "blocked_by_service_order" in err(b)))
    rec(14 if False else "D02.14", "visita com OS bloqueia IN_PROGRESS/PAUSED/COMPLETED", "tecA1",
        "blocked_by_service_order x3", allb, all(x[1] for x in allb), vso)

    so_status = q1(f"select status from public.service_orders where id='{soid}'")
    rec("D02.15", "nenhuma funcao de visita alterou a OS", "-", "SCHEDULED", so_status,
        so_status == "SCHEDULED", soid)


# =====================================================================
# SMOKE
# =====================================================================
def smoke():
    # criacao
    c, v = create_visit("mgrA", mk_payload("A", title=f"{TAG} smoke"))
    rec("S1", "smoke criacao de visita", "mgrA", "200", (c, str(v)[:36]), ok(c))
    IDS["V_smoke"] = v if ok(c) else None

    # idempotencia
    k = str(uuid.uuid4())
    p = mk_payload("A", title=f"{TAG} smoke idem")
    c1, a = create_visit("mgrA", p, k)
    c2, b = create_visit("mgrA", p, k)
    rec("S2", "smoke idempotencia create_visit (mesma chave -> mesmo id)", "mgrA",
        "mesmo id", f"{a}=={b}", a == b, a)
    IDS["V_smoke2"] = a

    # RLS multiempresa
    c, vb = create_visit("mgrB", mk_payload("B", title=f"{TAG} smoke B"))
    IDS["V_smokeB"] = vb
    r = requests.get(f"{URL}/rest/v1/visits?select=id&id=eq.{vb}", headers=hdr("mgrA"), timeout=30)
    rec("S3", "smoke RLS: gestor A nao le visita da empresa B", "mgrA", "[]",
        r.text[:60], r.json() == [], vb)
    r2 = requests.get(f"{URL}/rest/v1/visits?select=id&id=eq.{IDS['V_smoke']}", headers=hdr("mgrB"), timeout=30)
    rec("S4", "smoke RLS: gestor B nao le visita da empresa A", "mgrB", "[]",
        r2.text[:60], r2.json() == [])

    # tecnico atribuido
    c, vt = create_visit("mgrA", mk_payload("A", assigned_technician_id=U["tecA1"][1],
                                            title=f"{TAG} smoke tec"))
    IDS["V_smoketec"] = vt
    c, b = rpc("tecA1", "list_my_visits", {})
    got = [x.get("id") for x in b] if isinstance(b, list) else []
    rec("S5", "smoke tecnico atribuido enxerga a propria visita", "tecA1", "contem id",
        len(got), ok(c) and vt in got, vt)
    c, b2 = rpc("tecA2", "list_my_visits", {})
    got2 = [x.get("id") for x in b2] if isinstance(b2, list) else []
    rec("S6", "smoke tecnico A2 nao enxerga visita de A1", "tecA2", "nao contem id",
        len(got2), vt not in got2, vt)

    # check-in / check-out
    c, b = rpc("tecA1", "visit_check_in", {"_visit_id": vt, "_lat": REF_LAT, "_lon": REF_LON,
                                           "_accuracy_m": 7, "_manual_reason": None,
                                           "_client_request_id": str(uuid.uuid4())})
    rec("S7", "smoke check-in", "tecA1", "200", (c, err(b)[:50]), ok(c), vt)
    for tgt in ("IN_PROGRESS", "COMPLETED"):
        rpc("tecA1", "visit_execute_transition", {"_visit_id": vt, "_target": tgt, "_payload": {},
                                                  "_client_request_id": str(uuid.uuid4())})
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vt, "_lat": REF_LAT, "_lon": REF_LON,
                                            "_accuracy_m": 7, "_manual_reason": None,
                                            "_client_request_id": str(uuid.uuid4())})
    rec("S8", "smoke check-out apos COMPLETED", "tecA1", "200", (c, err(b)[:60]), ok(c), vt)

    # visita vinculada a OS: check-out bloqueado enquanto OS ativa
    vso = IDS["V_so"]
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vso, "_lat": REF_LAT, "_lon": REF_LON,
                                            "_accuracy_m": 8, "_manual_reason": None,
                                            "_client_request_id": str(uuid.uuid4())})
    rec("S9", "smoke visita com OS: check-out bloqueado com OS SCHEDULED", "tecA1",
        "blocked_by_service_order", err(b)[:60], "blocked_by_service_order" in err(b), vso)
    admin_patch("service_orders", f"id=eq.{IDS['so']}", {"status": "COMPLETED"})
    c, b = rpc("tecA1", "visit_check_out", {"_visit_id": vso, "_lat": REF_LAT, "_lon": REF_LON,
                                            "_accuracy_m": 8, "_manual_reason": None,
                                            "_client_request_id": str(uuid.uuid4())})
    rec("S10", "smoke visita com OS: check-out liberado com OS COMPLETED", "tecA1",
        "200", (c, err(b)[:60]), ok(c), vso)


def audit():
    checks = [
        ("A1", "customer_addresses continua usando zipcode",
         q1("select count(*) from information_schema.columns where table_schema='public' and table_name='customer_addresses' and column_name='zipcode'") == "1"),
        ("A2", "nenhuma coluna zip_code criada em customer_addresses",
         q1("select count(*) from information_schema.columns where table_schema='public' and table_name='customer_addresses' and column_name='zip_code'") == "0"),
        ("A3", "latitude e longitude nullable",
         q1("select count(*) from information_schema.columns where table_schema='public' and table_name='customer_addresses' and column_name in ('latitude','longitude') and is_nullable='YES'") == "2"),
        ("A4", "constraints geograficas ativas",
         q1("select count(*) from pg_constraint where conrelid='public.customer_addresses'::regclass and conname in ('customer_addresses_lat_range','customer_addresses_lon_range','customer_addresses_latlon_pair')") == "3"),
        ("A5", "create_visit usa v_addr_row.zipcode",
         "v_addr_row.zipcode" in q1("select pg_get_functiondef(oid) from pg_proc where proname='create_visit'")),
        ("A6", "address_snapshot mantem a chave JSON zip_code",
         "'zip_code'" in q1("select pg_get_functiondef(oid) from pg_proc where proname='create_visit'")),
        ("A7", "_visit_distance_m usa address_snapshot",
         "address_snapshot" in q1("select pg_get_functiondef(oid) from pg_proc where proname='_visit_distance_m'")
         and "customer_addresses" not in q1("select pg_get_functiondef(oid) from pg_proc where proname='_visit_distance_m'")),
        ("A8", "visits_status_chk contem IN_PROGRESS e PAUSED",
         all(s in q1("select pg_get_constraintdef(oid) from pg_constraint where conname='visits_status_chk'") for s in ("IN_PROGRESS", "PAUSED"))),
        ("A9", "visits_status_chk nao contem RESUMED",
         "RESUMED" not in q1("select pg_get_constraintdef(oid) from pg_constraint where conname='visits_status_chk'")),
        ("A10", "visit_events aceita RESUMED",
         "RESUMED" in q1("select pg_get_constraintdef(oid) from pg_constraint where conname='visit_events_type_check'")),
        ("A11", "visit_execute_transition nunca persiste RESUMED em status",
         "IF _target = 'RESUMED' THEN RAISE EXCEPTION 'invalid_target_status'" in q1("select pg_get_functiondef(oid) from pg_proc where proname='visit_execute_transition'")),
        ("A12", "nenhuma funcao de visitas altera service_orders",
         q1("""select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and (p.proname like 'visit%' or p.proname like '%_visit%')
                 and pg_get_functiondef(p.oid) ~* 'update[[:space:]]+public\\.service_orders'""") == "0"),
    ]
    for n, desc, res in checks:
        rec(n, desc, "-", "ok", res, bool(res))


def cleanup():
    vids = [IDS[k] for k in IDS if k.startswith("V_") and IDS[k]]
    if vids:
        lst = ",".join(vids)
        admin_delete("visit_photos", f"visit_id=in.({lst})")
        admin_delete("visit_events", f"visit_id=in.({lst})")
        admin_delete("visits", f"id=in.({lst})")
    if IDS.get("so"):
        admin_delete("service_orders", f"id=eq.{IDS['so']}")
    if IDS.get("project"):
        admin_delete("projects", f"id=eq.{IDS['project']}")
    custs = [IDS[k] for k in ("customer_A", "customer_B") if IDS.get(k)]
    if custs:
        cl = ",".join(custs)
        admin_delete("customer_contacts", f"customer_id=in.({cl})")
        admin_delete("customer_addresses", f"customer_id=in.({cl})")
        admin_delete("customers", f"id=in.({cl})")
    left = q1(f"select count(*) from public.visits where title like '%{RUN}%'")
    print(f"\nlimpeza: visitas remanescentes com este run = {left}")
    return left


if __name__ == "__main__":
    setup_auth()
    setup_data()
    try:
        drift01()
        drift02()
        smoke()
        audit()
    finally:
        left = cleanup()
    from collections import Counter
    cnt = Counter(r["status"] for r in RESULTS)
    print("\n== RESUMO ==", dict(cnt))
    with open("/tmp/drift-rerun.json", "w") as f:
        json.dump({"results": RESULTS, "summary": dict(cnt), "leftover": left}, f, indent=1)
    for r in RESULTS:
        if r["status"] != "PASS":
            print("!!", r["n"], r["status"], r["desc"], "|", r["got"])
