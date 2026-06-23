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

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

function ProjectsPage() {
  const fetchList = useServerFn(listProjects);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");

  const filters = useMemo(() => ({
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
  }), [search, status, priority]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["projects", filters],
    queryFn: () => fetchList({ data: filters }),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Briefcase}
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
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority || "all"} onValueChange={(v) => setPriority(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
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
          icon={Briefcase}
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
                <TableHead>Orçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Previsão início</TableHead>
                <TableHead>Previsão fim</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.project_number}</TableCell>
                  <TableCell>{p.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.quote_number ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANT[p.priority]}>{PRIORITY_LABEL[p.priority]}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmtBRL(p.total_amount)}</TableCell>
                  <TableCell>{fmtDate(p.expected_start_date)}</TableCell>
                  <TableCell>{fmtDate(p.expected_end_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                      <Link to="/projects/$id" params={{ id: p.id }}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
