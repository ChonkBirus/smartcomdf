import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCompanyId } from "@/hooks/use-company-id";
import { Wrench, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Input } from "@/components/ui/input";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  listServiceOrders, type ServiceOrderStatus, type ServiceOrderPriority,
} from "@/lib/service-orders.functions";

export const Route = createFileRoute("/_authenticated/service-orders")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — SecureERP" }] }),
  component: () => (
    <FeatureGate feature="service_orders">
      <PermissionRoute module="service_orders">
        <ServiceOrdersListPage />
      </PermissionRoute>
    </FeatureGate>
  ),
});

const STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  DRAFT: "Rascunho", SCHEDULED: "Agendada", IN_PROGRESS: "Em execução",
  PAUSED: "Pausada", COMPLETED: "Concluída", CANCELLED: "Cancelada",
};
const PRIORITY_LABEL: Record<ServiceOrderPriority, string> = {
  LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente",
};

function ServiceOrdersListPage() {
  const navigate = useNavigate();
  const fetchFn = useServerFn(listServiceOrders);
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["service-orders", { status, priority, search }],
    queryFn: () => fetchFn({ data: { status: status || undefined, priority: priority || undefined, search: search || undefined } }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader title="Ordens de Serviço" description="Gestão de OS técnicas." />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número da OS, projeto ou título"
            className="pl-8"
          />
        </div>
        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority || "ALL"} onValueChange={(v) => setPriority(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    icon={<Wrench className="h-6 w-6" />}
                    title="Nenhuma Ordem de Serviço encontrada"
                    description="Gere uma OS a partir de um projeto pronto."
                    className="border-0 shadow-none"
                  />
                </TableCell>
              </TableRow>
            ) : data.map((so) => (
              <TableRow key={so.id} className="cursor-pointer"
                onClick={() => navigate({ to: "/service-orders/$id", params: { id: so.id } } as any)}>
                <TableCell className="font-medium">{so.service_order_number}</TableCell>
                <TableCell>{so.customer_name}</TableCell>
                <TableCell>{so.project_number ?? "—"}</TableCell>
                <TableCell>{so.technician_name ?? "—"}</TableCell>
                <TableCell>
                  {so.scheduled_date ? new Date(so.scheduled_date).toLocaleDateString("pt-BR") : "—"}
                  {so.scheduled_start_time ? ` ${so.scheduled_start_time.slice(0,5)}` : ""}
                </TableCell>
                <TableCell><StatusBadge status={so.status} label={STATUS_LABEL[so.status]} /></TableCell>
                <TableCell><StatusBadge status={so.priority} tone="neutral" label={PRIORITY_LABEL[so.priority]} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm"
                    onClick={() => navigate({ to: "/service-orders/$id", params: { id: so.id } } as any)}>
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
