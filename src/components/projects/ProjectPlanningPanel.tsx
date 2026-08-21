import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Package,
  ClipboardCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { usePermissions } from "@/lib/permissions";
import {
  getProjectPlanning,
  updateProjectPlanning,
  addTeamMember,
  removeTeamMember,
  checkProjectMaterials,
  markReadyForOS,
  listCompanyUsers,
  type MaterialCheckStatus,
} from "@/lib/project-planning.functions";
import { useCompanyId } from "@/hooks/use-company-id";

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};
const ROLES = ["Técnico", "Auxiliar", "Supervisor", "Responsável comercial", "Outro"];

const MAT_BADGE: Record<MaterialCheckStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: "Disponível", cls: "bg-success/15 text-success" },
  PARTIALLY_AVAILABLE: { label: "Parcial", cls: "bg-warning/15 text-warning" },
  UNAVAILABLE: { label: "Indisponível", cls: "bg-destructive/15 text-destructive" },
  NOT_APPLICABLE: { label: "N/A", cls: "bg-muted text-muted-foreground" },
};

const PROJ_MAT_LABEL: Record<string, { label: string; cls: string }> = {
  NOT_CHECKED: { label: "Não verificado", cls: "bg-muted text-muted-foreground" },
  AVAILABLE: { label: "Materiais OK", cls: "bg-success/15 text-success" },
  PARTIALLY_AVAILABLE: { label: "Parcialmente disponível", cls: "bg-warning/15 text-warning" },
  UNAVAILABLE: { label: "Materiais insuficientes", cls: "bg-destructive/15 text-destructive" },
  RESERVED: { label: "Reservado", cls: "bg-primary/15 text-primary" },
};

const PLAN_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "Em planejamento", cls: "bg-primary/15 text-primary" },
  READY_FOR_SERVICE_ORDER: { label: "Pronto para OS", cls: "bg-success/15 text-success" },
};

export function ProjectPlanningPanel({
  project,
  onChanged,
}: {
  project: any;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const fetchPlanning = useServerFn(getProjectPlanning);
  const fetchUsers = useServerFn(listCompanyUsers);
  const updateFn = useServerFn(updateProjectPlanning);
  const addMemberFn = useServerFn(addTeamMember);
  const removeMemberFn = useServerFn(removeTeamMember);
  const checkFn = useServerFn(checkProjectMaterials);
  const readyFn = useServerFn(markReadyForOS);
  const companyId = useCompanyId();

  const locked = project.status === "CANCELLED" || project.status === "COMPLETED";

  const planQuery = useQuery({
    queryKey: ["project-planning", companyId, project.id],
    queryFn: () => fetchPlanning({ data: { project_id: project.id } }),
    enabled: !!companyId,
  });
  const usersQuery = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => fetchUsers(),
    enabled: !!companyId,
  });

  const [form, setForm] = useState({
    responsible_user_id: project.responsible_user_id ?? "",
    planned_start_date: project.planned_start_date ?? "",
    planned_end_date: project.planned_end_date ?? "",
    planned_start_time: project.planned_start_time ?? "",
    planned_end_time: project.planned_end_time ?? "",
    priority: project.priority ?? "NORMAL",
    operational_notes: project.operational_notes ?? "",
    customer_instructions: project.customer_instructions ?? "",
    access_instructions: project.access_instructions ?? "",
    parking_instructions: project.parking_instructions ?? "",
  });

  useEffect(() => {
    setForm({
      responsible_user_id: project.responsible_user_id ?? "",
      planned_start_date: project.planned_start_date ?? "",
      planned_end_date: project.planned_end_date ?? "",
      planned_start_time: project.planned_start_time ?? "",
      planned_end_time: project.planned_end_time ?? "",
      priority: project.priority ?? "NORMAL",
      operational_notes: project.operational_notes ?? "",
      customer_instructions: project.customer_instructions ?? "",
      access_instructions: project.access_instructions ?? "",
      parking_instructions: project.parking_instructions ?? "",
    });
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [newMember, setNewMember] = useState({ user_id: "", role: "Técnico" });
  const [confirmReadyOpen, setConfirmReadyOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: project.id,
          responsible_user_id: form.responsible_user_id || null,
          planned_start_date: form.planned_start_date || null,
          planned_end_date: form.planned_end_date || null,
          planned_start_time: form.planned_start_time || null,
          planned_end_time: form.planned_end_time || null,
          priority: form.priority as any,
          operational_notes: form.operational_notes || null,
          customer_instructions: form.customer_instructions || null,
          access_instructions: form.access_instructions || null,
          parking_instructions: form.parking_instructions || null,
        },
      }),
    onSuccess: () => {
      toast.success("Planejamento salvo.");
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const addMut = useMutation({
    mutationFn: () =>
      addMemberFn({
        data: {
          project_id: project.id,
          user_id: newMember.user_id,
          role: newMember.role,
        },
      }),
    onSuccess: () => {
      toast.success("Membro adicionado.");
      setNewMember({ user_id: "", role: "Técnico" });
      qc.invalidateQueries({ queryKey: ["project-planning", project.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeMemberFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["project-planning", project.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const checkMut = useMutation({
    mutationFn: () => checkFn({ data: { project_id: project.id } }),
    onSuccess: (r: any) => {
      toast.success(`Materiais verificados (${r?.total_products ?? 0} produtos).`);
      qc.invalidateQueries({ queryKey: ["project-planning", project.id] });
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const readyMut = useMutation({
    mutationFn: (force: boolean) => readyFn({ data: { project_id: project.id, force } }),
    onSuccess: () => {
      toast.success("Projeto pronto para OS!");
      setConfirmReadyOpen(false);
      onChanged();
      qc.invalidateQueries({ queryKey: ["project-planning", project.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const team = planQuery.data?.team ?? [];
  const materials = planQuery.data?.materials ?? [];
  const users = usersQuery.data ?? [];

  const hasResponsible = !!project.responsible_user_id;
  const hasDates = !!project.planned_start_date && !!project.planned_end_date;
  const hasTeam = team.length > 0;
  const hasCheck = project.material_status !== "NOT_CHECKED";
  const isReady = project.planning_status === "READY_FOR_SERVICE_ORDER";
  const insufficient = ["UNAVAILABLE", "PARTIALLY_AVAILABLE"].includes(project.material_status);

  const canMarkReady = hasResponsible && hasDates && hasTeam && hasCheck && !locked && !isReady;

  const missingItems = useMemo(
    () => materials.filter((m) => m.status === "UNAVAILABLE" || m.status === "PARTIALLY_AVAILABLE"),
    [materials],
  );

  const planBadge = PLAN_LABEL[project.planning_status] ?? PLAN_LABEL.PENDING;
  const matBadge = PROJ_MAT_LABEL[project.material_status] ?? PROJ_MAT_LABEL.NOT_CHECKED;

  return (
    <div className="space-y-4">
      {/* Progresso */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Planejamento do projeto</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded px-2 py-0.5 text-xs ${planBadge.cls}`}>
              {planBadge.label}
            </span>
            <span className={`rounded px-2 py-0.5 text-xs ${matBadge.cls}`}>{matBadge.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <Step done={hasResponsible} label="Responsável definido" />
          <Step done={hasDates} label="Datas definidas" />
          <Step done={hasTeam} label="Equipe definida" />
          <Step done={hasCheck} label="Materiais verificados" />
          <Step done={isReady} label="Pronto para OS" />
        </div>
      </div>

      {/* Dados de execução */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4" />
          Dados de execução
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Responsável pelo projeto</Label>
            <Select
              value={form.responsible_user_id || "none"}
              onValueChange={(v) =>
                setForm({ ...form, responsible_user_id: v === "none" ? "" : v })
              }
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem responsável —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm({ ...form, priority: v })}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <Label>Início previsto</Label>
              <Input
                type="date"
                className="w-full min-w-0"
                value={form.planned_start_date}
                disabled={locked}
                onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <Label>Hora início</Label>
              <Input
                type="time"
                className="w-full min-w-0"
                value={form.planned_start_time}
                disabled={locked}
                onChange={(e) => setForm({ ...form, planned_start_time: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <Label>Conclusão prevista</Label>
              <Input
                type="date"
                className="w-full min-w-0"
                value={form.planned_end_date}
                disabled={locked}
                onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <Label>Hora término</Label>
              <Input
                type="time"
                className="w-full min-w-0"
                value={form.planned_end_time}
                disabled={locked}
                onChange={(e) => setForm({ ...form, planned_end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Observações operacionais</Label>
            <Textarea
              value={form.operational_notes}
              disabled={locked}
              onChange={(e) => setForm({ ...form, operational_notes: e.target.value })}
            />
          </div>
        </div>

        <div className="my-4 h-px bg-border" />
        <div className="mb-2 text-sm font-medium">Instruções para execução</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Instruções do cliente</Label>
            <Textarea
              value={form.customer_instructions}
              disabled={locked}
              onChange={(e) => setForm({ ...form, customer_instructions: e.target.value })}
            />
          </div>
          <div>
            <Label>Instruções de acesso</Label>
            <Textarea
              value={form.access_instructions}
              disabled={locked}
              onChange={(e) => setForm({ ...form, access_instructions: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Instruções de estacionamento</Label>
            <Textarea
              value={form.parking_instructions}
              disabled={locked}
              onChange={(e) => setForm({ ...form, parking_instructions: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={locked || saveMut.isPending || !can("projects", "plan")}
          >
            {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Salvar planejamento
          </Button>
        </div>
      </div>

      {/* Equipe */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          Equipe
        </div>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Label>Usuário</Label>
            <Select
              value={newMember.user_id}
              onValueChange={(v) => setNewMember({ ...newMember, user_id: v })}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label>Função</Label>
            <Select
              value={newMember.role}
              onValueChange={(v) => setNewMember({ ...newMember, role: v })}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => addMut.mutate()}
            disabled={
              locked || !newMember.user_id || addMut.isPending || !can("projects", "manage_team")
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        </div>
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro adicionado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name || m.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={locked || !can("projects", "manage_team")}
                      onClick={() => removeMut.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Materiais */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Materiais</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkMut.mutate()}
            disabled={locked || checkMut.isPending || !can("projects", "check_materials")}
          >
            {checkMut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="mr-1 h-4 w-4" />
            )}
            Verificar disponibilidade
          </Button>
        </div>

        {insufficient && missingItems.length > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-warning">
                Existem materiais insuficientes para este projeto.
              </p>
              <ul className="mt-1 text-warning">
                {missingItems.map((m) => (
                  <li key={m.id}>
                    {m.name}: faltam {Number(m.missing_quantity).toLocaleString("pt-BR")} {m.unit}{" "}
                    (necessário {Number(m.required_quantity).toLocaleString("pt-BR")}, disponível{" "}
                    {Number(m.available_quantity).toLocaleString("pt-BR")})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Clique em "Verificar disponibilidade" para consultar o estoque.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Necessário</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Faltante</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => {
                const b = MAT_BADGE[m.status];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">
                      {Number(m.required_quantity).toLocaleString("pt-BR")} {m.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(m.available_quantity).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(m.missing_quantity).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-xs ${b.cls}`}>{b.label}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pronto para OS */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-card p-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Pronto para Ordem de Serviço</p>
          <p className="text-xs text-muted-foreground">
            Requer responsável, datas, equipe e verificação de materiais.
          </p>
        </div>
        <Button
          disabled={!canMarkReady || readyMut.isPending || !can("projects", "mark_ready_for_os")}
          onClick={() => {
            if (insufficient) setConfirmReadyOpen(true);
            else readyMut.mutate(false);
          }}
        >
          {readyMut.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1 h-4 w-4" />
          )}
          {isReady ? "Já está pronto para OS" : "Marcar como pronto para OS"}
        </Button>
      </div>

      <AlertDialog open={confirmReadyOpen} onOpenChange={setConfirmReadyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Materiais insuficientes</AlertDialogTitle>
            <AlertDialogDescription>
              Existem materiais insuficientes para este projeto. Deseja continuar mesmo assim?
              Empresas de segurança eletrônica podem comprar materiais no caminho ou usar estoque de
              veículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={readyMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                readyMut.mutate(true);
              }}
              disabled={readyMut.isPending}
            >
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border p-2 ${done ? "border-success/40 bg-success/10" : "border-dashed"}`}
    >
      <CheckCircle2 className={`h-4 w-4 ${done ? "text-success" : "text-muted-foreground"}`} />
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
