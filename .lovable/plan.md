# FASE 2.11 — Tour guiado, checklist e Central de Ajuda

Camada de onboarding sem tocar em billing, PDF, orçamentos, OS, projetos, clientes, estoque ou RLS existentes.

## Entregáveis

### 1. Persistência
Nova tabela `user_onboarding_progress` (id, user_id, company_id, tour_key, status, current_step, completed_at, skipped_at, timestamps).
- RLS: usuário só lê/escreve o próprio progresso, escopado por `company_id`.
- GRANTS para `authenticated` + `service_role`.
- Índice único `(user_id, company_id, tour_key)`.

Server functions em `src/lib/onboarding.functions.ts`:
- `getOnboardingProgress({ tourKey })`
- `upsertOnboardingProgress({ tourKey, status, currentStep })`
- `getGettingStartedStatus()` — conta clientes/produtos/orçamentos/OS reais da empresa para auto-marcar checklist.

### 2. Componentes (`src/components/onboarding/`)
- `OnboardingProvider.tsx` — contexto com estado do tour ativo, step, mutations de progresso.
- `GuidedTour.tsx` + `TourTooltip.tsx` — overlay com spotlight (resolve seletor `data-tour="..."`), botões Próximo / Voltar / Pular / Finalizar / Não mostrar novamente. Sem dependência externa (implementação leve com `getBoundingClientRect` + portal).
- `StartTourButton.tsx`, `ModuleHelpButton.tsx` ("Como usar esta tela").
- `GettingStartedChecklist.tsx` — card no dashboard, 8 itens, auto-check via `getGettingStartedStatus`, botões linkando para rotas existentes. Dispensável via "Ocultar".
- `TourRegistry.ts` — definições dos tours (initial, clients, products, stock, quotes, service-orders, billing) com steps `{ target, title, body, route? }`. Filtra steps por permissão/feature via `usePermissions`/`useFeatures`.

### 3. Central de Ajuda
- Rota nova `src/routes/_authenticated/help.tsx` (`/help`).
- `HelpCenterPage` lista `HelpArticleCard`s (hardcoded em `src/lib/help-articles.ts`, campo opcional `video_url`).
- Rota `src/routes/_authenticated/help_.$slug.tsx` para `TutorialArticlePage`.
- Cards com botão "Iniciar tour" quando o artigo tem `tourKey`, e "Assistir vídeo" se `video_url` definido.
- Item "Ajuda" no `AppSidebar`.

### 4. Integração nas telas
- Adicionar atributos `data-tour="..."` nos elementos-chave do `dashboard`, `clients`, `products`, `stock`, `quotes`, `service-orders`, `billing.invoices` (apenas attrs, sem mudar comportamento).
- `ModuleHelpButton` no `PageHeader` dessas páginas (prop opcional `tourKey`).
- Disparar tour inicial automaticamente no Dashboard quando `getOnboardingProgress("initial")` retornar `NOT_STARTED` e o usuário tiver `company_id`.
- Menu do usuário no `Topbar`: item "Reiniciar tour".

### 5. Regras de exibição
- Tour inicial só roda se status = NOT_STARTED. "Não mostrar novamente" grava SKIPPED. Reinício via Central de Ajuda ou menu seta de volta para IN_PROGRESS.
- Steps com recurso bloqueado mostram nota "Disponível no plano Pro/Business" e pulam automaticamente.
- Mobile: tooltip vira bottom-sheet fullwidth, sem spotlight rígido.

### 6. Analytics (best-effort)
Helper `logOnboardingEvent(event, payload)` que insere em `activity_logs` se a tabela aceitar (caso contrário no-op silencioso). Eventos: `tour_started`, `tour_step_viewed`, `tour_completed`, `tour_skipped`, `help_opened`, `tutorial_opened`.

## Fora de escopo
- Produção de vídeos.
- Edição de billing, PDF, RLS de outros módulos, regras de negócio.
- Tabela `help_articles` (deixar artigos hardcoded; estrutura preparada para migração futura).

## Detalhes técnicos
- Tour overlay próprio (sem `react-joyride`) para evitar dep nova e SSR issues; portal em `document.body`, `position: fixed`, calcula box do alvo a cada `resize`/`scroll`.
- `OnboardingProvider` montado dentro de `_authenticated/route.tsx` (depois do `FeaturesProvider`), assim respeita plano/permissões.
- Mutations usam `useServerFn` + invalidate `["onboarding", tourKey]`.
- Acessibilidade: foco preso no tooltip, ESC = pular, setas = navegar.

## Arquivos novos
- `supabase` migration (tabela + RLS + grants)
- `src/lib/onboarding.functions.ts`
- `src/lib/help-articles.ts`
- `src/components/onboarding/{OnboardingProvider,GuidedTour,TourTooltip,StartTourButton,ModuleHelpButton,GettingStartedChecklist,TourRegistry}.tsx`
- `src/routes/_authenticated/help.tsx`
- `src/routes/_authenticated/help_.$slug.tsx`

## Arquivos alterados (mínimo)
- `src/routes/_authenticated/route.tsx` — montar `OnboardingProvider`
- `src/routes/_authenticated/dashboard.tsx` — `GettingStartedChecklist` + `data-tour`
- `src/components/app/AppSidebar.tsx` — item "Ajuda"
- `src/components/app/Topbar.tsx` — "Reiniciar tour" no menu
- `src/components/app/PageHeader.tsx` — prop opcional `tourKey` que renderiza `ModuleHelpButton`
- Rotas listadas acima ganham `data-tour` e `<PageHeader tourKey="…" />`

Aprovar para eu implementar.
