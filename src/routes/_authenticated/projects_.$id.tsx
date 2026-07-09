import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Briefcase, FileText, Package, MapPin, User2, XCircle, Save, UserCog, AlertTriangle,
} from "lucide-react";
import { updateProjectPlanning } from "@/lib/project-planning.functions";
import { listTeam } from "@/lib/team.functions";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getProject, updateProjectBasics, cancelProject,
  type ProjectStatus, type ProjectPriority,
} from "@/lib/projects.functions";
import { ProjectPlanningPanel } from "@/components/projects/ProjectPlanningPanel";
import { ProjectFinancialSummary } from "@/components/finance/ProjectFinancialSummary";
import { CreateServiceOrderFromProjectButton } from "@/components/service-orders/CreateServiceOrderFromProjectButton";
import { ProjectServiceOrdersList } from "@/components/projects/ProjectServiceOrdersList";

export const Route = createFileRoute("/_authenticated/projects_/$id")({
  head: () => ({ meta: [{ title: "Detalhe do Projeto — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="projects">
      <ProjectDetailPage />
    </PermissionRoute>
  ),
});

const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Rascunho", READY_TO_SCHEDULE: "Pronto para agendar", SCHEDULED: "Agendado",
  IN_PROGRESS: "Em execução", PAUSED: "Pausado", COMPLETED: "Concluído", CANCELLED: "Cancelado",
};
const STATUS_VARIANT: Record<ProjectStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", READY_TO_SCHEDULE: "secondary", SCHEDULED: "secondary",
  IN_PROGRESS: "default", PAUSED: "outline", COMPLETED: "default", CANCELLED: "destructive",
};
const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta", URGENT: "Urgente",
};

const STOCK_LABEL: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: "Disponível", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
  LOW: { label: "Estoque baixo", cls: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
  OUT: { label: "Sem estoque", cls: "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300" },
  NA: { label: "—", cls: "text-muted-foreground" },
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchProject = useServerFn(getProject);
  const updateFn = useServerFn(updateProjectBasics);
  const cancelFn = useServerFn(cancelProject);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject({ data: { id } }),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [cancelOpen, setCancelOpen] = useState(false);

  const updateMut = useMutation({
    mutationFn: (patch: any) => updateFn({ data: { id, ...patch } }),
    onSuccess: () => {
      toast.success("Projeto atualizado.");
      qc.invalidateQueries({ queryKey: ["project", id] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Projeto cancelado.");
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCancelOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar."),
  });

  const setResponsibleFn = useServerFn(updateProjectPlanning);
  const fetchTeam = useServerFn(listTeam);
  const [respOpen, setRespOpen] = useState(false);
  const [respValue, setRespValue] = useState<string>("");
  const { data: team } = useQuery({
    queryKey: ["team-members-lite"],
    queryFn: () => fetchTeam(),
    enabled: respOpen,
  });
  const setRespMut = useMutation({
    mutationFn: () => setResponsibleFn({
      data: { id, responsible_user_id: respValue || null },
    }),
    onSuccess: () => {
      toast.success("Responsável atualizado.");
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setRespOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar responsável."),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Projeto não encontrado.</div>;

  const { project, customer, address, contact, quote, items } = data;
  const financial_summary = (data as any).financial_summary as
    | { total_amount: number; paid_amount: number; remaining_amount: number; financial_status: "UNPAID" | "PARTIALLY_PAID" | "PAID" }
    | undefined;
  const hasResponsible = !!project.responsible_user_id;
  const openRespDialog = () => {
    setRespValue(project.responsible_user_id ?? "");
    setRespOpen(true);
  };

  const startEdit = () => {
    setForm({
      title: project.title,
      description: project.description ?? "",
      priority: project.priority,
      expected_start_date: project.expected_start_date ?? "",
      expected_end_date: project.expected_end_date ?? "",
      internal_notes: project.internal_notes ?? "",
    });
    setEditing(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/projects" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={`${project.project_number} — ${project.title}`}
          description={`Origem: orçamento ${project.quote_number ?? "—"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_VARIANT[project.status]}>{STATUS_LABEL[project.status]}</Badge>
              <Badge variant="outline">{PRIORITY_LABEL[project.priority]}</Badge>
              {project.status !== "CANCELLED" && project.status !== "COMPLETED" && (
                <CreateServiceOrderFromProjectButton
                  projectId={project.id}
                  planningReady={project.planning_status === "READY_FOR_SERVICE_ORDER"}
                />
              )}
              {!editing && project.status !== "CANCELLED" && (
                <Can module="projects" action="edit">
                  <Button variant="outline" size="sm" onClick={startEdit}>Editar</Button>
                </Can>
              )}
              {project.status !== "CANCELLED" && project.status !== "COMPLETED" && (
                <Can module="projects" action="cancel">
                  <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                    <XCircle className="mr-1 h-4 w-4" />Cancelar
                  </Button>
                </Can>
              )}
            </div>
          }
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="planning">Planejamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {!hasResponsible && project.status !== "CANCELLED" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Este projeto ainda não possui responsável definido.
              </div>
              <Can module="projects" action="edit">
                <Button size="sm" variant="outline" onClick={openRespDialog}>
                  <UserCog className="mr-1 h-4 w-4" />Definir responsável
                </Button>
              </Can>
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <UserCog className="h-4 w-4" />Responsável pelo projeto
                </div>
                <p className="text-sm">
                  {hasResponsible
                    ? (project.responsible_name ?? "—")
                    : <span className="text-muted-foreground">Sem responsável</span>}
                </p>
              </div>
              <Can module="projects" action="edit">
                <Button size="sm" variant="outline" onClick={openRespDialog}>
                  {hasResponsible ? "Alterar" : "Definir"}
                </Button>
              </Can>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <User2 className="h-4 w-4" />Cliente
          </div>
          <div className="text-sm">
            <p className="font-medium">{project.customer_name}</p>
            {customer?.cpf_cnpj && <p className="text-muted-foreground">{customer.cpf_cnpj}</p>}
            {contact?.name && (
              <p className="mt-2 text-muted-foreground">
                Contato: {contact.name} {contact.phone ? `· ${contact.phone}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />Endereço de instalação
          </div>
          <div className="text-sm text-muted-foreground">
            {address ? (
              <p>
                {address.street}{address.number ? `, ${address.number}` : ""}
                {address.neighborhood ? ` — ${address.neighborhood}` : ""}<br />
                {address.city}{address.state ? `/${address.state}` : ""}
                {address.zip_code ? ` · ${address.zip_code}` : ""}
              </p>
            ) : "Não informado."}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />Orçamento de origem
          </div>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <div className="text-muted-foreground">Valor total</div>
            <div className="text-right font-medium">{fmtBRL(financial_summary?.total_amount ?? project.total_amount)}</div>
            <div className="text-muted-foreground">Valor recebido</div>
            <div className="text-right">{fmtBRL(financial_summary?.paid_amount ?? 0)}</div>
            <div className="text-muted-foreground">Saldo a receber</div>
            <div className="text-right">{fmtBRL(financial_summary?.remaining_amount ?? project.remaining_amount)}</div>
            <div className="text-muted-foreground">Status financeiro</div>
            <div className="text-right">
              {financial_summary
                ? (financial_summary.financial_status === "PAID"
                    ? "Pago"
                    : financial_summary.financial_status === "PARTIALLY_PAID"
                    ? "Parcialmente pago"
                    : "Não pago")
                : "—"}
            </div>
            <div className="text-muted-foreground">Estimativa</div>
            <div className="text-right">{project.completion_estimate ?? "—"}</div>
          </div>

          {quote?.id && (
            <Button asChild variant="link" size="sm" className="mt-2 px-0">
              <Link to="/quotes">Ver orçamento {quote.quote_number}</Link>
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 text-sm font-medium">Editar dados básicos</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Previsão início</Label>
                <Input type="date" value={form.expected_start_date ?? ""}
                  onChange={(e) => setForm({ ...form, expected_start_date: e.target.value || null })} />
              </div>
              <div>
                <Label>Previsão fim</Label>
                <Input type="date" value={form.expected_end_date ?? ""}
                  onChange={(e) => setForm({ ...form, expected_end_date: e.target.value || null })} />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Observações internas</Label>
              <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending}>
              <Save className="mr-1 h-4 w-4" />Salvar
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          <Package className="h-4 w-4" />Itens do projeto
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Estoque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sem itens.
                </TableCell>
              </TableRow>
            ) : items.map((it: any) => {
              const stock = STOCK_LABEL[it.stock_status] ?? STOCK_LABEL.NA;
              return (
                <TableRow key={it.id}>
                  <TableCell>
                    {it.image_url ? (
                      <img src={it.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell className="text-muted-foreground">{it.description ?? "—"}</TableCell>
                  <TableCell className="text-right">{Number(it.quantity).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{it.unit}</TableCell>
                  <TableCell>
                    <span className={`rounded px-2 py-0.5 text-xs ${stock.cls}`}>{stock.label}</span>
                    {it.stock_quantity != null && it.stock_status !== "NA" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({Number(it.stock_quantity).toLocaleString("pt-BR")} em estoque)
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {project.notes && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Observações</div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.notes}</p>
        </div>
      )}

      <ProjectFinancialSummary projectId={project.id} />
        </TabsContent>

        <TabsContent value="planning">
          <ProjectPlanningPanel
            project={project}
            onChanged={() => qc.invalidateQueries({ queryKey: ["project", id] })}
          />
        </TabsContent>
      </Tabs>


      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será marcado como cancelado. Esta ação pode ser revertida apenas por
              edição direta no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMut.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={respOpen} onOpenChange={setRespOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasResponsible ? "Alterar responsável do projeto" : "Definir responsável do projeto"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              O responsável principal é sugerido como técnico ao gerar Ordens de Serviço.
              Alterar aqui não altera OS já criadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Responsável</Label>
            <Select value={respValue || "__none__"} onValueChange={(v) => setRespValue(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem responsável</SelectItem>
                {(team?.members ?? []).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setRespMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setRespMut.mutate(); }}
              disabled={setRespMut.isPending}
            >
              {setRespMut.isPending ? "Salvando..." : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
