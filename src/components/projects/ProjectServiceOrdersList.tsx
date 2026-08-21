import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Wrench, Eye } from "lucide-react";
import { listServiceOrdersByProject } from "@/lib/service-orders.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em execução",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SCHEDULED: "secondary",
  IN_PROGRESS: "default",
  PAUSED: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export function ProjectServiceOrdersList({ projectId }: { projectId: string }) {
  const fetchList = useServerFn(listServiceOrdersByProject);
  const { data, isLoading } = useQuery({
    queryKey: ["project-service-orders", projectId],
    queryFn: () => fetchList({ data: { project_id: projectId } }),
  });

  const rows = data ?? [];

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
        <Wrench className="h-4 w-4" />
        Ordens de Serviço
        {rows.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "OS" : "OSs"}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title="Nenhuma ordem de serviço"
            description="Nenhuma OS criada para este projeto. Use o botão “Gerar Ordem de Serviço” acima."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agendada</TableHead>
              <TableHead>Concluída</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((so: any) => (
              <TableRow key={so.id}>
                <TableCell className="font-medium">{so.service_order_number}</TableCell>
                <TableCell>{so.title ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{so.technician_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[so.status] ?? "outline"}>
                    {STATUS_LABEL[so.status] ?? so.status}
                  </Badge>
                </TableCell>
                <TableCell>{fmtDate(so.scheduled_date)}</TableCell>
                <TableCell>
                  {so.completed_at ? new Date(so.completed_at).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/service-orders/$id" params={{ id: so.id }}>
                      <Eye className="mr-1 h-4 w-4" />
                      Abrir
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
