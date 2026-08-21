import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, RefreshCw, Save, Trash2, Wallet, PiggyBank, Percent, Building2 } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import {
  getCompanyCostSettings,
  updateCompanyCostSettings,
  listCompanyFixedCosts,
  upsertCompanyFixedCost,
  deleteCompanyFixedCost,
  syncFixedCostsTotal,
  type AllocationMethod,
  type CompanyFixedCost,
} from "@/lib/pricing.functions";

const CATS = ["Aluguel", "Salários", "Software", "Contador", "Marketing", "Veículo", "Outros"];

function pctToStr(v: number | null | undefined) {
  return v == null ? "" : String(Number((Number(v) * 100).toFixed(2)));
}
function strToPct(s: string) {
  const n = Number((s || "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : 0;
}
function numOrEmpty(v: number | null | undefined) {
  return v == null ? "" : String(v);
}

export function CostsPage() {
  const { has } = usePermissions();
  const canView =
    has("finance.view_costs") || has("finance.manage_cost_settings") || has("finance.manage");
  const canEdit = has("finance.manage_cost_settings") || has("finance.manage");

  if (!canView) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Custos da empresa"
          description="Configure custos e pró-labore para alimentar o markup."
        />
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="Sem acesso"
          description="Você não tem permissão para visualizar custos."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Custos da empresa"
        description="Faturamento esperado, custos fixos, pró-labore e método de alocação — base do cálculo do markup."
      />
      <Content canEdit={canEdit} />
    </div>
  );
}

function Content({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const getSettings = useServerFn(getCompanyCostSettings);
  const updateSettings = useServerFn(updateCompanyCostSettings);
  const listCosts = useServerFn(listCompanyFixedCosts);
  const upsertCost = useServerFn(upsertCompanyFixedCost);
  const deleteCost = useServerFn(deleteCompanyFixedCost);
  const syncTotals = useServerFn(syncFixedCostsTotal);

  const settingsQ = useQuery({ queryKey: ["cost-settings"], queryFn: () => getSettings() });
  const costsQ = useQuery({ queryKey: ["fixed-costs"], queryFn: () => listCosts() });

  const s = settingsQ.data?.settings ?? null;

  const [form, setForm] = useState({
    expected_monthly_revenue: "",
    expected_monthly_sales_count: "",
    monthly_operational_costs_total: "",
    default_operational_cost_rate: "",
    default_desired_margin_rate: "15",
    pro_labore_mode: "PERCENT" as "PERCENT" | "VALUE",
    pro_labore_percent: "5",
    pro_labore_value: "",
    allocation_method: "PERCENT_OF_REVENUE" as AllocationMethod,
  });

  useEffect(() => {
    if (!s) return;
    setForm({
      expected_monthly_revenue: numOrEmpty(s.expected_monthly_revenue),
      expected_monthly_sales_count: numOrEmpty(s.expected_monthly_sales_count),
      monthly_operational_costs_total: numOrEmpty(s.monthly_operational_costs_total),
      default_operational_cost_rate: pctToStr(s.default_operational_cost_rate),
      default_desired_margin_rate: pctToStr(s.default_desired_margin_rate) || "15",
      pro_labore_mode: s.pro_labore_value != null && s.pro_labore_value > 0 ? "VALUE" : "PERCENT",
      pro_labore_percent: pctToStr(s.pro_labore_percent) || "5",
      pro_labore_value: numOrEmpty(s.pro_labore_value),
      allocation_method: s.allocation_method,
    });
  }, [s?.id]);

  const revenue = Number(form.expected_monthly_revenue || 0);
  const fixedTotal = costsQ.data?.total ?? 0;
  const cfRate = revenue > 0 ? fixedTotal / revenue : 0;
  const proRate =
    form.pro_labore_mode === "VALUE"
      ? revenue > 0
        ? Number(form.pro_labore_value || 0) / revenue
        : 0
      : strToPct(form.pro_labore_percent);
  const dvRate = strToPct(form.default_operational_cost_rate);
  const mlRate = strToPct(form.default_desired_margin_rate);
  const totalDeductions = cfRate + proRate + dvRate + mlRate;

  const saveMut = useMutation({
    mutationFn: async () => {
      const proPercent =
        form.pro_labore_mode === "PERCENT"
          ? strToPct(form.pro_labore_percent)
          : revenue > 0
            ? Number(form.pro_labore_value || 0) / revenue
            : 0;
      const payload = {
        monthly_fixed_costs_total: fixedTotal,
        monthly_operational_costs_total: Number(form.monthly_operational_costs_total || 0),
        expected_monthly_revenue: revenue || null,
        expected_monthly_sales_count: form.expected_monthly_sales_count
          ? Number(form.expected_monthly_sales_count)
          : null,
        default_tax_rate: Number(s?.default_tax_rate ?? 0),
        default_card_fee_rate: Number(s?.default_card_fee_rate ?? 0),
        default_commission_rate: Number(s?.default_commission_rate ?? 0),
        default_warranty_reserve_rate: Number(s?.default_warranty_reserve_rate ?? 0),
        default_operational_cost_rate: dvRate,
        default_fixed_cost_allocation_rate: cfRate,
        default_desired_margin_rate: mlRate,
        pro_labore_percent: proPercent,
        pro_labore_value:
          form.pro_labore_mode === "VALUE" && form.pro_labore_value
            ? Number(form.pro_labore_value)
            : null,
        allocation_method: form.allocation_method,
      };
      return updateSettings({ data: payload });
    },
    onSuccess: () => {
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["cost-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const syncMut = useMutation({
    mutationFn: () => syncTotals(),
    onSuccess: (r: any) => {
      toast.success(
        `Total sincronizado: ${formatCurrency(r.total)} (CF ${(r.allocation_rate * 100).toFixed(2)}%).`,
      );
      qc.invalidateQueries({ queryKey: ["cost-settings"] });
      qc.invalidateQueries({ queryKey: ["fixed-costs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  return (
    <>
      {/* Resumo */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryCard
          icon={<Building2 />}
          label="Faturamento esperado"
          value={revenue ? formatCurrency(revenue) : "—"}
        />
        <SummaryCard
          icon={<Wallet />}
          label={`Custos fixos (CF ${revenue > 0 ? (cfRate * 100).toFixed(1) : "0"}%)`}
          value={formatCurrency(fixedTotal)}
        />
        <SummaryCard
          icon={<PiggyBank />}
          label={`Pró-labore (${(proRate * 100).toFixed(1)}%)`}
          value={
            form.pro_labore_mode === "VALUE"
              ? formatCurrency(Number(form.pro_labore_value || 0))
              : `${form.pro_labore_percent}%`
          }
        />
        <SummaryCard
          icon={<Percent />}
          label="Soma CF + Pró + DV + ML"
          value={`${(totalDeductions * 100).toFixed(2)}%`}
          highlight={totalDeductions >= 1}
        />
      </div>

      {/* Faturamento e vendas */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento e vendas esperados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Faturamento mensal esperado (R$)">
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={!canEdit}
              value={form.expected_monthly_revenue}
              onChange={(e) => setForm((f) => ({ ...f, expected_monthly_revenue: e.target.value }))}
            />
          </Field>
          <Field label="Vendas mensais esperadas (qtd)">
            <Input
              type="number"
              min={0}
              step="1"
              disabled={!canEdit}
              value={form.expected_monthly_sales_count}
              onChange={(e) =>
                setForm((f) => ({ ...f, expected_monthly_sales_count: e.target.value }))
              }
            />
          </Field>
          <Field label="Método de alocação">
            <Select
              value={form.allocation_method}
              disabled={!canEdit}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, allocation_method: v as AllocationMethod }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT_OF_REVENUE">% sobre faturamento</SelectItem>
                <SelectItem value="FIXED_PER_SALE">Valor fixo por venda</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* Pró-labore */}
      <Card>
        <CardHeader>
          <CardTitle>Pró-labore</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Modo">
            <Select
              value={form.pro_labore_mode}
              disabled={!canEdit}
              onValueChange={(v) => setForm((f) => ({ ...f, pro_labore_mode: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Percentual sobre faturamento</SelectItem>
                <SelectItem value="VALUE">Valor fixo mensal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.pro_labore_mode === "PERCENT" ? (
            <Field label="Pró-labore (%)  — sugestão 5%">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                disabled={!canEdit}
                value={form.pro_labore_percent}
                onChange={(e) => setForm((f) => ({ ...f, pro_labore_percent: e.target.value }))}
              />
            </Field>
          ) : (
            <Field label="Pró-labore (R$/mês)">
              <Input
                type="number"
                min={0}
                step="0.01"
                disabled={!canEdit}
                value={form.pro_labore_value}
                onChange={(e) => setForm((f) => ({ ...f, pro_labore_value: e.target.value }))}
              />
            </Field>
          )}
          <Field label="Equivalente em % do faturamento">
            <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">
              {(proRate * 100).toFixed(2)}%
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Custos variáveis e margem padrão */}
      <Card>
        <CardHeader>
          <CardTitle>Custos variáveis e margem padrão</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Custos variáveis / operacionais (%)">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={!canEdit}
              value={form.default_operational_cost_rate}
              onChange={(e) =>
                setForm((f) => ({ ...f, default_operational_cost_rate: e.target.value }))
              }
            />
          </Field>
          <Field label="Margem de lucro desejada (%)">
            <Input
              type="number"
              min={0}
              max={95}
              step="0.01"
              disabled={!canEdit}
              value={form.default_desired_margin_rate}
              onChange={(e) =>
                setForm((f) => ({ ...f, default_desired_margin_rate: e.target.value }))
              }
            />
          </Field>
          <Field label="Total operacional/mês (R$) — opcional">
            <Input
              type="number"
              min={0}
              step="0.01"
              disabled={!canEdit}
              value={form.monthly_operational_costs_total}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthly_operational_costs_total: e.target.value }))
              }
            />
          </Field>
        </CardContent>
      </Card>

      {totalDeductions >= 1 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Os percentuais de custos, pró-labore e margem somam {(totalDeductions * 100).toFixed(2)}%.
          Reduza custos ou margem para calcular o preço.
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar configurações
          </Button>
          <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar total de custos fixos
          </Button>
        </div>
      )}

      <Separator />

      {/* Custos fixos CRUD */}
      <FixedCostsTable
        items={costsQ.data?.items ?? []}
        canEdit={canEdit}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["fixed-costs"] });
        }}
        upsert={upsertCost}
        remove={deleteCost}
      />
    </>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-destructive/60" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FixedCostsTable({
  items,
  canEdit,
  onSaved,
  upsert,
  remove,
}: {
  items: CompanyFixedCost[];
  canEdit: boolean;
  onSaved: () => void;
  upsert: ReturnType<typeof useServerFn<typeof upsertCompanyFixedCost>>;
  remove: ReturnType<typeof useServerFn<typeof deleteCompanyFixedCost>>;
}) {
  const [draft, setDraft] = useState({ name: "", category: CATS[0], amount: "" });
  const total = useMemo(
    () => items.filter((i) => i.active).reduce((s, i) => s + Number(i.amount || 0), 0),
    [items],
  );

  const addMut = useMutation({
    mutationFn: (payload: {
      name: string;
      category: string | null;
      amount: number;
      active: boolean;
    }) => upsert({ data: payload }),
    onSuccess: () => {
      setDraft({ name: "", category: CATS[0], amount: "" });
      toast.success("Custo fixo adicionado.");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const toggleMut = useMutation({
    mutationFn: (r: CompanyFixedCost) =>
      upsert({
        data: {
          id: r.id,
          name: r.name,
          category: r.category,
          amount: Number(r.amount),
          active: !r.active,
        },
      }),
    onSuccess: onSaved,
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido.");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Custos fixos mensais</CardTitle>
        <Badge variant="secondary">Total ativo: {formatCurrency(total)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_160px_auto]">
            <Input
              placeholder="Nome (ex.: Aluguel do escritório)"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <Select
              value={draft.category}
              onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Valor mensal (R$)"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            />
            <Button
              disabled={!draft.name.trim() || !draft.amount || addMut.isPending}
              onClick={() =>
                addMut.mutate({
                  name: draft.name.trim(),
                  category: draft.category,
                  amount: Number(draft.amount),
                  active: true,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Nenhum custo fixo cadastrado"
            description="Cadastre aluguel, salários, software e outros custos mensais para calcular o markup."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id} className={!r.active ? "opacity-60" : ""}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.category ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(r.amount))}</TableCell>
                  <TableCell>
                    <Switch
                      checked={r.active}
                      disabled={!canEdit}
                      onCheckedChange={() => toggleMut.mutate(r)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button size="icon" variant="ghost" onClick={() => delMut.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
