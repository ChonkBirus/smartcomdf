import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPlans } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: AdminPlansPage,
});

function AdminPlansPage() {
  const fn = useServerFn(listPlans);
  const { data } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => fn() });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(data ?? []).map((p: any) => (
        <Card key={p.id} className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{p.name}</CardTitle>
            <Badge variant={p.active ? "default" : "secondary"}>
              {p.active ? "Ativo" : "Inativo"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-3xl font-bold text-primary">
              R$ {Number(p.monthly_price).toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground">/mês</span>
            </div>
            <div className="text-muted-foreground">Anual: R$ {Number(p.annual_price).toFixed(2)}</div>
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              <div>Usuários: {p.max_users}</div>
              <div>Storage: {p.max_storage_gb} GB</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
