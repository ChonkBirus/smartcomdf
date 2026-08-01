# FASE 1 — ENCERRAMENTO FORMAL (Visitas Técnicas)

Data de encerramento: 2026-08-01
Status: **APROVADA E ENCERRADA**
Fase 2: **NÃO INICIADA**
Nenhuma UI de visitas foi criada.

---

## 1. Migrations aplicadas

| # | Migration | Conteúdo |
|---|---|---|
| 1 | Schema base | Tabelas `visits`, `visit_events`, `visit_photos`, `visit_number_counters`; CHECK de status e tipos de evento; índices; RLS habilitada; GRANT restrito (`SELECT` para `authenticated`, sem INSERT/UPDATE/DELETE); permissões `visits.*` |
| 2 | Storage policies | Policy `visit_photos_read` (SELECT) no bucket privado `visit-photos` para `authenticated` |
| 3 | RPCs | Criação das 11 RPCs de domínio + helpers internos |
| 4 | Drift `list_visits_for_calendar` | Substituição do parâmetro `_status` por `_scope` (`all` / `mine`), com `forbidden_scope_all`, `invalid_scope` e `range_too_large` (93 dias) |
| 5 | Hardening de segurança | `search_path = public` fixado em `_visit_path_uuid` |
| 6 | VIS-DRIFT-01 | `customer_addresses.latitude` / `longitude` `numeric(9,6)` + constraints de faixa e de par; `create_visit` passa a ler `zipcode` mantendo a chave JSON `zip_code` no snapshot |
| 7 | VIS-DRIFT-02 | `visits_status_chk` estendido (`IN_PROGRESS`, `PAUSED`); `visit_events_type_check` estendido (`STARTED`, `PAUSED`, `RESUMED`); `visit_execute_transition` refatorada |

Nenhuma migration foi executada neste encerramento.

## 2. Tabelas criadas

- `public.visits` — visita, empresa, cliente/endereço/contato, responsável, técnico, tipo, agendamento, status, `visit_number`, `address_snapshot` (imutável), check-in/out (timestamp, coordenadas, acurácia, distância, justificativa manual), vínculo opcional com OS, `client_request_id` de idempotência.
- `public.visit_events` — timeline append-only (`CREATED`, `SCHEDULED`, `ASSIGNED`, `CONFIRMED`, `ON_THE_WAY`, `CHECKED_IN`, `STARTED`, `PAUSED`, `RESUMED`, `COMPLETED`, `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`, `PHOTO_ADDED`).
- `public.visit_photos` — metadados de foto (path, nome, MIME, tamanho, categoria, legenda, ordem, `deleted_at`).
- `public.visit_number_counters` — numeração `VIS-000000` isolada por empresa.

Colunas alteradas fora do módulo: `customer_addresses.latitude`, `customer_addresses.longitude` (aditivas, nullable).

## 3. Bucket e policies

- Bucket `visit-photos`: privado (`public = false`).
- Única policy em `storage.objects`: `visit_photos_read` (SELECT, `authenticated`, escopo por empresa/visita).
- Sem policies de INSERT / UPDATE / DELETE — upload direto pelo cliente é negado (validado no teste 8).

## 4. Permissões

| Permissão | Uso |
|---|---|
| `visits.view` | Leitura de visitas da empresa; `scope=all` no calendário |
| `visits.view_assigned_only` | Leitura restrita às visitas atribuídas ao próprio usuário (técnicos; também presente em `manager`) |
| `visits.create` | `create_visit` |
| `visits.edit` | `update_visit_schedule`, `assign_visit_technician`, transições administrativas |
| `visits.execute` | Check-in/out, transições de execução, fotos |
| `visits.cancel` | Cancelamento / `NO_SHOW` |

Escritas diretas nas tabelas são impossíveis: RLS sem policies de escrita + ausência de GRANT de escrita. Todo o domínio passa pelas RPCs `SECURITY DEFINER`.

## 5. RPCs e assinaturas

| Função | Assinatura | Retorno |
|---|---|---|
| `create_visit` | `(_payload jsonb, _client_request_id uuid)` | `uuid` |
| `update_visit_schedule` | `(_visit_id uuid, _payload jsonb, _client_request_id uuid)` | `void` |
| `assign_visit_technician` | `(_visit_id uuid, _technician_id uuid, _client_request_id uuid)` | `void` |
| `visit_execute_transition` | `(_visit_id uuid, _target text, _payload jsonb, _client_request_id uuid)` | `void` |
| `visit_check_in` | `(_visit_id uuid, _lat numeric, _lon numeric, _accuracy_m numeric, _manual_reason text, _client_request_id uuid)` | `void` |
| `visit_check_out` | `(_visit_id uuid, _lat numeric, _lon numeric, _accuracy_m numeric, _manual_reason text, _client_request_id uuid)` | `void` |
| `register_visit_photo` | `(_visit_id uuid, _file_path text, _file_name text, _mime_type text, _file_size bigint, _photo_category text, _caption text, _sort_order integer)` | `uuid` |
| `update_visit_photo_caption` | `(_photo_id uuid, _caption text, _sort_order integer)` | `void` |
| `soft_delete_visit_photo` | `(_photo_id uuid)` | `void` |
| `list_my_visits` | `(_from date, _to date, _status text)` | `SETOF visits` |
| `list_visits_for_calendar` | `(_from date, _to date, _scope text)` | `SETOF jsonb` |

Helpers internos: `can_access_visit(_visit_id uuid)`, `next_visit_number(_company_id uuid)`, `_visit_distance_m(_visit_id uuid, _lat numeric, _lon numeric)`, `_visit_parse_ts(_raw text, _field text)`, `_visit_path_uuid(_name text, _seg integer)`.

## 6. Correções de drift

### VIS-DRIFT-01 — endereço e coordenadas (ENCERRADO)
- `create_visit` referenciava `zip_code`, `latitude` e `longitude` inexistentes em `customer_addresses`.
- Correção: leitura de `zipcode` (chave JSON `zip_code` preservada no snapshot) e adição de `latitude`/`longitude` nullable com constraints de faixa e de par obrigatório.
- Validado: snapshot congelado (alterar o endereço depois não altera a visita), distância haversine ≈ 1.200 m dentro de ±100 m em check-in e check-out, endereço sem coordenadas resulta em distância NULL sem erro.

### VIS-DRIFT-02 — domínio de execução (ENCERRADO)
- Estados `IN_PROGRESS` / `PAUSED` e eventos `STARTED` / `PAUSED` / `RESUMED` não existiam.
- Correção: CHECKs estendidos e `visit_execute_transition` refatorada — `CHECKED_IN → IN_PROGRESS` emite `STARTED`; `PAUSED → IN_PROGRESS` emite `RESUMED`; `RESUMED` nunca é persistido como status (`invalid_target_status`).
- Visita vinculada a OS continua bloqueando `IN_PROGRESS`, `PAUSED` e `COMPLETED` (`blocked_by_service_order`). Nenhuma função de visita altera `service_orders` ou `financial_transactions`.

## 7. Resultado final dos testes

| Execução | Resultado |
|---|---|
| Estáticos (Fase 1B) | 14 PASS / 1 FAIL aceito (INFRA-STORAGE-01) |
| Matriz autenticada (Fase 1C) | 114 PASS / 3 FAIL / 4 BLOCKED / 1 NOT RUN |
| Reexecução pós-correções | **49 PASS / 0 FAIL / 0 BLOCKED** |

Testes 27, 56, 73, 74, 75, 76 e 91: **PASS**. Isolamento multiempresa, RLS por papel, idempotência e concorrência: confirmados. Dados temporários removidos; 5 contas e 2 empresas QA mantidas.

Runners: `tests/e2e/visits-phase1c-matrix.py`, `tests/e2e/visits-drift-rerun.py`.

## 8. Riscos conhecidos

### INFRA-STORAGE-01 — FAIL, risco conhecido aceito
Bucket `visit-photos`: `public = false`, mas `file_size_limit = NULL` e `allowed_mime_types = NULL` (a configuração do painel não persiste). Sem policies de escrita para `authenticated`; apenas `visit_photos_read`.
Controles compensatórios: bucket privado, nenhuma rota de upload existente, validações de MIME/tamanho em `register_visit_photo`.
Risco residual: ausência de segunda camada no bucket quando o upload real for liberado. **Deve ser tratado antes de liberar upload.**

### Magic bytes — NOT RUN
A rota server-side de upload ainda não existe. Antes de liberar upload real é obrigatório validar: sessão, empresa, visita, permissão, tamanho real máximo de 10 MB, magic bytes, MIME real, allow-list JPEG/PNG/WEBP e limpeza do objeto quando o registro de metadados falhar.

## 9. Itens adiados

- Rota server-side de upload de fotos (com magic bytes e limpeza compensatória).
- Configuração física de `file_size_limit` e `allowed_mime_types` no bucket.
- P0-07 (rate limit persistente) permanece desativado no código.
- Qualquer UI de visitas — Fase 2.

## 10. Rollback atualizado

Ordem inversa de aplicação, sem perda de dados de outros módulos:

1. `visit_execute_transition`, `create_visit`, `update_visit_schedule`, `assign_visit_technician`, `visit_check_in`, `visit_check_out`, `register_visit_photo`, `update_visit_photo_caption`, `soft_delete_visit_photo`, `list_my_visits`, `list_visits_for_calendar` → `DROP FUNCTION` (assinatura exata) antes de restaurar versões anteriores.
2. CHECKs: restaurar `visits_status_chk` e `visit_events_type_check` para o domínio anterior (somente após confirmar ausência de linhas em `IN_PROGRESS`/`PAUSED`/`STARTED`/`RESUMED`).
3. `customer_addresses`: `DROP CONSTRAINT customer_addresses_latlon_pair, customer_addresses_lat_range, customer_addresses_lon_range;` depois `DROP COLUMN latitude, DROP COLUMN longitude`.
4. Storage: `DROP POLICY visit_photos_read ON storage.objects;` e remoção do bucket `visit-photos` (somente se vazio).
5. Tabelas: `DROP TABLE visit_photos, visit_events, visit_number_counters, visits;` e helpers `_visit_*`, `can_access_visit`, `next_visit_number`.
6. Permissões `visits.*` removidas do catálogo de permissões e de `profile_roles`.

## 11. Confirmação final

- Nenhuma alteração de banco foi feita neste encerramento.
- Nenhuma migration nova executada.
- Nenhuma UI criada.
- **Fase 2 não foi iniciada.**
