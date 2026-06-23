import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, Search, Eye } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
const STATUS_VARIANT: Record<ProjectStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", READY_TO_SCHEDULE: "secondary", SCHEDULED: "secondary",
  IN_PROGRESS: "default", PAUSED: "outline", COMPLETED: "default", CANCELLED: "destructive",
};
const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente",
};
const PRIORITY_VARIANT: Record<ProjectPriority, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline", NORMAL: "secondary", HIGH: "default", URGENT: "destructive",
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

const PLANNING_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "Em planejamento", cls: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-300" },
  READY_FOR_SERVICE_ORDER: { label: "Pronto p/ OS", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
};
const MATERIAL_LABEL: Record<string, { label: string; cls: string }> = {
  NOT_CHECKED: { label: "Não verificado", cls: "bg-muted text-muted-foreground" },
  AVAILABLE: { label: "OK", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
  PARTIALLY_AVAILABLE: { label: "Parcial", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
  UNAVAILABLE: { label: "Insuficiente", cls: "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300" },
  RESERVED: { label: "Reservado", cls: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-300" },
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
                      <Badge variant={STATUS_VARIANT[p.status as ProjectStatus]}>{STATUS_LABEL[p.status as ProjectStatus]}</Badge>
                    </TableCell>
                    <TableCell><span className={`rounded px-2 py-0.5 text-xs ${plan.cls}`}>{plan.label}</span></TableCell>
                    <TableCell><span className={`rounded px-2 py-0.5 text-xs ${mat.cls}`}>{mat.label}</span></TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[p.priority as ProjectPriority]}>{PRIORITY_LABEL[p.priority as ProjectPriority]}</Badge>
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

