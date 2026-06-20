import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listSubscriptions } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
  const fn = useServerFn(listSubscriptions);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fn(),
  });

  return (
    <Card className="card-elevated overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Expira</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
          )}
          {!isLoading && (data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem assinaturas.</TableCell></TableRow>
          )}
          {(data ?? []).map((s: any) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.companies?.corporate_name ?? "—"}</TableCell>
              <TableCell>{s.plans?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={s.trial ? "secondary" : "default"}>{s.trial ? "Trial" : "Pago"}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={s.active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted"}>
                  {s.active ? "Ativa" : "Inativa"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.start_date ? new Date(s.start_date).toLocaleDateString("pt-BR") : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {s.expiration_date ? new Date(s.expiration_date).toLocaleDateString("pt-BR") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
