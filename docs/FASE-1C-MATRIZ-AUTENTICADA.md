# FASE 1C — Matriz autenticada completa (Visitas Técnicas)

Execução: 2026-07-31 (preview/staging) — run `20260731205646`
Runner: `tests/e2e/visits-phase1c-matrix.py` (sessões reais via Supabase Auth, JWT real, RLS real)
Senhas temporárias apenas em memória, rotacionadas ao final. Nenhum token/segredo registrado.

## Resumo

| Métrica | Valor |
|---|---|
| PASS | **114** |
| FAIL | **3** (73, 74, 75) |
| BLOCKED | **4** (27, 56, 76, 91) |
| NOT RUN | **1** (magic bytes) |
| INFRA-STORAGE-01 | FAIL — risco conhecido aceito (fora desta matriz, não reexecutado) |
| Falhas de segurança | **nenhuma** |
| Isolamento multiempresa | OK (9,10,12,14,17,18,34–38,52,116–118) |
| Idempotência | OK (25–33,40,41,47,48,53,54,68,69,94,95,106,107) |
| Concorrência | OK (40,41,107) |
| Limpeza | concluída e confirmada |
| Fixtures QA mantidas | 5 usuários, 2 empresas |
| UI criada | nenhuma |
| Fase 2 | não iniciada |

Permissão adicional documentada: o papel `manager` possui `visits.view_assigned_only` além de `visits.view`.
Comportamento validado: `scope=all` permitido; `scope=mine` retorna somente visitas atribuídas ao próprio gestor (teste 17).

## Achados abertos (sem correção automática)

### VIS-DRIFT-01 — `create_visit` referencia colunas inexistentes de `customer_addresses` (bloqueia snapshot e GPS)
- Testes afetados: 27 (BLOCKED), 56 e 91 (BLOCKED — distância nula).
- Causa-raiz: `create_visit` monta `address_snapshot` com `v_addr_row.zip_code`, `latitude`, `longitude`; a tabela real possui `zipcode` e **não possui** `latitude`/`longitude`. Qualquer criação com `customer_address_id` falha com `record "v_addr_row" has no field "zip_code"`, e sem snapshot o `_visit_distance_m` sempre retorna NULL.
- Evidência: erro PostgREST 42703 no teste 27; `checkin_distance_m` e `checkout_distance_m` nulos com GPS válido (testes 56/91).
- Impacto: visitas não podem ser vinculadas a endereço; validação de distância de check-in/out inoperante.
- Correção sugerida (aguardando autorização): ajustar o snapshot para `zipcode` e adicionar `latitude`/`longitude` a `customer_addresses` (ou remover do snapshot e usar outra fonte de coordenadas).
- Rollback: `CREATE OR REPLACE FUNCTION` restaurando a versão atual / `ALTER TABLE ... DROP COLUMN`.

### VIS-DRIFT-02 — Estados `IN_PROGRESS`, `PAUSED`, `RESUMED` não existem no domínio de visitas
- Testes afetados: 73, 74, 75 (FAIL), 76 (BLOCKED).
- Causa-raiz: `visits_status_check` permite apenas DRAFT, SCHEDULED, CONFIRMED, ON_THE_WAY, CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW; `visit_execute_transition` responde `invalid_transition_target`.
- Impacto: execução em andamento/pausa fica delegada à OS, conforme desenho aprovado, mas a matriz exigia esses estados também sem OS.
- Observação: os testes 79 e 80 (bloqueio com OS) passam por efeito equivalente — a transição é recusada.
- Correção sugerida (aguardando autorização): estender o CHECK e o mapa de transições, ou remover formalmente 73–76 do escopo.
- Rollback: reverter CHECK e função para as versões atuais.

### Magic bytes — NOT RUN
Rota server-side de upload ainda não existe; não classificado como PASS.

## Observação técnica de método
- `visits`, `visit_events`, `visit_photos` e `visit_number_counters` têm GRANT amplo a `authenticated`, porém **sem policies de INSERT/UPDATE/DELETE**: as escritas diretas retornam 2xx afetando **zero linhas** (RLS deny), o que foi verificado por conferência de dados antes/depois (testes 1–7).
- Funções `RETURNS void` respondem HTTP 204 no PostgREST; considerado sucesso.

## Contagens (limpeza)

| Objeto | Antes da matriz | Após limpeza |
|---|---|---|
| visits (total) | 49 | 0 |
| visit_events | 75 | 0 |
| visit_photos | 2 | 0 |
| objetos no bucket visit-photos | 5 | 0 |
| clientes/endereços/contatos [QA-VISITS] | 11 | 0 |
| OS/projeto [QA-VISITS] | 3 / 1 | 0 / 0 |
| contas QA | 5 | **5 (mantidas)** |
| empresas QA | 2 | **2 (mantidas)** |

Nenhum dado real de cliente foi criado, lido ou alterado; toda a execução ficou restrita às duas empresas QA.

## Matriz detalhada

| # | Teste | Usuário | Esperado | Obtido | Status |
|---|---|---|---|---|---|
| 1 | INSERT direto em visits negado | mgrA | denied | (403, 'new row violates row-level security policy for table "visits" ') | **PASS** |
| 2 | UPDATE direto em visits negado | mgrA | 0 linhas afetadas | (200, '[]', '[QA-VISITS] run=20260731205646 main') | **PASS** |
| 3 | DELETE direto em visits negado | mgrA | 0 linhas afetadas | (200, '[]', 'alive=1') | **PASS** |
| 4 | INSERT direto em visit_events negado | mgrA | denied | (403, 'new row violates row-level security policy for table "visit_events" ') | **PASS** |
| 5 | UPDATE/DELETE direto em visit_events negado | mgrA | 0 linhas afetadas | (200, 200, '1->1', 'hack=0') | **PASS** |
| 6 | INSERT direto em visit_photos negado | mgrA | denied | (403, 'new row violates row-level security policy for table "visit_photos" ') | **PASS** |
| 7 | authenticated nao acessa visit_number_counters | mgrA | 0 linhas (RLS sem policy) | (200, '[]', 'linhas_reais=2') | **PASS** |
| 8 | upload direto no bucket visit-photos negado | tecA1 | denied | (400, '{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy","code":"AccessDenied"}') | **PASS** |
| 9 | Gestor A ve todas as visitas da Empresa A | mgrA | 10 visitas | 10 encontradas | **PASS** |
| 10 | Gestor A nao ve visitas da Empresa B | mgrA | 0 de B | False | **PASS** |
| 11 | Tecnico A1 ve somente visitas atribuidas a A1 | tecA1 | somente A1 | 45 linhas | **PASS** |
| 12 | Tecnico A2 nao ve visitas de A1 | tecA2 | 0 | 0 | **PASS** |
| 13 | Usuario stock recebe zero linhas | stockA | 0 linhas | (200, 0) | **PASS** |
| 14 | Gestor B nao ve visitas da Empresa A | mgrB | 0 de A | 0 | **PASS** |
| 15 | list_my_visits do stock -> sem permissao (0 linhas) | stockA | forbidden/0 | (200, 0) | **PASS** |
| 16 | calendario scope=all do Gestor A permitido | mgrA | 200 | 200 | **PASS** |
| 17 | calendario scope=mine do Gestor A -> somente atribuidas a ele | mgrA | 5 visitas do gestor | 5 | **PASS** |
| 18 | calendario scope=mine do Tecnico A1 -> somente A1 | tecA1 | 45 visitas de A1 | 45 | **PASS** |
| 19 | calendario scope=all do Tecnico A1 -> forbidden_scope_all | tecA1 | forbidden_scope_all | forbidden_scope_all  | **PASS** |
| 20 | scope invalido -> invalid_scope | mgrA | invalid_scope | invalid_scope  | **PASS** |
| 21 | intervalo > 93 dias -> range_too_large | mgrA | range_too_large | range_too_large  | **PASS** |
| 22 | create_visit cria visita + evento CREATED | mgrA | 1 visita/1 CREATED | CREATED=1 | **PASS** |
| 23 | visit_number segue VIS-000000 | mgrA | VIS-XXXXXX | VIS-000049 | **PASS** |
| 24 | Empresa B possui numeracao isolada | mgrB | contadores independentes | A=58 B=5 numB=VIS-000005 | **PASS** |
| 25 | retry mesma chave e mesma intencao -> mesmo ID | mgrA | mesmo id | 7e4a99a8-6cd2-4849-a70c-2af40e213825==7e4a99a8-6cd2-4849-a70c-2af40e213825 | **PASS** |
| 26 | mesma chave com customer diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | customer_cross_company  | **PASS** |
| 27 | mesma chave com endereco diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | record "v_addr_row" has no field "zip_code"  | **BLOCKED** |
| 28 | mesma chave com contato diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 29 | mesma chave com responsavel diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 30 | mesma chave com tecnico diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 31 | mesma chave com visit_type diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 32 | mesma chave com data diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 33 | mesma chave com titulo diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 34 | cliente cross-company -> bloqueado | mgrA | customer_cross_company | customer_cross_company  | **PASS** |
| 35 | endereco cross-company -> bloqueado | mgrA | address_cross_company | address_cross_company  | **PASS** |
| 36 | contato cross-company -> bloqueado | mgrA | contact_cross_company | contact_cross_company  | **PASS** |
| 37 | responsavel cross-company -> bloqueado | mgrA | responsible_cross_company | responsible_cross_company  | **PASS** |
| 38 | tecnico cross-company -> bloqueado | mgrA | technician_cross_company | technician_cross_company  | **PASS** |
| 39 | timestamp invalido -> erro de dominio | mgrA | invalid_scheduled_start_at | invalid_scheduled_start_at  | **PASS** |
| 40 | duas chamadas concorrentes mesma chave -> mesmo ID | mgrA | 1 id unico | [(200, 'b13296be-dc29-40f3-aaf9-0f2b19b82864'), (200, 'b13296be-dc29-40f3-aaf9-0f2b19b82864')] | **PASS** |
| 41 | exatamente um evento CREATED | mgrA | 1 | visits=1 created=1 | **PASS** |
| 42 | exatamente uma notificacao ao tecnico | mgrA | 1 | 1 | **PASS** |
| 43 | reagendamento em DRAFT permitido | mgrA | 200 | (204, '') | **PASS** |
| 44 | reagendamento em SCHEDULED permitido | mgrA | 200 | (204, '') | **PASS** |
| 45 | reagendamento em CONFIRMED permitido | mgrA | 200 | (204, '') | **PASS** |
| 46 | reagendamento em estado incompativel bloqueado | mgrA | schedule_not_editable | schedule_not_editable  | **PASS** |
| 47 | retry identico -> um evento | mgrA | 1 | 1 | **PASS** |
| 48 | retry divergente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 49 | termino <= inicio bloqueado | mgrA | schedule_invalid_range | schedule_invalid_range  | **PASS** |
| 50 | atribuir Tecnico A1 -> sucesso | mgrA | 200 | (204, '') | **PASS** |
| 51 | reatribuir para Tecnico A2 -> sucesso | mgrA | 200 | (204, '') | **PASS** |
| 52 | atribuir usuario da Empresa B -> technician_cross_company | mgrA | technician_cross_company | technician_cross_company  | **PASS** |
| 53 | retry identico -> um evento e uma notificacao | mgrA | 1/1 | ev=1 notif=1 | **PASS** |
| 54 | mesma chave com tecnico diferente -> idempotency_key_reused | mgrA | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 55 | client_request_id NULL -> client_request_id_required | tecA1 | client_request_id_required | client_request_id_required  | **PASS** |
| 56 | GPS valido -> coordenadas, distancia e um evento | tecA1 | lat/dist/1 evento | ['-15.795000', '', '2026-07-31 20:57:48.41841+00'] ev=1 | **BLOCKED** |
| 57 | check-in manual valido -> sucesso | tecA1 | 200 | (204, '') | **PASS** |
| 58 | check-in manual sem justificativa suficiente -> bloqueado | tecA1 | manual_reason_too_short | manual_reason_too_short  | **PASS** |
| 59 | check-in manual com latitude/longitude -> bloqueado | tecA1 | gps_and_manual_reason_conflict | gps_and_manual_reason_conflict  | **PASS** |
| 60 | check-in manual com accuracy -> bloqueado | tecA1 | manual_accuracy_not_allowed | manual_accuracy_not_allowed  | **PASS** |
| 61 | check-in GPS com manual_reason -> bloqueado | tecA1 | gps_and_manual_reason_conflict | gps_and_manual_reason_conflict  | **PASS** |
| 62 | check-in apenas latitude -> bloqueado | tecA1 | gps_pair_required | gps_pair_required  | **PASS** |
| 63 | check-in apenas longitude -> bloqueado | tecA1 | gps_pair_required | gps_pair_required  | **PASS** |
| 64 | check-in latitude fora do intervalo -> bloqueado | tecA1 | invalid_latitude | invalid_latitude  | **PASS** |
| 65 | check-in longitude fora do intervalo -> bloqueado | tecA1 | invalid_longitude | invalid_longitude  | **PASS** |
| 66 | check-in accuracy negativa -> bloqueado | tecA1 | invalid_accuracy | invalid_accuracy  | **PASS** |
| 67 | Tecnico A2 em visita de A1 -> forbidden | tecA2 | forbidden | forbidden  | **PASS** |
| 68 | retry identico -> horario e dados preservados | tecA1 | inalterado | ['2026-07-31 20:57:48.41841+00', '-15.795000']==['2026-07-31 20:57:48.41841+00', '-15.795000'] | **PASS** |
| 69 | retry divergente -> idempotency_key_reused | tecA1 | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 70 | exatamente um evento CHECKED_IN | tecA1 | 1 | 1 | **PASS** |
| 71 | CONFIRMED por visits.edit permitido | mgrA | 200 | (204, '') | **PASS** |
| 72 | ON_THE_WAY pelo tecnico atribuido permitido | tecA1 | 200 | (204, '') | **PASS** |
| 73 | IN_PROGRESS apos CHECKED_IN permitido sem OS | tecA1 | 200 | invalid_transition_target  | **FAIL** |
| 74 | PAUSED apos IN_PROGRESS permitido | tecA1 | 200 | invalid_transition_target  | **FAIL** |
| 75 | RESUMED apos PAUSED permitido | tecA1 | 200 | invalid_transition_target  | **FAIL** |
| 76 | segunda pausa/retomada -> timeline coerente | tecA1 | eventos coerentes | PAUSED/RESUMED nao existem no dominio de status | **BLOCKED** |
| 77 | transicao invalida bloqueada | tecA1 | invalid_transition | invalid_transition  | **PASS** |
| 78 | usuario sem visits.execute nao inicia execucao | stockA | forbidden | forbidden  | **PASS** |
| 79 | visita com OS bloqueia IN_PROGRESS pela RPC da visita | tecA1 | bloqueado | invalid_transition_target  | **PASS** |
| 80 | visita com OS bloqueia PAUSED pela RPC da visita | tecA1 | bloqueado | invalid_transition_target  | **PASS** |
| 81 | visita com OS bloqueia COMPLETED pela RPC da visita | tecA1 | blocked_by_service_order | blocked_by_service_order  | **PASS** |
| 82 | COMPLETED sem OS permitido no fluxo correto | tecA1 | 200 | (204, '') | **PASS** |
| 83 | check-out sem OS antes de COMPLETED -> checkout_requires_completed | tecA1 | checkout_requires_completed | checkout_requires_completed  | **PASS** |
| 84 | check-out sem OS apos COMPLETED -> sucesso | tecA1 | 200 | (204, '') | **PASS** |
| 85 | check-out com OS DRAFT -> blocked_by_service_order | tecA1 | blocked_by_service_order | blocked_by_service_order  | **PASS** |
| 86 | check-out com OS SCHEDULED -> blocked_by_service_order | tecA1 | blocked_by_service_order | blocked_by_service_order  | **PASS** |
| 87 | check-out com OS IN_PROGRESS -> blocked_by_service_order | tecA1 | blocked_by_service_order | blocked_by_service_order  | **PASS** |
| 88 | check-out com OS PAUSED -> permitido | tecA1 | 200 | (204, '') | **PASS** |
| 89 | check-out com OS COMPLETED -> permitido | tecA1 | 200 | (204, '') | **PASS** |
| 90 | check-out com OS CANCELLED -> permitido | tecA1 | 200 | (204, '') | **PASS** |
| 91 | check-out GPS grava distancia e um evento | tecA1 | distancia + 1 evento | ['', '2026-07-31 20:58:00.829687+00'] ev=1 | **BLOCKED** |
| 92 | check-out manual valido -> sucesso | tecA1 | 200 | (204, '') | **PASS** |
| 93 | exclusividade GPS/manual aplicada no check-out | tecA1 | gps_and_manual_reason_conflict / ja finalizado | visit_already_checked_out  | **PASS** |
| 94 | retry identico -> checked_out_at preservado | tecA1 | inalterado | 2026-07-31 20:58:07.059192+00==2026-07-31 20:58:07.059192+00 | **PASS** |
| 95 | retry divergente -> idempotency_key_reused | tecA1 | idempotency_key_reused | idempotency_key_reused  | **PASS** |
| 96 | nova chave apos check-out -> visit_already_checked_out | tecA1 | visit_already_checked_out | visit_already_checked_out  | **PASS** |
| 97 | exatamente um evento CHECKED_OUT | tecA1 | 1 | 1 | **PASS** |
| 98 | objeto inexistente -> uploaded_object_missing | tecA1 | uploaded_object_missing | uploaded_object_missing  | **PASS** |
| 99 | file_path fora do prefixo bloqueado | tecA1 | file_path_mismatch | file_path_mismatch  | **PASS** |
| 100 | MIME nao permitido bloqueado | tecA1 | unsupported_mime | unsupported_mime  | **PASS** |
| 101 | tamanho > 10MB bloqueado | tecA1 | invalid_file_size | invalid_file_size  | **PASS** |
| 102 | categoria invalida bloqueada | tecA1 | invalid_photo_category | invalid_photo_category  | **PASS** |
| 103 | Tecnico A2 nao registra foto em visita de A1 | tecA2 | forbidden | forbidden  | **PASS** |
| 104 | criar objeto QA valido administrativamente | admin | 200 | (200, '{"Key":"visit-photos/e41e4892-11a5-4835-b614-4ee54d6baeb3/visits/c6a32122-370f-496d-9d4f-e17ce7b77583/qa-20260731205646-') | **PASS** |
| 105 | registrar foto valida -> sucesso | tecA1 | photo_id | (200, '920e92d1-80a2-4f55-959f-83ddd98b1be3') | **PASS** |
| 106 | retry pelo mesmo file_path -> mesmo photo_id | tecA1 | mesmo id | 920e92d1-80a2-4f55-959f-83ddd98b1be3==920e92d1-80a2-4f55-959f-83ddd98b1be3 | **PASS** |
| 107 | chamadas concorrentes -> uma linha e um evento | tecA1 | 1/1 | rows=1 events=1 out=[200, 200] | **PASS** |
| 108 | metadata MIME divergente bloqueado | tecA1 | uploaded_object_metadata_mismatch | uploaded_object_metadata_mismatch  | **PASS** |
| 109 | metadata size divergente bloqueado | tecA1 | uploaded_object_metadata_mismatch | uploaded_object_metadata_mismatch  | **PASS** |
| 110 | soft delete -> deleted_at preenchido | tecA1 | deleted_at not null | 2026-07-31 20:58:18.097384+00 | **PASS** |
| 111 | reutilizacao de path arquivado -> photo_path_archived | tecA1 | photo_path_archived | photo_path_archived  | **PASS** |
| 112 | atualizacao de caption/sort_order autorizada | tecA1 | 200 | (204, '') | **PASS** |
| 113 | usuario sem autorizacao nao altera foto | stockA/tecA2 | forbidden | forbidden  \| forbidden  | **PASS** |
| 114 | nenhuma RPC de visitas cria financial_transactions | - | 0 | 0 | **PASS** |
| 115 | nenhuma RPC de visitas altera OS fora das regras | - | 0 | 0 | **PASS** |
| 116 | nenhuma RPC de visitas altera empresa de um registro | - | 0 | 0/0 | **PASS** |
| 117 | nenhuma linha de A retornada para B | mgrB | 0 | ver teste 14 | **PASS** |
| 118 | nenhuma linha de B retornada para A | mgrA | 0 | ver teste 10 | **PASS** |
| 119 | P0-07 permanece desativado | - | sem uso de rate-limit.server | nenhum import | **PASS** |
| 120 | nenhuma UI de visitas foi criada | - | 0 arquivos | apenas src/integrations/supabase/types.ts (arquivo gerado automaticamente); nenhuma rota/componente de visitas | **PASS** |
| 121 | Fase 2 nao foi iniciada | - | sem frontend/servidor de visitas | apenas src/integrations/supabase/types.ts (arquivo gerado automaticamente); nenhuma rota/componente de visitas | **PASS** |
| I-magic | validacao de magic bytes | - | rota server-side | rota server-side de upload ainda nao existe | **NOT RUN** |

---

## Reexecução após correções VIS-DRIFT-01 e VIS-DRIFT-02

Runner: `tests/e2e/visits-drift-rerun.py` (sessões reais das 5 fixtures QA, dados prefixados `[QA-VISITS]`, limpeza total ao final).

**Resultado: 49 PASS / 0 FAIL / 0 BLOCKED.**

### Testes originais reexecutados
| # | Descrição | Antes | Agora |
|---|---|---|---|
| 27 | Mesma chave de idempotência com endereço diferente → `idempotency_key_reused` | BLOCKED | PASS |
| 56 | Check-in GPS grava coordenadas, distância e 1 evento | BLOCKED | PASS |
| 73 | `CHECKED_IN → IN_PROGRESS` | FAIL | PASS |
| 74 | `IN_PROGRESS → PAUSED` | FAIL | PASS |
| 75 | `PAUSED → IN_PROGRESS` (retomada) | FAIL | PASS |
| 76 | `IN_PROGRESS → COMPLETED` | BLOCKED | PASS |
| 91 | Check-out GPS grava distância e 1 evento | BLOCKED | PASS |

### VIS-DRIFT-01 (endereço/coordenadas)
- Endereço sem coordenadas: criação OK, `latitude`/`longitude` nulas no snapshot, `checkin_distance_m` = NULL (sem erro).
- `address_snapshot.zip_code` alimentado por `customer_addresses.zipcode` (chave JSON preservada).
- Coordenadas congeladas: alterar o endereço depois **não** altera o snapshot.
- Distância haversine ≈ 1.200 m dentro da tolerância de ±100 m no check-in e no check-out.

### VIS-DRIFT-02 (domínio e transições)
- Sequência validada: `CHECKED_IN → STARTED → PAUSED → RESUMED → PAUSED → RESUMED → COMPLETED`.
- `RESUMED` é apenas evento; nunca persistido em `visits.status` (target `RESUMED` → `invalid_target_status`).
- Visita vinculada a OS continua bloqueando `IN_PROGRESS`/`PAUSED`/`COMPLETED` (`blocked_by_service_order`) e nenhuma função de visita altera `service_orders`.

### Smoke de regressão
Criação, idempotência, RLS multiempresa (A↔B), visibilidade por técnico atribuído (`list_my_visits`), check-in/check-out e delegação para OS: todos PASS.

### Auditoria estática (A1–A12)
`zipcode` mantido, nenhuma coluna `zip_code` criada, `latitude`/`longitude` nullable com as 3 constraints ativas, `_visit_distance_m` consumindo somente o snapshot, checks de status/eventos corretos.

**Status:** VIS-DRIFT-01 e VIS-DRIFT-02 encerrados. INFRA-STORAGE-01 permanece FAIL com risco aceito. Fase 2 não iniciada.

---

## Status final da Fase 1 (2026-08-01)

**FASE 1 APROVADA E ENCERRADA.**

| Item | Resultado |
|---|---|
| Reexecução dos testes afetados | 49 PASS / 0 FAIL |
| Testes 27, 56, 73, 74, 75, 76, 91 | PASS |
| VIS-DRIFT-01 | Encerrado |
| VIS-DRIFT-02 | Encerrado |
| Isolamento multiempresa | Confirmado |
| RLS e permissões por papel | Confirmadas |
| Idempotência e concorrência | Confirmadas |
| Snapshot do endereço | Imutável (confirmado) |
| Distância haversine | Validada |
| Ciclo STARTED/PAUSED/RESUMED/COMPLETED | Validado |
| Bloqueio de execução quando existe OS | Mantido |
| Dados temporários de teste | Removidos |
| Contas e empresas QA | Mantidas (5 usuários, 2 empresas) |
| UI criada | Nenhuma |
| Fase 2 | Não iniciada |

### Exceções documentadas

1. **INFRA-STORAGE-01 — FAIL, risco conhecido aceito.** Bucket `visit-photos`: `public = false`, `file_size_limit = NULL`, `allowed_mime_types = NULL`, nenhuma policy INSERT/UPDATE/DELETE para `authenticated`, somente `visit_photos_read` (SELECT). Deve ser tratado antes da liberação de upload real.
2. **Magic bytes — NOT RUN.** A rota server-side de upload ainda não existe. Antes de liberar upload real será obrigatório validar sessão, empresa, visita, permissão, tamanho real máximo de 10 MB, magic bytes, MIME real, allow-list JPEG/PNG/WEBP e limpeza do objeto quando o registro de metadados falhar.

Resumo consolidado do encerramento: `docs/FASE-1-ENCERRAMENTO.md`.

