# Plano — Fundação SecureERP (SaaS Multiempresa)

Stack: TanStack Start + React 19 + TS + Tailwind v4 + shadcn + React Query + RHF + Zod + Lovable Cloud (Supabase: Postgres, Auth, Storage). Tema escolhido: Grafite + Laranja (#111111 / #F97316 / #1F2937 / #FAFAFA). Auth: e-mail+senha. Super Admin terá painel `/admin` separado.

---

## Fase 1 — Backend completo + Auth + Shell do app (esta entrega)

**Cloud + Schema (migration única, com GRANTs e RLS em todas as tabelas)**
- `plans` (Starter, Pro, Business — seed)
- `companies` (status: active/inactive/trial/blocked, plan_id)
- `subscriptions`
- `app_role` enum (`super_admin`, `owner`, `manager`, `financial`, `commercial`, `stock`, `technician`)
- `roles`, `permissions`, `role_permissions` (RBAC granular)
- `user_roles` (separado do profile — evita escalonamento de privilégio)
- `profiles` (company_id, full_name, email, phone, avatar_url, active)
- `user_invitations` (e-mail, company_id, role, token, expires_at)
- `notifications`, `settings`, `audit_logs`, `attachments`, `activity_logs`

**Funções de segurança (SECURITY DEFINER)**
- `public.has_role(_user_id, _role app_role)` — evita recursão RLS
- `public.current_company_id()` — pega company do usuário logado
- `public.is_super_admin()` — bypass para painel `/admin`
- Trigger `handle_new_user()` em `auth.users` → cria `profile`
- Trigger `updated_at` genérico

**Padrão de RLS** em toda tabela de negócio:
- SELECT/INSERT/UPDATE/DELETE: `company_id = current_company_id() OR is_super_admin()`

**Auth**
- Páginas: `/auth` (login + cadastro de nova empresa via onboarding), `/forgot-password`, `/reset-password`
- Listener `onAuthStateChange` no root + `attachSupabaseAuth` middleware
- Layout `_authenticated` (managed) protege `/app/*`
- Layout `/admin` protegido por `is_super_admin()`

**Shell do app**
- Sidebar shadcn colapsável (Dashboard, Cadastros[Produtos/Clientes], Operação[Estoque/Orçamentos], Gestão[Financeiro/CRM/OS], Relatórios, Configurações) — links preparados, módulos como "em breve"
- Topbar: busca, notificações (dropdown), avatar (perfil/logout), toggle dark/light
- Dashboard `/app` com 4 KPI cards (Clientes, Produtos, Orçamentos, Faturamento) — dados fictícios
- Design system grafite+laranja em `src/styles.css` (tokens OKLCH, dark default)
- Componentes reutilizáveis: `KpiCard`, `DataTable`, `ConfirmDialog`, `EmptyState`, `PageHeader`

## Fase 2 — Onboarding, RBAC UI, Convites, Perfil
- Wizard `/onboarding` 4 passos (empresa → plano → admin → finalização)
- `/app/settings/team` — listar usuários, convidar (gera token, envia via Lovable Cloud), gerenciar roles
- `/app/settings/roles` — matriz de permissões editável
- `/app/settings/company` — dados, logo (Storage), preferências
- `/app/profile` — avatar, senha, dados

## Fase 3 — Painel Super Admin + Auditoria + Notificações
- `/admin/companies`, `/admin/plans`, `/admin/subscriptions`
- `/app/settings/audit` — visualização de `audit_logs`
- Sistema de notificações (dropdown realtime via Supabase)
- Helpers `logAudit()` e `logActivity()` para usar em futuros módulos

---

## Detalhes técnicos
- Toda tabela `public.*` recebe `GRANT` + `ENABLE RLS` + policies no mesmo migration
- `user_roles` é tabela separada (NUNCA role em profile)
- Server functions em `src/lib/*.functions.ts` com `requireSupabaseAuth`
- `supabaseAdmin` só dentro de handlers, via `await import('@/integrations/supabase/client.server')`
- Validação Zod em todos os formulários (client) e server functions (`.inputValidator`)
- Estrutura preparada para PWA (manifest + meta), mas sem service worker
- Sitemap.xml + robots.txt no final

Começo agora pela Fase 1. Confirma?