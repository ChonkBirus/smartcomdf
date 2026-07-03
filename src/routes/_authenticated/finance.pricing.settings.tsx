import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Info, Save, Plus, Trash2, Sparkles, AlertTriangle } from "lucide-react";

import { PermissionRoute } from "@/components/app/PermissionRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import {
  getCompanyCostSettings,
  updateCompanyCostSettings,
  listCompanyFixedCosts,
  upsertCompanyFixedCost,
  deleteCompanyFixedCost,
  type AllocationMethod,
} from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/finance/pricing/settings")({
  head: () => ({ meta: [{ title: "Custos e Markup — SmartPro" }] }),
  component: () => (
    <PermissionRoute module="finance" action="view">
      <CostSettingsPage />
    </PermissionRoute>
  ),
});

type FormState = {
  monthly_fixed_costs_total: string;
  monthly_operational_costs_total: string;
  expected_monthly_revenue: string;
  expected_monthly_sales_count: string;
  default_tax_rate: string;
  default_card_fee_rate: string;
  default_commission_rate: string;
  default_warranty_reserve_rate: string;
  default_operational_cost_rate: string;
  default_fixed_cost_allocation_rate: string;
  default_desired_margin_rate: string;
  pro_labore_percent: string;
  pro_labore_value: string;
  allocation_method: AllocationMethod;
};

const EMPTY: FormState = {
  monthly_fixed_costs_total: "0",
  monthly_operational_costs_total: "0",
  expected_monthly_revenue: "",
  expected_monthly_sales_count: "",
  default_tax_rate: "0",
  default_card_fee_rate: "0",
  default_commission_rate: "0",
  default_warranty_reserve_rate: "0",
  default_operational_cost_rate: "0",
  default_fixed_cost_allocation_rate: "0",
  default_desired_margin_rate: "15",
  pro_labore_percent: "5",
  pro_labore_value: "",
  allocation_method: "PERCENT_OF_REVENUE",
};

const parseDec = (s: string) => {
  const n = Number((s ?? "").toString().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-1 inline-flex cursor-help text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CostSettingsPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canManage = has("finance.manage_cost_settings");

  const getFn = useServerFn(getCompanyCostSettings);
  const saveFn = useServerFn(updateCompanyCostSettings);
  const listFxFn = useServerFn(listCompanyFixedCosts);
  const upsertFxFn = useServerFn(upsertCompanyFixedCost);
  const deleteFxFn = useServerFn(deleteCompanyFixedCost);

  const q = useQuery({ queryKey: ["pricing-cost-settings"], queryFn: () => getFn() });
  const fx = useQuery({ queryKey: ["company-fixed-costs"], queryFn: () => listFxFn() });

  const [form, setForm] = useState<FormState>(EMPTY);
  const canViewCosts = q.data?.canViewCosts ?? false;

  useEffect(() => {
    const s = q.data?.settings;
    if (!s) return;
    setForm({
      monthly_fixed_costs_total: String(s.monthly_fixed_costs_total ?? 0),
      monthly_operational_costs_total: String(s.monthly_operational_costs_total ?? 0),
      expected_monthly_revenue: s.expected_monthly_revenue == null ? "" : String(s.expected_monthly_revenue),
      expected_monthly_sales_count: s.expected_monthly_sales_count == null ? "" : String(s.expected_monthly_sales_count),
      default_tax_rate: String((s.default_tax_rate ?? 0) * 100),
      default_card_fee_rate: String((s.default_card_fee_rate ?? 0) * 100),
      default_commission_rate: String((s.default_commission_rate ?? 0) * 100),
      default_warranty_reserve_rate: String((s.default_warranty_reserve_rate ?? 0) * 100),
      default_operational_cost_rate: String((s.default_operational_cost_rate ?? 0) * 100),
      default_fixed_cost_allocation_rate: String((s.default_fixed_cost_allocation_rate ?? 0) * 100),
      default_desired_margin_rate: String((s.default_desired_margin_rate ?? 0.15) * 100),
      pro_labore_percent: String((s.pro_labore_percent ?? 0.05) * 100),
      pro_labore_value: s.pro_labore_value == null ? "" : String(s.pro_labore_value),
      allocation_method: s.allocation_method,
    });
  }, [q.data?.settings]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          monthly_fixed_costs_total: parseDec(form.monthly_fixed_costs_total),
          monthly_operational_costs_total: parseDec(form.monthly_operational_costs_total),
          expected_monthly_revenue:
            form.expected_monthly_revenue === "" ? null : parseDec(form.expected_monthly_revenue),
          expected_monthly_sales_count:
            form.expected_monthly_sales_count === ""
              ? null
              : Math.max(0, Math.round(parseDec(form.expected_monthly_sales_count))),
          default_tax_rate: parseDec(form.default_tax_rate) / 100,
          default_card_fee_rate: parseDec(form.default_card_fee_rate) / 100,
          default_commission_rate: parseDec(form.default_commission_rate) / 100,
          default_warranty_reserve_rate: parseDec(form.default_warranty_reserve_rate) / 100,
          default_operational_cost_rate: parseDec(form.default_operational_cost_rate) / 100,
          default_fixed_cost_allocation_rate: parseDec(form.default_fixed_cost_allocation_rate) / 100,
          default_desired_margin_rate: parseDec(form.default_desired_margin_rate) / 100,
          pro_labore_percent: parseDec(form.pro_labore_percent) / 100,
          pro_labore_value: form.pro_labore_value === "" ? null : parseDec(form.pro_labore_value),
          allocation_method: form.allocation_method,
        },
      }),
    onSuccess: () => {
      toast.success("Configurações salvas.");
      qc.invalidateQueries({ queryKey: ["pricing-cost-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ============ Live markup summary ============
  const summary = useMemo(() => {
    const revenue = parseDec(form.expected_monthly_revenue);
    const fixedTotal = parseDec(form.monthly_fixed_costs_total);
    const cfRate = revenue > 0 ? Math.min(fixedTotal / revenue, 1) : 0;

    // pró-labore: usar valor fixo se informado, senão percentual
    const proValue = parseDec(form.pro_labore_value);
    const proPct = parseDec(form.pro_labore_percent) / 100;
    const proRate = revenue > 0 && proValue > 0 ? proValue / revenue : proPct;

    const dvRate =
      (parseDec(form.default_tax_rate) +
        parseDec(form.default_card_fee_rate) +
        parseDec(form.default_commission_rate) +
        parseDec(form.default_warranty_reserve_rate) +
        parseDec(form.default_operational_cost_rate)) /
      100;
    const mlRate = parseDec(form.default_desired_margin_rate) / 100;

    const totalRate = cfRate + proRate + dvRate + mlRate;
    let markup = 0;
    let error: string | null = null;
    if (revenue <= 0 && fixedTotal > 0) {
      error = "Informe o faturamento médio mensal para calcular o percentual de custos fixos.";
    } else if (totalRate >= 1) {
      error = "Os percentuais somam 100% ou mais. Reduza custos ou margem para calcular o preço.";
    } else {
      markup = 1 / (1 - totalRate);
    }

    return { cfRate, proRate, dvRate, mlRate, totalRate, markup, error };
  }, [form]);

  const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/finance">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao Financeiro
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Custos da empresa & Markup
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha faturamento, custos e pró-labore. O sistema calcula o markup ideal e sugere o preço de venda dos seus produtos.
          </p>
        </div>
      </div>

      {!canManage && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm">
            Você pode visualizar essas configurações, mas precisa da permissão
            <strong> finance.manage_cost_settings </strong>
            para alterá-las.
          </CardContent>
        </Card>
      )}

      {/* ============ Faturamento ============ */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Quanto sua empresa fatura?</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Faturamento médio mensal (R$)
              <Hint>Quanto sua empresa fatura em média por mês. Base para ratear custos fixos e pró-labore.</Hint>
            </Label>
            <Input
              inputMode="decimal"
              value={canViewCosts ? form.expected_monthly_revenue : "••••"}
              onChange={(e) => set("expected_monthly_revenue", e.target.value)}
              disabled={!canViewCosts || !canManage}
              placeholder="Ex.: 25000"
            />
          </div>
          <div>
            <Label>
              Vendas médias por mês
              <Hint>Quantas vendas você costuma fechar por mês. Usado quando o rateio é por venda.</Hint>
            </Label>
            <Input
              inputMode="numeric"
              value={canViewCosts ? form.expected_monthly_sales_count : "••••"}
              onChange={(e) => set("expected_monthly_sales_count", e.target.value)}
              disabled={!canViewCosts || !canManage}
            />
          </div>
        </CardContent>
      </Card>

      {/* ============ Custos fixos detalhados ============ */}
      <FixedCostsCard
        canManage={canManage && canViewCosts}
        items={fx.data?.items ?? []}
        total={fx.data?.total ?? 0}
        onChange={() => qc.invalidateQueries({ queryKey: ["company-fixed-costs"] })}
        upsertFn={upsertFxFn}
        deleteFn={deleteFxFn}
        onApplyTotal={(t) => set("monthly_fixed_costs_total", String(t))}
        currentTotalField={form.monthly_fixed_costs_total}
        setCurrentTotalField={(v) => set("monthly_fixed_costs_total", v)}
      />

      {/* ============ Pró-labore ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            3. Pró-labore
            <Badge variant="secondary" className="text-xs">Sugestão inicial: 5%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Pró-labore (% do faturamento)
              <Hint>Remuneração do dono/sócio pela operação da empresa. Recomendação inicial: 5%.</Hint>
            </Label>
            <Input
              inputMode="decimal"
              value={form.pro_labore_percent}
              onChange={(e) => set("pro_labore_percent", e.target.value)}
              disabled={!canManage}
              placeholder="5"
            />
          </div>
          <div>
            <Label>
              …ou valor fixo mensal (R$) <span className="text-xs text-muted-foreground">(opcional)</span>
              <Hint>Se informado, tem prioridade sobre o percentual e é convertido em % do faturamento.</Hint>
            </Label>
            <Input
              inputMode="decimal"
              value={form.pro_labore_value}
              onChange={(e) => set("pro_labore_value", e.target.value)}
              disabled={!canManage}
              placeholder="Ex.: 1250"
            />
          </div>
        </CardContent>
      </Card>

      {/* ============ Custos variáveis ============ */}
      <Card>
        <CardHeader><CardTitle className="text-base">4. Custos operacionais e variáveis</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <PctField label="Impostos" hint="Percentual médio de impostos sobre venda (Simples, ICMS, ISS)." value={form.default_tax_rate} onChange={(v) => set("default_tax_rate", v)} disabled={!canManage} />
          <PctField label="Taxa de cartão" hint="Percentual médio cobrado pela operadora de cartão." value={form.default_card_fee_rate} onChange={(v) => set("default_card_fee_rate", v)} disabled={!canManage} />
          <PctField label="Comissão" hint="Comissão paga a vendedor/parceiro." value={form.default_commission_rate} onChange={(v) => set("default_commission_rate", v)} disabled={!canManage} />
          <PctField label="Reserva de garantia" hint="Reserva para cobrir trocas e retornos." value={form.default_warranty_reserve_rate} onChange={(v) => set("default_warranty_reserve_rate", v)} disabled={!canManage} />
          <PctField label="Custo operacional variável" hint="Frete, combustível, embalagem, deslocamento etc." value={form.default_operational_cost_rate} onChange={(v) => set("default_operational_cost_rate", v)} disabled={!canManage} />
          <PctField label="Rateio de custo fixo (opcional)" hint="Deixe 0 para o sistema calcular automaticamente a partir do faturamento e custos fixos." value={form.default_fixed_cost_allocation_rate} onChange={(v) => set("default_fixed_cost_allocation_rate", v)} disabled={!canManage} />
        </CardContent>
      </Card>

      {/* ============ Margem desejada ============ */}
      <Card>
        <CardHeader><CardTitle className="text-base">5. Margem de lucro desejada</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <PctField label="Margem desejada" hint="Lucro líquido que a empresa quer reter depois de pagar custos, impostos e pró-labore." value={form.default_desired_margin_rate} onChange={(v) => set("default_desired_margin_rate", v)} disabled={!canManage} />
          <div>
            <Label>
              Método de rateio
              <Hint>Como diluir custos fixos em cada venda. Por % do faturamento ou valor fixo por venda.</Hint>
            </Label>
            <Select value={form.allocation_method} onValueChange={(v) => set("allocation_method", v as AllocationMethod)} disabled={!canManage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT_OF_REVENUE">% do faturamento</SelectItem>
                <SelectItem value="FIXED_PER_SALE">Valor fixo por venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ============ Resumo do Markup ============ */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Seu markup ideal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Custos fixos (CF)" value={pct(summary.cfRate)} />
            <SummaryStat label="Pró-labore" value={pct(summary.proRate)} />
            <SummaryStat label="Variáveis (DV)" value={pct(summary.dvRate)} />
            <SummaryStat label="Margem (ML)" value={pct(summary.mlRate)} />
          </div>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Total considerado</div>
              <div className="text-lg font-semibold">{pct(summary.totalRate)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Markup multiplicador</div>
              <div className="text-3xl font-bold text-primary">
                {summary.markup > 0 ? `${summary.markup.toFixed(2)}×` : "—"}
              </div>
            </div>
          </div>
          {summary.error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <span>{summary.error}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cada produto ou serviço deve ser multiplicado por <strong>{summary.markup.toFixed(2)}×</strong> para cobrir custos fixos, pró-labore, despesas variáveis e ainda deixar a margem desejada.
              {" "}
              Exemplo: um item de custo <strong>R$ 60,00</strong> teria preço sugerido de{" "}
              <strong>{formatCurrency(60 * summary.markup)}</strong>.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={!canManage || save.isPending} size="lg">
          <Save className="mr-1 h-4 w-4" />
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function PctField({
  label, hint, value, onChange, disabled,
}: {
  label: string; hint: string; value: string;
  onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <Label>
        {label} (%)
        <Hint>{hint}</Hint>
      </Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" disabled={disabled} />
    </div>
  );
}

// ============================================================
// Fixed costs detailed list
// ============================================================
function FixedCostsCard({
  canManage, items, total, onChange, upsertFn, deleteFn, onApplyTotal, currentTotalField, setCurrentTotalField,
}: {
  canManage: boolean;
  items: Array<{ id: string; name: string; category: string | null; amount: number; active: boolean }>;
  total: number;
  onChange: () => void;
  upsertFn: (args: any) => Promise<any>;
  deleteFn: (args: any) => Promise<any>;
  onApplyTotal: (total: number) => void;
  currentTotalField: string;
  setCurrentTotalField: (v: string) => void;
}) {
  const [nName, setNName] = useState("");
  const [nCat, setNCat] = useState("");
  const [nAmt, setNAmt] = useState("");

  const add = async () => {
    if (!nName.trim()) return toast.error("Informe o nome do custo.");
    const amount = Number(nAmt.replace(",", ".")) || 0;
    try {
      await upsertFn({ data: { name: nName.trim(), category: nCat.trim() || null, amount, active: true } });
      setNName(""); setNCat(""); setNAmt("");
      onChange();
      toast.success("Custo fixo adicionado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao adicionar.");
    }
  };

  const toggleActive = async (row: { id: string; name: string; category: string | null; amount: number; active: boolean }) => {
    try {
      await upsertFn({ data: { id: row.id, name: row.name, category: row.category, amount: row.amount, active: !row.active } });
      onChange();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este custo fixo?")) return;
    try {
      await deleteFn({ data: { id } });
      onChange();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span>2. Custos fixos mensais</span>
          <div className="flex items-center gap-2 text-sm font-normal">
            <span className="text-muted-foreground">Soma ativa:</span>
            <strong>{formatCurrency(total)}</strong>
            {total > 0 && Number(currentTotalField) !== total && (
              <Button type="button" size="sm" variant="outline" onClick={() => onApplyTotal(total)} disabled={!canManage}>
                Usar no cálculo
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Gastos que sua empresa tem todo mês, mesmo sem vender (aluguel, internet, contador, sistemas, salários administrativos, energia).
        </p>

        {items.length > 0 && (
          <div className="divide-y rounded-lg border">
            {items.map((r) => (
              <div key={r.id} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 p-3 text-sm ${!r.active ? "opacity-50" : ""}`}>
                <div>
                  <div className="font-medium">{r.name}</div>
                  {r.category && <div className="text-xs text-muted-foreground">{r.category}</div>}
                </div>
                <div className="font-semibold tabular-nums">{formatCurrency(Number(r.amount))}</div>
                <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} disabled={!canManage} />
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)} disabled={!canManage}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_1fr_140px_auto]">
            <Input placeholder="Nome (ex.: Aluguel)" value={nName} onChange={(e) => setNName(e.target.value)} />
            <Input placeholder="Categoria (opcional)" value={nCat} onChange={(e) => setNCat(e.target.value)} />
            <Input inputMode="decimal" placeholder="R$ 0,00" value={nAmt} onChange={(e) => setNAmt(e.target.value)} />
            <Button type="button" onClick={add}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
          </div>
        )}

        <div>
          <Label>
            Custos fixos totais usados no cálculo (R$)
            <Hint>Você pode preencher manualmente ou clicar em "Usar no cálculo" acima para puxar a soma da lista.</Hint>
          </Label>
          <Input
            inputMode="decimal"
            value={currentTotalField}
            onChange={(e) => setCurrentTotalField(e.target.value)}
            disabled={!canManage}
          />
        </div>
      </CardContent>
    </Card>
  );
}
