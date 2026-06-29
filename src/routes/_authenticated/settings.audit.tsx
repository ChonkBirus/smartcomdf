import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/PageHeader";
import { listAuditLogs } from "@/lib/audit.functions";
import { useCompanyId } from "@/hooks/use-company-id";

export const Route = createFileRoute("/_authenticated/settings/audit")({
  component: AuditPage,
});

const ACTION_COLORS: Record<string, string> = {
  create: "bg-success/15 text-success",
  update: "bg-warning/15 text-warning",
  delete: "bg-destructive/15 text-destructive",
  login: "bg-primary/15 text-primary",
};

function AuditPage() {
  const [filters, setFilters] = useState<{ module?: string; action?: string }>({});
  const fn = useServerFn(listAuditLogs);
  const companyId = useCompanyId();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", companyId, filters],
    queryFn: () => fn({ data: { ...filters, limit: 100 } }),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoria" description="Histórico de ações realizadas na empresa." />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Módulo</Label>
          <Input
            placeholder="ex: products, financial, auth"
            value={filters.module ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value || undefined }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Ação</Label>
          <Input
            placeholder="ex: create, update, delete"
            value={filters.action ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || undefined }))}
          />
        </div>
      </div>

      <Card className="card-elevated overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem registros.</TableCell></TableRow>
            )}
            {(data ?? []).map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{l.user?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{l.user?.email}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{l.module}</Badge></TableCell>
                <TableCell>
                  <Badge className={ACTION_COLORS[l.action] ?? ""} variant="secondary">{l.action}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.record_id ? l.record_id.slice(0, 8) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
