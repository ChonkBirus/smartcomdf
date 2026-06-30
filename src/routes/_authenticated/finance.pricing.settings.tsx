import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Info, Save } from "lucide-react";

import { PermissionRoute } from "@/components/app/PermissionRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/lib/permissions";
import {
  getCompanyCostSettings,
  updateCompanyCostSettings,
  type AllocationMethod,
} from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/finance/pricing/settings")({
  head: () => ({ meta: [{ title: "Configurações de custos — SmartCom Pro" }] }),
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
  default_desired_margin_rate: "30",
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

  const q = useQuery({
    queryKey: ["pricing-cost-settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const canViewCosts = q.data?.canViewCosts ?? false;

  useEffect(() => {
    const s = q.data?.settings;
    if (!s) return;
    setForm({
      monthly_fixed_costs_total: String(s.monthly_fixed_costs_total ?? 0),
      monthly_operational_costs_total: String(s.monthly_operational_costs_total ?? 0),
      expected_monthly_revenue:
        s.expected_monthly_revenue == null ? "" : String(s.expected_monthly_revenue),
      expected_monthly_sales_count:
        s.expected_monthly_sales_count == null ? "" : String(s.expected_monthly_sales_count),
      default_tax_rate: String((s.default_tax_rate ?? 0) * 100),
      default_card_fee_rate: String((s.default_card_fee_rate ?? 0) * 100),
      default_commission_rate: String((s.default_commission_rate ?? 0) * 100),
      default_warranty_reserve_rate: String((s.default_warranty_reserve_rate ?? 0) * 100),
      default_operational_cost_rate: String((s.default_operational_cost_rate ?? 0) * 100),
      default_fixed_cost_allocation_rate: String(
        (s.default_fixed_cost_allocation_rate ?? 0) * 100,
      ),
      default_desired_margin_rate: String((s.default_desired_margin_rate ?? 0.3) * 100),
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
          default_fixed_cost_allocation_rate:
            parseDec(form.default_fixed_cost_allocation_rate) / 100,
          default_desired_margin_rate: parseDec(form.default_desired_margin_rate) / 100,
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/finance">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao Financeiro
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Configurações de custos
          </h1>
          <p className="text-sm text-muted-foreground">
            Esses valores alimentam a sugestão automática de preço dos seus produtos.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custos da empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Custos fixos mensais (R$)
              <Hint>
                Despesas que sua empresa paga todo mês, como aluguel, internet, sistemas,
                salários administrativos e contador.
              </Hint>
            </Label>
            <Input
              inputMode="decimal"
              value={canViewCosts ? form.monthly_fixed_costs_total : "••••"}
              onChange={(e) => set("monthly_fixed_costs_total", e.target.value)}
              disabled={!canViewCosts || !canManage}
            />
          </div>
          <div>
            <Label>
              Custos operacionais mensais (R$)
              <Hint>
                Gastos para operar (combustível, manutenção de veículos, materiais de
                consumo, ferramentas que se desgastam).
              </Hint>
            </Label>
            <Input
              inputMode="decimal"
              value={canViewCosts ? form.monthly_operational_costs_total : "••••"}
              onChange={(e) => set("monthly_operational_costs_total", e.target.value)}
              disabled={!canViewCosts || !canManage}
            />
          </div>
          <div>
            <Label>
              Faturamento mensal esperado (R$)
              <Hint>Quanto sua empresa pretende faturar no mês. Usado para ratear custos.</Hint>
            </Label>
            <Input
              inputMode="decimal"
              value={canViewCosts ? form.expected_monthly_revenue : "••••"}
              onChange={(e) => set("expected_monthly_revenue", e.target.value)}
              disabled={!canViewCosts || !canManage}
            />
          </div>
          <div>
            <Label>
              Quantidade média de vendas/mês
              <Hint>
                Quantas vendas você costuma fechar por mês. Usado quando o rateio for por
                venda.
              </Hint>
            </Label>
            <Input
              inputMode="numeric"
              value={canViewCosts ? form.expected_monthly_sales_count : "••••"}
              onChange={(e) => set("expected_monthly_sales_count", e.target.value)}
              disabled={!canViewCosts || !canManage}
            />
          </div>
          <div>
            <Label>
              Método de rateio
              <Hint>
                Como diluir custos fixos em cada venda. Por % do faturamento ou valor fixo
                por venda.
              </Hint>
            </Label>
            <Select
              value={form.allocation_method}
              onValueChange={(v) => set("allocation_method", v as AllocationMethod)}
              disabled={!canManage}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT_OF_REVENUE">% do faturamento</SelectItem>
                <SelectItem value="FIXED_PER_SALE">Valor fixo por venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Percentuais padrão para precificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <PctField label="Imposto padrão" hint="Percentual médio de impostos sobre venda (ICMS, ISS, Simples...)." value={form.default_tax_rate} onChange={(v) => set("default_tax_rate", v)} disabled={!canManage} />
          <PctField label="Taxa de cartão" hint="Percentual cobrado pela operadora de cartão por venda." value={form.default_card_fee_rate} onChange={(v) => set("default_card_fee_rate", v)} disabled={!canManage} />
          <PctField label="Comissão" hint="Percentual de comissão pago ao vendedor ou parceiro." value={form.default_commission_rate} onChange={(v) => set("default_commission_rate", v)} disabled={!canManage} />
          <PctField label="Reserva de garantia" hint="Reserva para cobrir trocas, retornos e garantia." value={form.default_warranty_reserve_rate} onChange={(v) => set("default_warranty_reserve_rate", v)} disabled={!canManage} />
          <PctField label="Custo operacional" hint="Percentual de custo operacional embutido por venda." value={form.default_operational_cost_rate} onChange={(v) => set("default_operational_cost_rate", v)} disabled={!canManage} />
          <PctField label="Rateio de custo fixo" hint="Quanto do custo fixo mensal cada venda deve absorver, em %." value={form.default_fixed_cost_allocation_rate} onChange={(v) => set("default_fixed_cost_allocation_rate", v)} disabled={!canManage} />
          <PctField label="Margem desejada" hint="Percentual de lucro que você quer manter dentro do preço de venda." value={form.default_desired_margin_rate} onChange={(v) => set("default_desired_margin_rate", v)} disabled={!canManage} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={!canManage || save.isPending}>
          <Save className="mr-1 h-4 w-4" />
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
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
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        disabled={disabled}
      />
    </div>
  );
}
