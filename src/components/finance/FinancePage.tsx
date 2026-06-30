import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Wallet, TrendingUp, TrendingDown, AlertTriangle, Calendar, CheckCircle2, XCircle, Trash2, Pencil, Settings2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

import {
  ensureDefaultFinancialCategories, getFinanceOverview, getCashFlow,
  listFinancialTransactions, listFinancialCategories,
  createFinancialTransaction, markTransactionAsPaid,
  cancelFinancialTransaction, softDeleteFinancialTransaction, updateFinancialTransaction,
  createFinancialCategory, deactivateFinancialCategory,
  type FinancialTransaction, type FinancialCategory, type FinTxType, type FinTxStatus,
} from "@/lib/finance.functions";
import { useCompanyId } from "@/hooks/use-company-id";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Preset = "today" | "7d" | "month" | "lastMonth" | "next7" | "next30" | "year" | "custom";

function rangeFor(p: Preset, custom?: { from?: string; to?: string }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(today), end = new Date(today);
  switch (p) {
    case "today": return { from: iso(today), to: iso(today) };
    case "7d": start.setDate(today.getDate() - 7); return { from: iso(start), to: iso(today) };
    case "month": start.setDate(1); return { from: iso(start), to: iso(today) };
    case "lastMonth": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(s), to: iso(e) };
    }
    case "next7": end.setDate(today.getDate() + 7); return { from: iso(today), to: iso(end) };
    case "next30": end.setDate(today.getDate() + 30); return { from: iso(today), to: iso(end) };
    case "year": return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
    case "custom": return { from: custom?.from, to: custom?.to };
  }
}

function StatusBadge({ s }: { s: FinTxStatus }) {
  const map: Record<FinTxStatus, { label: string; cls: string }> = {
    PLANNED: { label: "Planejado", cls: "bg-muted text-muted-foreground" },
    PAID: { label: "Pago", cls: "bg-success/15 text-success" },
    OVERDUE: { label: "Vencido", cls: "bg-destructive/15 text-destructive" },
    CANCELED: { label: "Cancelado", cls: "bg-muted text-muted-foreground line-through" },
    RECONCILED: { label: "Conciliado", cls: "bg-primary/15 text-primary" },
  };
  const e = map[s];
  return <Badge variant="outline" className={e.cls}>{e.label}</Badge>;
}

function effStatus(t: { status: FinTxStatus; due_date: string | null }): FinTxStatus {
  if (t.status === "PLANNED" && t.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(t.due_date) < today) return "OVERDUE";
  }
  return t.status;
}

export function FinanceFilters({ preset, onChange, custom, onCustom }: {
  preset: Preset; onChange: (p: Preset) => void;
  custom: { from?: string; to?: string }; onCustom: (c: { from?: string; to?: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => onChange(v as Preset)}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="month">Este mês</SelectItem>
          <SelectItem value="lastMonth">Mês passado</SelectItem>
          <SelectItem value="next7">Próximos 7 dias</SelectItem>
          <SelectItem value="next30">Próximos 30 dias</SelectItem>
          <SelectItem value="year">Este ano</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>
      {preset === "custom" && (
        <>
          <Input type="date" value={custom.from ?? ""} onChange={(e) => onCustom({ ...custom, from: e.target.value })} className="w-[160px]" />
          <Input type="date" value={custom.to ?? ""} onChange={(e) => onCustom({ ...custom, to: e.target.value })} className="w-[160px]" />
        </>
      )}
    </div>
  );
}

function FinanceMetricCard({ title, value, hint, icon, tone }: {
  title: string; value: string; hint: string; icon: React.ReactNode;
  tone?: "success" | "danger" | "warning" | "default";
}) {
  const toneCls = tone === "success" ? "text-success"
    : tone === "danger" ? "text-destructive"
    : tone === "warning" ? "text-amber-500"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight ${toneCls}`}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionFormSheet({ open, onOpenChange, type, editing, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  type: FinTxType; editing?: FinancialTransaction | null; onSaved?: () => void;
}) {
  const companyId = useCompanyId();
  const catsFn = useServerFn(listFinancialCategories);
  const createFn = useServerFn(createFinancialTransaction);
  const updateFn = useServerFn(updateFinancialTransaction);

  const cats = useQuery({
    queryKey: ["fin-cats", companyId, type],
    queryFn: () => catsFn({ data: { type, activeOnly: true } }),
    enabled: open,
  });

  const [form, setForm] = useState(() => ({
    description: editing?.description ?? "",
    amount: editing?.amount?.toString() ?? "",
    due_date: editing?.due_date ?? "",
    paid_at: editing?.paid_at?.slice(0, 10) ?? "",
    category_id: editing?.category_id ?? "",
    payment_method: editing?.payment_method ?? "",
    notes: editing?.notes ?? "",
    status: (editing?.status ?? "PLANNED") as FinTxStatus,
  }));

  const submitting = useMutation({
    mutationFn: async () => {
      const payload: any = {
        type,
        description: form.description,
        amount: Number(form.amount.replace(",", ".")) || 0,
        due_date: form.due_date || null,
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
        category_id: form.category_id || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        status: form.status,
      };
      if (editing) return updateFn({ data: { id: editing.id, ...payload } });
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Lançamento atualizado." : "Lançamento criado.");
      onSaved?.(); onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar" : "Nova"} {type === "INCOME" ? "entrada" : "saída"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Instalação cliente João" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>{type === "INCOME" ? "Recebido em" : "Pago em"}</Label>
              <Input type="date" value={form.paid_at ?? ""} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as FinTxStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">Planejado</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="CANCELED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Input value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="Pix, cartão, dinheiro…" />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <Button className="w-full" onClick={() => submitting.mutate()} disabled={!form.description || !form.amount || submitting.isPending}>
            {submitting.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TransactionTable({ rows, onChanged }: { rows: FinancialTransaction[]; onChanged: () => void }) {
  const markPaid = useServerFn(markTransactionAsPaid);
  const cancelFn = useServerFn(cancelFinancialTransaction);
  const delFn = useServerFn(softDeleteFinancialTransaction);
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);

  const act = useMutation({
    mutationFn: async ({ kind, id }: { kind: "paid" | "cancel" | "delete"; id: string }) => {
      if (kind === "paid") return markPaid({ data: { id } });
      if (kind === "cancel") return cancelFn({ data: { id } });
      return delFn({ data: { id } });
    },
    onSuccess: () => { toast.success("Atualizado."); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  if (!rows.length) {
    return (
      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title="Nenhum lançamento financeiro ainda"
        description="Cadastre entradas e saídas para acompanhar o fluxo de caixa da sua empresa."
      />
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const eff = effStatus(t);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{t.due_date ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{t.description}</div>
                      <div className="text-xs text-muted-foreground">{t.customer_name ?? t.supplier_name ?? ""}</div>
                    </TableCell>
                    <TableCell>{t.category_name ?? "—"}</TableCell>
                    <TableCell>
                      <span className={t.type === "INCOME" ? "text-success" : "text-destructive"}>
                        {t.type === "INCOME" ? "Entrada" : "Saída"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{BRL(t.amount)}</TableCell>
                    <TableCell><StatusBadge s={eff} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{t.paid_at ? new Date(t.paid_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {eff !== "PAID" && eff !== "CANCELED" && (
                          <Button size="sm" variant="ghost" title="Marcar como pago" onClick={() => act.mutate({ kind: "paid", id: t.id })}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {eff !== "CANCELED" && (
                          <Button size="sm" variant="ghost" title="Cancelar" onClick={() => act.mutate({ kind: "cancel", id: t.id })}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" title="Excluir" onClick={() => act.mutate({ kind: "delete", id: t.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {editing && (
        <TransactionFormSheet
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          type={editing.type}
          editing={editing}
          onSaved={onChanged}
        />
      )}
    </>
  );
}

function CategoriesManager() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const listFn = useServerFn(listFinancialCategories);
  const createFn = useServerFn(createFinancialCategory);
  const deactivateFn = useServerFn(deactivateFinancialCategory);

  const q = useQuery({
    queryKey: ["fin-cats-all", companyId],
    queryFn: () => listFn({ data: { activeOnly: false } }),
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<FinTxType>("INCOME");

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, type } }),
    onSuccess: () => { toast.success("Categoria criada."); setName(""); qc.invalidateQueries({ queryKey: ["fin-cats-all", companyId] }); qc.invalidateQueries({ queryKey: ["fin-cats", companyId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateFn({ data: { id } }),
    onSuccess: () => { toast.success("Categoria desativada."); qc.invalidateQueries({ queryKey: ["fin-cats-all", companyId] }); },
  });

  const grouped = useMemo(() => {
    const inc: FinancialCategory[] = []; const exp: FinancialCategory[] = [];
    (q.data ?? []).forEach((c) => (c.type === "INCOME" ? inc : exp).push(c));
    return { inc, exp };
  }, [q.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div className="flex-1 min-w-[200px]">
            <Label>Nova categoria</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as FinTxType)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">Entrada</SelectItem>
                <SelectItem value="EXPENSE">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(["inc", "exp"] as const).map((k) => (
          <Card key={k}>
            <CardContent className="p-4">
              <h3 className="mb-2 font-semibold">{k === "inc" ? "Entradas" : "Saídas"}</h3>
              <ul className="space-y-1">
                {(k === "inc" ? grouped.inc : grouped.exp).map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted/50">
                    <span className={c.active ? "" : "text-muted-foreground line-through"}>
                      {c.name} {c.is_default && <Badge variant="outline" className="ml-1 text-[10px]">padrão</Badge>}
                    </span>
                    {c.active && (
                      <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(c.id)}>Desativar</Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function FinancePage() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const filters = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  const ensureFn = useServerFn(ensureDefaultFinancialCategories);
  // Seed default categories once per company session.
  useQuery({
    queryKey: ["fin-seed", companyId],
    queryFn: () => ensureFn(),
    enabled: !!companyId,
    staleTime: Infinity,
  });

  const overviewFn = useServerFn(getFinanceOverview);
  const cashFn = useServerFn(getCashFlow);
  const listFn = useServerFn(listFinancialTransactions);

  const overview = useQuery({
    queryKey: ["fin-overview", companyId, filters],
    queryFn: () => overviewFn({ data: filters }),
    enabled: !!companyId,
  });
  const cashflow = useQuery({
    queryKey: ["fin-cashflow", companyId, filters],
    queryFn: () => cashFn({ data: filters }),
    enabled: !!companyId,
  });
  const incomes = useQuery({
    queryKey: ["fin-incomes", companyId, filters],
    queryFn: () => listFn({ data: { ...filters, type: "INCOME" } }),
    enabled: !!companyId,
  });
  const expenses = useQuery({
    queryKey: ["fin-expenses", companyId, filters],
    queryFn: () => listFn({ data: { ...filters, type: "EXPENSE" } }),
    enabled: !!companyId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["fin-overview", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-cashflow", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-incomes", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-expenses", companyId] });
  };

  const [sheet, setSheet] = useState<{ open: boolean; type: FinTxType }>({ open: false, type: "INCOME" });
  const o = overview.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Entradas, saídas e fluxo de caixa da sua empresa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FinanceFilters preset={preset} onChange={setPreset} custom={custom} onCustom={setCustom} />
          <Button asChild variant="outline">
            <Link to="/finance/pricing/settings">
              <Settings2 className="mr-1 h-4 w-4" /> Custos & Precificação
            </Link>
          </Button>
          <Button onClick={() => setSheet({ open: true, type: "INCOME" })}>
            <Plus className="mr-1 h-4 w-4" /> Entrada
          </Button>
          <Button variant="secondary" onClick={() => setSheet({ open: true, type: "EXPENSE" })}>
            <Plus className="mr-1 h-4 w-4" /> Saída
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="income">Entradas</TabsTrigger>
          <TabsTrigger value="expense">Saídas</TabsTrigger>
          <TabsTrigger value="receivables">A Receber</TabsTrigger>
          <TabsTrigger value="payables">A Pagar</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FinanceMetricCard title="Entradas no período" value={BRL(o?.income ?? 0)} hint="Somente lançamentos pagos." tone="success" icon={<TrendingUp className="h-5 w-5" />} />
            <FinanceMetricCard title="Saídas no período" value={BRL(o?.expense ?? 0)} hint="Somente lançamentos pagos." tone="danger" icon={<TrendingDown className="h-5 w-5" />} />
            <FinanceMetricCard title="Saldo do período" value={BRL(o?.balance ?? 0)} hint="Quanto sobrou após entradas e saídas." tone={(o?.balance ?? 0) >= 0 ? "success" : "danger"} icon={<Wallet className="h-5 w-5" />} />
            <FinanceMetricCard title="A receber" value={BRL(o?.receivables ?? 0)} hint="Entradas planejadas e em aberto." icon={<Calendar className="h-5 w-5" />} />
            <FinanceMetricCard title="A pagar" value={BRL(o?.payables ?? 0)} hint="Saídas planejadas e em aberto." icon={<Calendar className="h-5 w-5" />} />
            <FinanceMetricCard title="Recebimentos atrasados" value={BRL(o?.overdueReceivables ?? 0)} hint="Entradas vencidas e não recebidas." tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
            <FinanceMetricCard title="Contas vencidas" value={BRL(o?.overduePayables ?? 0)} hint="Saídas vencidas e não pagas." tone="warning" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4">
          <TransactionTable rows={cashflow.data ?? []} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="income" className="mt-4">
          <TransactionTable rows={incomes.data ?? []} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          <TransactionTable rows={expenses.data ?? []} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="receivables" className="mt-4">
          <TransactionTable rows={(incomes.data ?? []).filter((t) => t.status !== "RECONCILED")} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="payables" className="mt-4">
          <TransactionTable rows={(expenses.data ?? []).filter((t) => t.status !== "RECONCILED")} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesManager />
        </TabsContent>
      </Tabs>

      <TransactionFormSheet
        open={sheet.open}
        onOpenChange={(o) => setSheet({ ...sheet, open: o })}
        type={sheet.type}
        onSaved={invalidateAll}
      />
    </div>
  );
}
