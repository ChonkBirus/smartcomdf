import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { usePermissions } from "@/lib/permissions";
import { listServiceOrderTeamPublic } from "@/lib/project-employee-costs.functions";

/**
 * Panel para técnicos atribuídos ou responsáveis pela OS.
 * Mostra apenas nome + função da equipe. Nenhum valor monetário
 * é buscado nem exposto (server usa RPC SECURITY DEFINER que
 * retorna apenas colunas seguras).
 */
export function ServiceOrderTeamPublicPanel({ serviceOrderId }: { serviceOrderId: string }) {
  const { has, isOwner, isSuperAdmin, can } = usePermissions();
  const canViewCosts =
    isOwner ||
    isSuperAdmin ||
    has("finance.view_costs") ||
    has("finance.manage") ||
    has("employees.manage") ||
    can("settings", "manage");

  const fn = useServerFn(listServiceOrderTeamPublic);
  const { data = [], isLoading } = useQuery({
    queryKey: ["so-team-public", serviceOrderId],
    queryFn: () => fn({ data: { service_order_id: serviceOrderId } }),
    // Só usar essa view para quem NÃO vê custos; para gestor, o painel
    // completo é renderizado no lugar.
    enabled: !canViewCosts,
  });

  if (canViewCosts) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
        <Users className="h-4 w-4" />
        Equipe da OS
      </div>
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nenhum funcionário vinculado.</p>
      ) : (
        <ul className="divide-y">
          {data.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-3 text-sm">
              <span className="font-medium">{m.employee_name}</span>
              <span className="text-xs text-muted-foreground">{m.role_snapshot ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
