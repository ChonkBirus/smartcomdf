import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ForbiddenPage({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">403 — Acesso negado</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {message ?? "Você não tem permissão para acessar esta página. Fale com o proprietário da empresa."}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/dashboard">Voltar ao Dashboard</Link>
      </Button>
    </div>
  );
}

import { usePermissions, type ModuleSlug, type PermissionAction } from "@/lib/permissions";

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
  if (!can(module, action)) return <ForbiddenPage />;
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
