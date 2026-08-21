import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Plus, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPilotDetail,
  listPilotFeedback,
  createPilotFeedback,
  updatePilotFeedback,
  deletePilotFeedback,
  PILOT_FEEDBACK_TYPES,
  PILOT_FEEDBACK_PRIORITIES,
  PILOT_FEEDBACK_STATUSES,
  type PilotFeedbackRow,
} from "@/lib/pilot-feedback.functions";

export const Route = createFileRoute("/_authenticated/admin/pilot-detail/$id")({
  head: () => ({ meta: [{ title: "Detalhe do Piloto — Super Admin" }] }),
  component: PilotDetailPage,
});

const CHECKLIST_LABELS: Record<string, string> = {
  has_customer: "Cadastrou cliente",
  has_item: "Cadastrou produto/serviço",
  has_quote: "Criou orçamento",
  generated_pdf: "Gerou PDF da proposta",
  sent_quote: "Enviou proposta ao cliente",
  has_service_order: "Criou ordem de serviço",
  completed_so: "Finalizou ordem de serviço",
  viewed_reports: "Visualizou relatórios",
  recent_login: "Login recente (7 dias)",
};

function tierTone(t: string): StatusTone {
  if (t === "READY") return "success";
  if (t === "GOOD") return "primary";
  if (t === "ACTIVATING") return "warning";
  return "neutral";
}
function priorityTone(p: string): StatusTone {
  if (p === "CRITICAL") return "destructive";
  if (p === "HIGH") return "warning";
  if (p === "LOW") return "neutral";
  return "primary";
}
function statusTone(s: string): StatusTone {
  if (s === "RESOLVED" || s === "CLOSED") return "success";
  if (s === "WONT_FIX") return "neutral";
  if (s === "IN_PROGRESS") return "warning";
  return "primary";
}
function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}
function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

function PilotDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getPilotDetail);
  const listFn = useServerFn(listPilotFeedback);
  const createFn = useServerFn(createPilotFeedback);
  const updateFn = useServerFn(updatePilotFeedback);
  const deleteFn = useServerFn(deletePilotFeedback);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PilotFeedbackRow | null>(null);

  const detailQ = useQuery({
    queryKey: ["pilot-detail", id],
    queryFn: () => detailFn({ data: { id } }),
  });

  const pilot = detailQ.data?.pilot;
  const activation = detailQ.data?.activation;
  const companyId = pilot?.company_id;

  const feedbackQ = useQuery({
    queryKey: ["pilot-feedback", id, statusFilter, typeFilter],
    queryFn: () =>
      listFn({
        data: {
          pilot_id: id,
          status: statusFilter,
          feedback_type: typeFilter,
        },
      }),
    enabled: !!pilot,
  });

  const createMut = useMutation({
    mutationFn: (p: any) => createFn({ data: p }),
    onSuccess: () => {
      toast.success("Registro criado.");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["pilot-feedback", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const updateMut = useMutation({
    mutationFn: (p: any) => updateFn({ data: p }),
    onSuccess: () => {
      toast.success("Atualizado.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pilot-feedback", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const deleteMut = useMutation({
    mutationFn: (rid: string) => deleteFn({ data: { id: rid } }),
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["pilot-feedback", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const waHref = useMemo(() => {
    const phone = onlyDigits(pilot?.company_whatsapp);
    if (!phone) return null;
    const first = (pilot?.company_name ?? "").split(/\s+/)[0] || "tudo bem";
    const msg = `Olá ${first}, tudo certo? Estou acompanhando o uso do SmartPro pela sua equipe. Posso te ajudar em algum ponto?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }, [pilot]);

  if (detailQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!pilot) {
    return <div className="text-sm text-muted-foreground">Piloto não encontrado.</div>;
  }

  const checklist = (activation?.checklist ?? {}) as Record<string, boolean>;
  const counts = (activation?.counts ?? {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/pilots"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>
      <PageHeader
        title={pilot.company_name ?? "Piloto"}
        description={pilot.company_email ?? "Sem e-mail cadastrado"}
        actions={
          waHref ? (
            <Button asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="card-elevated p-4">
          <div className="text-xs text-muted-foreground">Score de ativação</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="text-2xl font-semibold">{activation?.score ?? 0}</div>
            <StatusBadge
              tone={tierTone(activation?.tier ?? "LOW")}
              status={activation?.tier ?? "LOW"}
            />
          </div>
        </Card>
        <Card className="card-elevated p-4">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="mt-1 text-lg font-medium">{pilot.status}</div>
          <div className="text-xs text-muted-foreground">Onboarding: {pilot.onboarding_status}</div>
        </Card>
        <Card className="card-elevated p-4">
          <div className="text-xs text-muted-foreground">Usuários ativos</div>
          <div className="mt-1 text-2xl font-semibold">{counts.users ?? 0}</div>
        </Card>
        <Card className="card-elevated p-4">
          <div className="text-xs text-muted-foreground">Orçamentos / OS</div>
          <div className="mt-1 text-2xl font-semibold">
            {counts.quotes ?? 0} / {counts.service_orders ?? 0}
          </div>
        </Card>
      </div>

      <Card className="card-elevated p-4">
        <h3 className="text-sm font-medium">Checklist de ativação</h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
            const done = !!checklist[key];
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={done ? "" : "text-muted-foreground"}>{label}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="card-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Feedback e bugs</h3>
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os tipos</SelectItem>
                {PILOT_FEEDBACK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {PILOT_FEEDBACK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo registro
            </Button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(feedbackQ.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[300px]">
                    <div className="font-medium">{row.title}</div>
                    {row.description ? (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {row.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.feedback_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={priorityTone(row.priority)} status={row.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(row.status)} status={row.status} />
                  </TableCell>
                  <TableCell>{row.module ?? "—"}</TableCell>
                  <TableCell>{fmt(row.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Remover registro?")) deleteMut.mutate(row.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!feedbackQ.isLoading && (feedbackQ.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhum registro.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <FeedbackDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) =>
          createMut.mutate({ ...payload, pilot_id: id, company_id: companyId! })
        }
        pending={createMut.isPending}
      />
      <FeedbackDialog
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(payload) => updateMut.mutate({ ...payload, id: editing!.id })}
        pending={updateMut.isPending}
      />
    </div>
  );
}

function FeedbackDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean;
  initial?: PilotFeedbackRow;
  onClose: () => void;
  onSubmit: (p: any) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [feedbackType, setFeedbackType] = useState(initial?.feedback_type ?? "FEEDBACK");
  const [priority, setPriority] = useState(initial?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(initial?.status ?? "OPEN");
  const [module, setModule] = useState(initial?.module ?? "");
  const [screen, setScreen] = useState(initial?.screen ?? "");
  const [steps, setSteps] = useState(initial?.steps_to_reproduce ?? "");
  const [expected, setExpected] = useState(initial?.expected_result ?? "");
  const [actual, setActual] = useState(initial?.actual_result ?? "");
  const [assignee, setAssignee] = useState(initial?.assignee ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar registro" : "Novo registro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={feedbackType} onValueChange={setFeedbackType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILOT_FEEDBACK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILOT_FEEDBACK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILOT_FEEDBACK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Input
                value={module ?? ""}
                onChange={(e) => setModule(e.target.value)}
                placeholder="Orçamentos, OS…"
              />
            </div>
            <div className="space-y-2">
              <Label>Tela</Label>
              <Input
                value={screen ?? ""}
                onChange={(e) => setScreen(e.target.value)}
                placeholder="/quotes"
              />
            </div>
          </div>
          {feedbackType === "BUG" ? (
            <>
              <div className="space-y-2">
                <Label>Passos para reproduzir</Label>
                <Textarea rows={3} value={steps ?? ""} onChange={(e) => setSteps(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Resultado esperado</Label>
                  <Textarea
                    rows={2}
                    value={expected ?? ""}
                    onChange={(e) => setExpected(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resultado atual</Label>
                  <Textarea
                    rows={2}
                    value={actual ?? ""}
                    onChange={(e) => setActual(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Input value={assignee ?? ""} onChange={(e) => setAssignee(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending || !title.trim()}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description || null,
                feedback_type: feedbackType,
                priority,
                status,
                module: module || null,
                screen: screen || null,
                steps_to_reproduce: steps || null,
                expected_result: expected || null,
                actual_result: actual || null,
                assignee: assignee || null,
              })
            }
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
