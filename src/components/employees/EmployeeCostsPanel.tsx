import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/lib/permissions";
import {
  listProjectEmployeeCosts,
  listServiceOrderEmployeeCosts,
  addProjectEmployeeCost,
  updateProjectEmployeeCost,
  deleteProjectEmployeeCost,
  type ProjectEmployeeCost,
} from "@/lib/project-employee-costs.functions";
import { listActiveEmployeesForPicker } from "@/lib/employees.functions";
import { listServiceOrdersByProject } from "@/lib/service-orders.functions";

type ScopeProject = { scope: "project"; projectId: string; serviceOrderId?: undefined };
type ScopeSO = { scope: "service_order"; projectId: string | null; serviceOrderId: string };
export type EmployeeCostsPanelProps = ScopeProject | ScopeSO;

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseMoney(v: string): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function parseNumber(v: string): number {
  if (!v) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type FormState = {
  employee_id: string;
  service_order_id: string | null;
  days_count: string;
  daily_rate_snapshot: string;
  transport_cost: string;
  meal_cost: string;
  other_cost: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  employee_id: "",
  service_order_id: null,
  days_count: "1",
  daily_rate_snapshot: "0",
  transport_cost: "0",
  meal_cost: "0",
  other_cost: "0",
  notes: "",
};

export function EmployeeCostsPanel(props: EmployeeCostsPanelProps) {
  const qc = useQueryClient();
  const { has, isOwner, isSuperAdmin, can } = usePermissions();
  const canViewCosts =
    isOwner ||
    isSuperAdmin ||
    has("finance.view_costs") ||
    has("finance.manage") ||
    has("employees.manage") ||
    can("settings", "manage"); // manager

  const canManage = canViewCosts; // v1: manage = view (per spec §9 last note)

  const listProjFn = useServerFn(listProjectEmployeeCosts);
  const listSoFn = useServerFn(listServiceOrderEmployeeCosts);
  const pickerFn = useServerFn(listActiveEmployeesForPicker);
  const addFn = useServerFn(addProjectEmployeeCost);
  const updFn = useServerFn(updateProjectEmployeeCost);
  const delFn = useServerFn(deleteProjectEmployeeCost);
  const soListFn = useServerFn(listServiceOrdersByProject);

  const queryKey =
    props.scope === "project"
      ? ["employee-costs", "project", props.projectId]
      : ["employee-costs", "so", props.serviceOrderId];

  const { data: rows = [], isLoading } = useQuery<ProjectEmployeeCost[]>({
    queryKey,
    queryFn: () =>
      props.scope === "project"
        ? listProjFn({ data: { project_id: props.projectId } })
        : listSoFn({ data: { service_order_id: props.serviceOrderId } }),
    enabled: canViewCosts,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-picker"],
    queryFn: () => pickerFn({}),
    enabled: canManage,
  });

  const projectIdForNew =
    props.scope === "project" ? props.projectId : props.projectId ?? null;

  const { data: projectSOs = [] } = useQuery({
    queryKey: ["project-sos-picker", projectIdForNew ?? "none"],
    queryFn: () => soListFn({ data: { project_id: projectIdForNew as string } }),
    enabled: canManage && !!projectIdForNew && props.scope === "project",
  });

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<ProjectEmployeeCost | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDel, setConfirmDel] = useState<ProjectEmployeeCost | null>(null);

  useEffect(() => {
    if (!openForm) return;
    if (editing) {
      setForm({
        employee_id: editing.employee_id,
        service_order_id: editing.service_order_id,
        days_count: String(editing.days_count).replace(".", ","),
        daily_rate_snapshot: String(editing.daily_rate_snapshot).replace(".", ","),
        transport_cost: String(editing.transport_cost).replace(".", ","),
        meal_cost: String(editing.meal_cost).replace(".", ","),
        other_cost: String(editing.other_cost).replace(".", ","),
        notes: editing.notes ?? "",
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        service_order_id:
          props.scope === "service_order" ? props.serviceOrderId : null,
      });
    }
  }, [openForm, editing, props]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === form.employee_id) ?? null,
    [employees, form.employee_id],
  );

  // Autofill defaults when picking employee for a new entry
  const handlePickEmployee = async (id: string) => {
    setForm((f) => ({ ...f, employee_id: id }));
    if (editing) return;
    // Fetch defaults from picker isn't enough (no monetary). Look up via projected fields:
    // reuse listActiveEmployeesForPicker: name/role only. Defer defaults to server if user leaves 0.
    // We proactively refetch full defaults by re-querying employees list w/ monetary via a light call:
    // (skip; server will snapshot from employee record if fields left empty)
  };

  const computedTotal = useMemo(() => {
    const dr = parseMoney(form.daily_rate_snapshot);
    const dc = parseNumber(form.days_count);
    const tr = parseMoney(form.transport_cost);
    const ml = parseMoney(form.meal_cost);
    const ot = parseMoney(form.other_cost);
    return dr * dc + tr + ml + ot;
  }, [form]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["employee-costs"] });
    qc.invalidateQueries({ queryKey: ["project-margin"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.employee_id && !editing) throw new Error("Selecione um funcionário.");
      const days = parseNumber(form.days_count);
      if (!(days > 0)) throw new Error("Diárias deve ser maior que 0.");
      const payload = {
        days_count: days,
        daily_rate_snapshot: parseMoney(form.daily_rate_snapshot),
        transport_cost: parseMoney(form.transport_cost),
        meal_cost: parseMoney(form.meal_cost),
        other_cost: parseMoney(form.other_cost),
        notes: form.notes || undefined,
        service_order_id: form.service_order_id,
      };
      if (editing) {
        return updFn({ data: { id: editing.id, ...payload } });
      }
      if (!projectIdForNew)
        throw new Error("Projeto obrigatório para vincular funcionário.");
      return addFn({
        data: {
          ...payload,
          project_id: projectIdForNew,
          employee_id: form.employee_id,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Vínculo atualizado" : "Funcionário vinculado");
      setOpenForm(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Vínculo removido");
      setConfirmDel(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  if (!canViewCosts) return null;

  const totalGeral = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          {props.scope === "project" ? "Equipe / Custos de mão de obra" : "Equipe da OS"}
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar funcionário
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Nenhum funcionário vinculado ainda.
        </p>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Funcionário</th>
                  <th className="px-3 py-2 text-left">Função</th>
                  <th className="px-3 py-2 text-right">Diárias</th>
                  <th className="px-3 py-2 text-right">Diária</th>
                  <th className="px-3 py-2 text-right">Passagem</th>
                  <th className="px-3 py-2 text-right">Almoço</th>
                  <th className="px-3 py-2 text-right">Outros</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  {canManage && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.employee_name}</div>
                      {r.notes && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.role_snapshot ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.days_count}</td>
                    <td className="px-3 py-2 text-right">{brl(r.daily_rate_snapshot)}</td>
                    <td className="px-3 py-2 text-right">{brl(r.transport_cost)}</td>
                    <td className="px-3 py-2 text-right">{brl(r.meal_cost)}</td>
                    <td className="px-3 py-2 text-right">{brl(r.other_cost)}</td>
                    <td className="px-3 py-2 text-right font-medium">{brl(r.total)}</td>
                    {canManage && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(r);
                            setOpenForm(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDel(r)}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-medium">
                  <td className="px-3 py-2" colSpan={7}>
                    Total geral
                  </td>
                  <td className="px-3 py-2 text-right">{brl(totalGeral)}</td>
                  {canManage && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y">
            {rows.map((r) => (
              <div key={r.id} className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.employee_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.role_snapshot ?? "—"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{brl(r.total)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.days_count} × {brl(r.daily_rate_snapshot)}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Passagem {brl(r.transport_cost)} · Almoço {brl(r.meal_cost)} · Outros{" "}
                  {brl(r.other_cost)}
                </div>
                {r.notes && (
                  <div className="text-xs text-muted-foreground italic">{r.notes}</div>
                )}
                {canManage && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditing(r);
                        setOpenForm(true);
                      }}
                    >
                      <Pencil className="mr-1 h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setConfirmDel(r)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-muted/20 text-sm font-medium">
              <span>Total geral</span>
              <span>{brl(totalGeral)}</span>
            </div>
          </div>
        </>
      )}

      <Dialog open={openForm} onOpenChange={(o) => { setOpenForm(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar vínculo" : "Vincular funcionário"}
            </DialogTitle>
            <DialogDescription>
              Custos entram apenas na margem do projeto. Nenhum lançamento financeiro é
              criado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {!editing && (
              <div className="space-y-1">
                <Label>Funcionário ativo *</Label>
                <Select
                  value={form.employee_id || undefined}
                  onValueChange={handlePickEmployee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} {e.role ? `— ${e.role}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEmployee?.role && (
                  <Badge variant="outline" className="mt-1">
                    {selectedEmployee.role}
                  </Badge>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Se deixar valores em 0, o servidor usa o padrão do cadastro do
                  funcionário como snapshot.
                </p>
              </div>
            )}

            {editing && (
              <div className="rounded-md border p-2 text-sm">
                <div className="font-medium">{editing.employee_name}</div>
                <div className="text-xs text-muted-foreground">
                  {editing.role_snapshot ?? "—"}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Diárias *</Label>
                <Input
                  inputMode="decimal"
                  value={form.days_count}
                  onChange={(e) => setForm({ ...form, days_count: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Diária (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.daily_rate_snapshot}
                  onChange={(e) =>
                    setForm({ ...form, daily_rate_snapshot: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Passagem (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.transport_cost}
                  onChange={(e) => setForm({ ...form, transport_cost: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Almoço (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.meal_cost}
                  onChange={(e) => setForm({ ...form, meal_cost: e.target.value })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Outros custos (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.other_cost}
                  onChange={(e) => setForm({ ...form, other_cost: e.target.value })}
                />
              </div>
            </div>

            {props.scope === "project" && projectSOs.length > 0 && (
              <div className="space-y-1">
                <Label>Vincular a uma OS (opcional)</Label>
                <Select
                  value={form.service_order_id ?? "__none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      service_order_id: v === "__none" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhuma</SelectItem>
                    {projectSOs.map((so: any) => (
                      <SelectItem key={so.id} value={so.id}>
                        OS {so.service_order_number} — {so.title ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total calculado</span>
              <span className="font-semibold">{brl(computedTotal)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              O custo deixará de aparecer na margem do projeto. Esta ação pode ser
              revertida apenas no banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDel) delMut.mutate(confirmDel.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
