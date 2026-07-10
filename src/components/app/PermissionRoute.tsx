import { Link } from "@tanstack/react-router";
import { ShieldAlert, Lock, Sparkles, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions, type ModuleSlug, type PermissionAction } from "@/lib/permissions";

const MODULE_LABELS: Partial<Record<ModuleSlug, string>> = {
  dashboard: "Dashboard",
  products: "Produtos",
  clients: "Clientes",
  stock: "Estoque",
  quotes: "Orçamentos",
  quote_payments: "Pagamentos de Orçamento",
  financial: "Financeiro",
  crm: "CRM",
  orders: "Pedidos",
  reports: "Relatórios",
  settings: "Configurações",
  suppliers: "Fornecedores",
  purchases: "Compras",
  smart_receiving: "Recebimento Inteligente",
  projects: "Projetos",
  service_orders: "Ordens de Serviço",
  finance: "Financeiro",
};

const ACTION_LABELS: Partial<Record<PermissionAction, string>> = {
  view: "visualizar",
  create: "criar",
  edit: "editar",
  delete: "excluir",
  approve: "aprovar",
  cancel: "cancelar",
  manage: "gerenciar",
  execute: "executar",
};

export type BlockReason = "permission" | "plan";

export function ForbiddenPage({
  message,
  module,
  action,
  reason = "permission",
  requiredPlan,
  currentPlan,
  adminEmail,
}: {
  message?: string;
  module?: ModuleSlug;
  action?: PermissionAction;
  reason?: BlockReason;
  requiredPlan?: string | null;
  currentPlan?: string | null;
  adminEmail?: string | null;
}) {
  const moduleLabel = module ? MODULE_LABELS[module] ?? module : null;
  const actionLabel = action ? ACTION_LABELS[action] ?? action : null;
  const isPlan = reason === "plan";

  const title = isPlan ? "Recurso disponível em outro plano" : "Acesso não permitido";
  const defaultMsg = isPlan
    ? "Este recurso não está incluído no plano atual da sua empresa."
    : message ?? "Seu usuário não tem permissão para acessar este recurso.";

  const mailto = adminEmail
    ? `mailto:${adminEmail}?subject=${encodeURIComponent(
        `Liberação de acesso — ${moduleLabel ?? "recurso"}`,
      )}&body=${encodeURIComponent(
        `Olá, preciso de acesso ao módulo ${moduleLabel ?? ""}${
          actionLabel ? ` (ação: ${actionLabel})` : ""
        } no Smart Pro.`,
      )}`
    : null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              isPlan ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            {isPlan ? <Sparkles className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
            <p className="text-sm text-muted-foreground">{defaultMsg}</p>
          </div>

          {(moduleLabel || actionLabel || requiredPlan || currentPlan) && (
            <div className="w-full space-y-1 rounded-md border bg-muted/40 p-3 text-left text-xs sm:text-sm">
              {moduleLabel && (
                <p>
                  <span className="text-muted-foreground">Recurso: </span>
                  <span className="font-medium">{moduleLabel}</span>
                </p>
              )}
              {actionLabel && (
                <p>
                  <span className="text-muted-foreground">Ação: </span>
                  <span className="font-medium">{actionLabel}</span>
                </p>
              )}
              {currentPlan && (
                <p>
                  <span className="text-muted-foreground">Plano atual: </span>
                  <span className="font-medium">{currentPlan}</span>
                </p>
              )}
              {requiredPlan && (
                <p>
                  <span className="text-muted-foreground">Plano necessário: </span>
                  <span className="font-medium">{requiredPlan}</span>
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {isPlan
              ? "Fale com o administrador da sua empresa para avaliar uma atualização de plano."
              : "Peça ao administrador da sua empresa para liberar esse acesso."}
          </p>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao painel
              </Link>
            </Button>
            {mailto && (
              <Button asChild variant="secondary" className="gap-2">
                <a href={mailto}>
                  <Mail className="h-4 w-4" />
                  Falar com o administrador
                </a>
              </Button>
            )}
            {isPlan && (
              <Button asChild className="gap-2">
                <Link to="/billing/plans">
                  <Sparkles className="h-4 w-4" />
                  Ver planos
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PermissionRoute({
  module,
  action = "view",
  children,
}: {
  module: ModuleSlug;
  action?: PermissionAction;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(module, action)) {
    return <ForbiddenPage module={module} action={action} reason="permission" />;
  }
  return <>{children}</>;
}

export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: ModuleSlug;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(module, action) ? children : fallback}</>;
}

// Helper icon export for consumers that want a matching lock badge inline.
export const PermissionLockIcon = Lock;
