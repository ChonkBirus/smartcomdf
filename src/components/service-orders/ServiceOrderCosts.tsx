import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { usePermissions } from "@/lib/permissions";
import {
  listServiceOrderCosts,
  createServiceOrderCost,
  updateServiceOrderCost,
  cancelServiceOrderCost,
  type ServiceOrderCost,
} from "@/lib/service-order-costs.functions";
import { listFinancialCategories } from "@/lib/finance.functions";
import { listBankAccounts } from "@/lib/bank-accounts.functions";

type Props = { serviceOrderId: string; projectId?: string | null };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ServiceOrderCosts({ serviceOrderId, projectId }: Props) {
  const qc = useQueryClient();
  const { has, isOwner, isSuperAdmin } = usePermissions();
  const canManage =
    isOwner ||
    isSuperAdmin ||
    has("service_orders.manage") ||
    has("finance.manage") ||
    has("finance.transactions.manage");

  const listFn = useServerFn(listServiceOrderCosts);
  const catsFn = useServerFn(listFinancialCategories);
  const banksFn = useServerFn(listBankAccounts);
  const createFn = useServerFn(createServiceOrderCost);
  const updateFn = useServerFn(updateServiceOrderCost);
  const cancelFn = useServerFn(cancelServiceOrderCost);

  const { data: costs = [], isLoading } = useQuery({
    queryKey: ["so-costs", serviceOrderId],
    queryFn: () => listFn({ data: { service_order_id: serviceOrderId } }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["fin-cats", "EXPENSE"],
    queryFn: () => catsFn({ data: { type: "EXPENSE", activeOnly: true } }),
    enabled: canManage,
  });
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", true],
    queryFn: () => banksFn({ data: { activeOnly: true } }),
    enabled: canManage,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["so-costs", serviceOrderId] });
    qc.invalidateQueries({ queryKey: ["finance-transactions"] });
    qc.invalidateQueries({ queryKey: ["finance-report"] });
    qc.invalidateQueries({ queryKey: ["project-margin"] });
    qc.invalidateQueries({ queryKey: ["service-order", serviceOrderId] });
    if (projectId) qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["payables"] });
    qc.invalidateQueries({ queryKey: ["cashflow"] });
  };

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<ServiceOrderCost | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ServiceOrderCost | null>(null);

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category_id: "",
    status: "PAID" as "PAID" | "PLANNED",
    due_date: "",
    paid_at: new Date().toISOString().slice(0, 10),
    bank_account_id: "",
    payment_method: "",
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      description: "",
      amount: "",
      category_id: "",
      status: "PAID",
      due_date: "",
      paid_at: new Date().toISOString().slice(0, 10),
      bank_account_id: "",
      payment_method: "",
    });
    setOpenForm(true);
  };

  const openEdit = (c: ServiceOrderCost) => {
    setEditing(c);
    setForm({
      description: c.description,
      amount: String(c.amount),
      category_id: c.category_id ?? "",
      status: c.status === "CANCELED" ? "PAID" : c.status,
      due_date: c.due_date ?? "",
      paid_at: (c.paid_at ?? "").slice(0, 10),
      bank_account_id: c.bank_account_id ?? "",
      payment_method: c.payment_method ?? "",
    });
    setOpenForm(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const amount = Number(String(form.amount).replace(",", "."));
      if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
      if (!form.description.trim()) throw new Error("Descreva o custo.");
      if (!form.category_id) throw new Error("Selecione a categoria.");
      const payload = {
        description: form.description.trim(),
        amount,
        category_id: form.category_id,
        status: form.status,
        due_date: form.status === "PLANNED" ? form.due_date || null : null,
        paid_at: form.status === "PAID" ? form.paid_at || null : null,
        bank_account_id:
          form.status === "PAID" && form.bank_account_id ? form.bank_account_id : null,
        payment_method: form.status === "PAID" && form.payment_method ? form.payment_method : null,
      };
      if (editing) {
        return updateFn({ data: { id: editing.id, ...payload } });
      }
      return createFn({ data: { service_order_id: serviceOrderId, ...payload } });
    },
    onSuccess: () => {
      toast.success(editing ? "Custo atualizado." : "Custo lançado.");
      setOpenForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar custo."),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (cancelTarget) await cancelFn({ data: { id: cancelTarget.id } });
    },
    onSuccess: () => {
      toast.success("Custo cancelado.");
      setCancelTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar."),
  });

  const total = useMemo(
    () => costs.filter((c) => c.status !== "CANCELED").reduce((s, c) => s + c.amount, 0),
    [costs],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `Total ativo: ${brl(total)}`}
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar custo
          </Button>
        )}
      </div>

      {costs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum custo avulso lançado. Ex.: Uber, refeição, pedágio, técnico terceirizado.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {costs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{c.description}</span>
                  <Badge
                    variant={
                      c.status === "PAID"
                        ? "default"
                        : c.status === "PLANNED"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {c.status === "PAID"
                      ? "Pago"
                      : c.status === "PLANNED"
                        ? "Previsto"
                        : "Cancelado"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.category_name ?? "Sem categoria"}
                  {c.status === "PLANNED" && c.due_date ? ` · Vence ${c.due_date}` : ""}
                  {c.status === "PAID" && c.paid_at ? ` · Pago em ${c.paid_at.slice(0, 10)}` : ""}
                </div>
              </div>
              <div className="text-right font-semibold tabular-nums">{brl(c.amount)}</div>
              {canManage && c.status !== "CANCELED" && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(c)}
                    aria-label="Editar custo"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCancelTarget(c)}
                    aria-label="Cancelar custo"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar custo" : "Adicionar custo"}</DialogTitle>
            <DialogDescription>
              Lançamento vai para o financeiro com origem SERVICE_ORDER_COST.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Uber ida e volta, pedágio, técnico terceirizado"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: "PAID" | "PLANNED") => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">Pago</SelectItem>
                    <SelectItem value="PLANNED">Previsto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.status === "PLANNED" ? (
              <div>
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label>Data do pagamento</Label>
                  <Input
                    type="date"
                    value={form.paid_at}
                    onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Conta bancária</Label>
                    <Select
                      value={form.bank_account_id || "none"}
                      onValueChange={(v) =>
                        setForm({ ...form, bank_account_id: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {bankAccounts.map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name}
                            {b.account_name ? ` · ${b.account_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Forma de pagamento</Label>
                    <Select
                      value={form.payment_method || "none"}
                      onValueChange={(v) =>
                        setForm({ ...form, payment_method: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informado</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="CASH">Dinheiro</SelectItem>
                        <SelectItem value="DEBIT">Débito</SelectItem>
                        <SelectItem value="CREDIT">Crédito</SelectItem>
                        <SelectItem value="TRANSFER">Transferência</SelectItem>
                        <SelectItem value="BOLETO">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenForm(false)} disabled={saveMut.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar custo?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento será marcado como cancelado e sairá do fluxo de caixa e da margem ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMut.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelMut.mutate();
              }}
              disabled={cancelMut.isPending}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
