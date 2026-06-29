import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCompanyId } from "@/hooks/use-company-id";
import { Briefcase, Search, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listProjects, type ProjectStatus, type ProjectPriority } from "@/lib/projects.functions";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projetos — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="projects">
      <ProjectsPage />
    </PermissionRoute>
  ),
});

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Rascunho",
  READY_TO_SCHEDULE: "Pronto para agendar",
  SCHEDULED: "Agendado",
  IN_PROGRESS: "Em execução",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente",
};
const PRIORITY_TONE: Record<ProjectPriority, StatusTone> = {
  LOW: "neutral", NORMAL: "primary", HIGH: "warning", URGENT: "destructive",
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

const PLANNING_LABEL: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Pendente", tone: "neutral" },
  IN_PROGRESS: { label: "Em planejamento", tone: "primary" },
  READY_FOR_SERVICE_ORDER: { label: "Pronto p/ OS", tone: "success" },
};
const MATERIAL_LABEL: Record<string, { label: string; tone: StatusTone }> = {
  NOT_CHECKED: { label: "Não verificado", tone: "neutral" },
  AVAILABLE: { label: "OK", tone: "success" },
  PARTIALLY_AVAILABLE: { label: "Parcial", tone: "warning" },
  UNAVAILABLE: { label: "Insuficiente", tone: "destructive" },
  RESERVED: { label: "Reservado", tone: "primary" },
};

function ProjectsPage() {
  const fetchList = useServerFn(listProjects);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [planning, setPlanning] = useState<string>("");
  const [material, setMaterial] = useState<string>("");

  const filters = useMemo(() => ({
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
  }), [search, status, priority]);

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["projects", filters],
    queryFn: () => fetchList({ data: filters }),
  });

  const rows = useMemo(() => allRows.filter((p: any) => {
    if (planning && p.planning_status !== planning) return false;
    if (material && p.material_status !== material) return false;
    return true;
  }), [allRows, planning, material]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projetos"
        description="Projetos de execução gerados a partir de orçamentos aprovados e pagos."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, título ou orçamento"
            className="pl-8"
          />
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority || "all"} onValueChange={(v) => setPriority(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planning || "all"} onValueChange={(v) => setPlanning(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Planejamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Planejamento</SelectItem>
            {Object.entries(PLANNING_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={material || "all"} onValueChange={(v) => setMaterial(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Materiais" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Materiais</SelectItem>
            {Object.entries(MATERIAL_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Nenhum projeto"
          description="Converta um orçamento aprovado e pago para gerar um projeto."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Planejamento</TableHead>
                <TableHead>Materiais</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Início previsto</TableHead>
                <TableHead>Fim previsto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p: any) => {
                const plan = PLANNING_LABEL[p.planning_status] ?? PLANNING_LABEL.PENDING;
                const mat = MATERIAL_LABEL[p.material_status] ?? MATERIAL_LABEL.NOT_CHECKED;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.project_number}</TableCell>
                    <TableCell>{p.customer_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.responsible_name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} label={STATUS_LABEL[p.status as ProjectStatus]} />
                    </TableCell>
                    <TableCell><StatusBadge status={p.planning_status} tone={plan.tone} label={plan.label} /></TableCell>
                    <TableCell><StatusBadge status={p.material_status} tone={mat.tone} label={mat.label} /></TableCell>
                    <TableCell>
                      <StatusBadge status={p.priority} tone={PRIORITY_TONE[p.priority as ProjectPriority]} label={PRIORITY_LABEL[p.priority as ProjectPriority]} />
                    </TableCell>
                    <TableCell>{fmtDate((p as any).planned_start_date ?? p.expected_start_date)}</TableCell>
                    <TableCell>{fmtDate((p as any).planned_end_date ?? p.expected_end_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/projects/$id" params={{ id: p.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

