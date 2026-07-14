# Checkpoint técnico — 2026-07-14

## 1. Produção funcionando
- https://app.smartcomdf.com.br/ → OK
- https://app.smartcomdf.com.br/auth → OK
- https://app.smartcomdf.com.br/forgot-password → OK
- https://app.smartcomdf.com.br/q/token-invalido → mostra erro amigável

## 2. Status P0-07 (rate limit persistente)
- Migration/tabela `public.public_rate_limits` **existe** no banco (mantida, não removida).
- Código **desligado**: nenhum endpoint importa `rate-limit.server` nem chama `try_consume_rate_limit`.
- Segredo `RATE_LIMIT_HASH_SECRET` não é lido em runtime.
- Endpoints públicos voltaram ao fluxo estável:
  - `src/routes/api/public/quote-image-urls.ts`
  - `src/routes/api/public/quote-receipt.ts`
- `src/routes/forgot-password.tsx` voltou ao fluxo direto no cliente (Supabase Auth) com mensagem genérica de sucesso (P0-03 preservado).

## 3. P0 preservados
- P0-01 (isolamento multiempresa / RLS) — mantido.
- P0-03 (mensagens genéricas de recuperação de senha) — mantido.
- P0-05 — mantido.
- P0-06 (total único centralizado em `src/lib/quote-totals.ts`) — mantido.
- Typecheck: **0 erros** (`bunx tsgo --noEmit`).
- Produção sem “This page didn’t load” e sem HTTPError SSR.

## 4. Nota interna
> **P0-07 rate limit persistente pausado.** Não reativar sem feature flag
> dedicada e validação isolada em preview (endpoint a endpoint), com
> fallback fail-open verificado antes de qualquer publicação.

## Regras vigentes até novo aviso
- Não reativar P0-07.
- Não importar `rate-limit.server`.
- Não usar `try_consume_rate_limit`.
- Não usar `RATE_LIMIT_HASH_SECRET`.
- Não mexer em `public.public_rate_limits`, migrations, RLS ou financeiro.
- Não mexer em auth/root/router sem necessidade.
- Não publicar sem validar preview antes.
