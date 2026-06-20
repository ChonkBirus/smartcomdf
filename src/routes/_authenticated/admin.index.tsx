import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listCompanies, setCompanyStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminCompaniesPage,
});

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-amber-500/15 text-amber-500",
  active: "bg-emerald-500/15 text-emerald-500",
  inactive: "bg-muted text-muted-foreground",
  blocked: "bg-destructive/15 text-destructive",
};

function AdminCompaniesPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listCompanies);
  const setFn = useServerFn(setCompanyStatus);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "companies"], queryFn: () => fetchFn() });

  const mut = useMutation({
    mutationFn: (v: { company_id: string; status: "trial" | "active" | "inactive" | "blocked" }) =>
      setFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="card-elevated overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Usuários</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
          )}
          {!isLoading && (data ?? []).length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma empresa cadastrada.</TableCell></TableRow>
          )}
          {(data ?? []).map((c: any) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="font-medium">{c.corporate_name}</div>
                {c.trade_name && <div className="text-xs text-muted-foreground">{c.trade_name}</div>}
              </TableCell>
              <TableCell>{c.plan_name ?? "—"}</TableCell>
              <TableCell>{c.users_count}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[c.status] ?? ""} variant="secondary">{c.status}</Badge>
              </TableCell>
              <TableCell>
                <Select
                  value={c.status}
                  onValueChange={(v) => mut.mutate({ company_id: c.id, status: v as any })}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                    <SelectItem value="blocked">Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
