# E2E Fixtures — Lote 1

Baseline determinístico usado pelas suítes Playwright em `tests/e2e/`.
Gerenciado por `tests/e2e/seed_fixtures.py` e disparado por
`scripts/e2e-seed.sh`.

## O que o seed cria

Rótulos humanos ficam prefixados por `[E2E-<run_id>]` (o `run_id` é um
timestamp UTC, gerado a cada execução, útil para reconhecer leftovers no
banco). **UUIDs são determinísticos** — reruns sobrescrevem/limpa os
mesmos IDs, não acumulam linhas.

- Empresas A e B
- Perfis: owner A, owner B, técnico A (opcional)
- Cliente A, Cliente B
- Produto A com descrição + imagem primária; Produto B idem
- Orçamento A `SENT` com item que carrega `description` + `image_path`
- Orçamento A "legacy" sem `image_path` (fallback)
- Orçamento B `SENT` (isolamento multiempresa)
- `quote_payment` A **APPROVED** com receipt APPROVED
- Projeto A a partir do orçamento A
- OS A vinculada ao projeto, com técnico atribuído
- `financial_transactions`: receita do orçamento + custo avulso da OS

## Secrets obrigatórios (CI e local)

| Nome                | Descrição                                                    |
| ------------------- | ------------------------------------------------------------ |
| `E2E_PGHOST`        | Host Postgres da instância Supabase de teste                 |
| `E2E_PGPORT`        | Porta (normalmente 5432)                                     |
| `E2E_PGUSER`        | Usuário com privilégio de escrita nas tabelas públicas       |
| `E2E_PGPASSWORD`    | Senha correspondente                                         |
| `E2E_PGDATABASE`    | Nome do banco (normalmente `postgres`)                       |
| `E2E_A_USER_ID`     | `auth.users.id` do owner da Empresa A (já criado no projeto) |
| `E2E_B_USER_ID`     | `auth.users.id` do owner da Empresa B                        |

No workflow, esses secrets são exportados no step do `e2e-seed.sh` como
`PG*` e `E2E_*_USER_ID`.

## Secrets opcionais

| Nome                    | Efeito quando presente                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `E2E_TECH_A_USER_ID`    | Usa esse usuário como técnico da Empresa A (senão reusa o owner). |
| `E2E_A_ACCESS_TOKEN`    | Faz upload real da imagem A e do recibo A (Storage).              |
| `E2E_B_ACCESS_TOKEN`    | Faz upload real da imagem B (Storage).                            |
| `SUPABASE_URL`          | URL do projeto (default = URL do projeto Lovable Cloud).          |
| `E2E_RUN_ID`            | Força um `run_id` (default = timestamp UTC atual).                |

## Semântica de SKIP (não é PASS)

Se algum secret obrigatório faltar:

- `scripts/e2e-seed.sh` imprime `SKIP: …`, escreve
  `E2E_SEED_STATUS=skipped` em `$GITHUB_ENV` e retorna **exit 0** (para
  não quebrar o job de build).
- As suítes em `tests/e2e/*.py` **DEVEM** checar `E2E_SEED_STATUS` no
  início e emitir SKIP em vez de rodar assertions. Isso será feito nos
  Lotes 2 e 3.
- Rodar o Python direto (`python tests/e2e/seed_fixtures.py`) sem os
  secrets sai com **exit 78** (convenção "neutral/skip"), com mensagem
  clara em stderr.

## Como rodar localmente

```bash
# 1) exporte os PG* + E2E_*_USER_ID (uma vez por shell)
export PGHOST=... PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=postgres
export E2E_A_USER_ID=... E2E_B_USER_ID=...
# opcional:
export E2E_TECH_A_USER_ID=... E2E_A_ACCESS_TOKEN=... E2E_B_ACCESS_TOKEN=...

# 2) seed limpo (teardown → seed → imprime bloco .env)
scripts/e2e-seed.sh

# 3) source dos handles no shell atual
set -a; source /tmp/e2e-fixture.env; set +a

# 4) rode uma suíte
python tests/e2e/pr-quote-images.py
```

## Como rodar no CI

O workflow `.github/workflows/e2e-playwright.yml` já executa
`scripts/e2e-seed.sh` como step com todos os secrets acima. As linhas
`KEY=VALUE` do stdout são adicionadas a `$GITHUB_ENV` automaticamente e
ficam disponíveis para os steps seguintes.

## Teardown e verificação de leftovers

- `scripts/e2e-seed.sh` sempre roda `--teardown` antes do seed, então a
  execução N não depende do estado deixado por N-1.
- `python tests/e2e/seed_fixtures.py --teardown` remove todas as linhas
  do namespace e chama `verify_clean()` (`--verify-clean`), que consulta
  cada tabela pelos UUIDs determinísticos e falha se qualquer contagem
  for > 0.
- `python tests/e2e/seed_fixtures.py --verify-clean` é uma checagem
  read-only (útil ao investigar leftovers sem apagar nada).

## Regras invioláveis

- **Nunca** toca em linhas fora dos UUIDs derivados do namespace
  `e2e-fixture` (via `uuid5`).
- **Nunca** cria migration.
- **Nunca** cria usuários em `auth.users` (Lovable Cloud não expõe a
  Admin API); os usuários E2E precisam existir antes.
- SKIP nunca é reportado como PASS.
