import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Rocket, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ForbiddenPage } from "@/components/app/PermissionRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/lib/permissions";
import { useCompanyId } from "@/hooks/use-company-id";
import {
  getProfitBoosterBaseline,
  type ProfitBoosterBaseline,
} from "@/lib/profit-booster.functions";

type Months = 3 | 6 | 12;

function safe(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n;
}

function pctText(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function deltaColor(delta: number, kind: "good-up" | "good-down") {
  if (delta === 0) return "text-muted-foreground";
  const up = delta > 0;
  const good = kind === "good-up" ? up : !up;
  return good ? "text-emerald-600" : "text-rose-600";
}

export function ProfitBoosterPage() {
  const { can } = usePermissions();
  const canView = can("finance", "view");
  const canCosts = can("finance", "view_costs");

  if (!canView || !canCosts) {
    return (
      <ForbiddenPage message="Você precisa da permissão finance.view_costs para acessar o Turbinador de Lucros." />
    );
  }
  return <ProfitBoosterInner />;
}

function ProfitBoosterInner() {
  const [months, setMonths] = useState<Months>(3);
  const [volume, setVolume] = useState(0); // %
  const [price, setPrice] = useState(0); // %
  const [varCost, setVarCost] = useState(0); // %
  const [fixedReduction, setFixedReduction] = useState(0); // R$

  const companyId = useCompanyId();
  const fn = useServerFn(getProfitBoosterBaseline);

  const q = useQuery({
    queryKey: ["profit-booster-baseline", companyId, months],
    queryFn: () => fn({ data: { months } }),
    enabled: !!companyId,
  });

  const reset = () => {
    setVolume(0);
    setPrice(0);
    setVarCost(0);
    setFixedReduction(0);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Turbinador de Lucros"
        description="Simule aumentar vendas, ajustar preço ou reduzir custos e veja o impacto no seu lucro."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="min-w-[220px]">
            <Label className="mb-1 block text-xs">Período base</Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v) as Months)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Resetar simulação
          </Button>
        </CardContent>
      </Card>

      {q.isLoading && (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
      )}
      {q.isError && (
        <div className="py-8 text-center text-sm text-destructive">Erro ao carregar dados.</div>
      )}

      {q.data && (
        <BoosterBody
          baseline={q.data}
          months={months}
          volume={volume}
          setVolume={setVolume}
          price={price}
          setPrice={setPrice}
          varCost={varCost}
          setVarCost={setVarCost}
          fixedReduction={fixedReduction}
          setFixedReduction={setFixedReduction}
        />
      )}
    </div>
  );
}

function BoosterBody({
  baseline,
  months,
  volume,
  setVolume,
  price,
  setPrice,
  varCost,
  setVarCost,
  fixedReduction,
  setFixedReduction,
}: {
  baseline: ProfitBoosterBaseline;
  months: Months;
  volume: number;
  setVolume: (n: number) => void;
  price: number;
  setPrice: (n: number) => void;
  varCost: number;
  setVarCost: (n: number) => void;
  fixedReduction: number;
  setFixedReduction: (n: number) => void;
}) {
  if (!baseline.hasAnyPaidLast12Months) {
    return (
      <EmptyState
        icon={<Rocket className="h-6 w-6" />}
        title="Sem histórico suficiente para simular"
        description="Registre pelo menos 1 mês de movimentações pagas."
        action={
          <Button asChild>
            <Link to="/finance/transactions">Ir para Movimentações</Link>
          </Button>
        }
      />
    );
  }

  const { avgIncome, avgExpense, avgVariableExpense, monthlyFixedCosts, avgProfit, avgMargin } =
    baseline;

  const clampedFixedRed = Math.min(Math.max(0, fixedReduction), monthlyFixedCosts);

  const compute = (vol: number, pr: number, vc: number, fixedRed: number) => {
    const receita = safe(avgIncome * (1 + vol / 100) * (1 + pr / 100));
    const despVar = Math.max(0, safe(avgVariableExpense * (1 + vol / 100) * (1 + vc / 100)));
    const custoFixo = Math.max(
      0,
      monthlyFixedCosts - Math.min(Math.max(0, fixedRed), monthlyFixedCosts),
    );
    const despTot = despVar + custoFixo;
    const lucro = receita - despTot;
    const margem = receita > 0 ? (lucro / receita) * 100 : null;
    return { receita, despVar, custoFixo, despTot, lucro, margem };
  };

  const atual = {
    receita: avgIncome,
    despVar: avgVariableExpense,
    custoFixo: monthlyFixedCosts,
    despTot: avgVariableExpense + monthlyFixedCosts,
    lucro: avgProfit,
    margem: avgMargin,
  };
  const sim = compute(volume, price, varCost, clampedFixedRed);

  // Top 3 recommendations — isolate each lever using its current value
  const recs = useMemo(() => {
    const items: { label: string; gain: number }[] = [];
    if (volume !== 0) {
      const s = compute(volume, 0, 0, 0);
      items.push({
        label: `${volume > 0 ? "Aumentar" : "Reduzir"} volume em ${Math.abs(volume)}%`,
        gain: s.lucro - atual.lucro,
      });
    }
    if (price !== 0) {
      const s = compute(0, price, 0, 0);
      items.push({
        label: `${price > 0 ? "Aumentar" : "Reduzir"} preço médio em ${Math.abs(price)}%`,
        gain: s.lucro - atual.lucro,
      });
    }
    if (varCost !== 0) {
      const s = compute(0, 0, varCost, 0);
      items.push({
        label: `${varCost > 0 ? "Aumentar" : "Reduzir"} custos variáveis em ${Math.abs(varCost)}%`,
        gain: s.lucro - atual.lucro,
      });
    }
    if (clampedFixedRed > 0) {
      const s = compute(0, 0, 0, clampedFixedRed);
      items.push({
        label: `Reduzir custo fixo em ${formatCurrency(clampedFixedRed)}/mês`,
        gain: s.lucro - atual.lucro,
      });
    }
    return items.sort((a, b) => b.gain - a.gain).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, price, varCost, clampedFixedRed, avgIncome, avgVariableExpense, monthlyFixedCosts]);

  return (
    <>
      {!baseline.fixedCostsConfigured && (
        <Alert>
          <AlertTitle>Configure seus custos fixos</AlertTitle>
          <AlertDescription>
            Configure seus custos fixos para melhorar a precisão do Turbinador de Lucros.{" "}
            <Link to="/finance/costs" className="underline">
              Ir para Custos
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Situação atual */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Situação atual (média mensal — últimos {months} meses)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Faturamento médio mensal" value={formatCurrency(avgIncome)} />
          <KpiCard label="Despesa média mensal" value={formatCurrency(avgExpense)} />
          <KpiCard label="Custo fixo mensal" value={formatCurrency(monthlyFixedCosts)} />
          <KpiCard label="Despesa variável estimada" value={formatCurrency(avgVariableExpense)} />
          <KpiCard label="Lucro médio" value={formatCurrency(avgProfit)} />
          <KpiCard label="Margem média" value={pctText(avgMargin)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          As despesas variáveis são estimadas subtraindo os custos fixos configurados da despesa
          média mensal.
        </p>
      </section>

      {/* 3. Alavancas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alavancas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <LeverSlider
            label="Volume de vendas"
            value={volume}
            onChange={setVolume}
            min={-50}
            max={100}
            suffix="%"
          />
          <LeverSlider
            label="Preço médio"
            value={price}
            onChange={setPrice}
            min={-30}
            max={50}
            suffix="%"
          />
          <LeverSlider
            label="Custos variáveis"
            value={varCost}
            onChange={setVarCost}
            min={-50}
            max={50}
            suffix="%"
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Redução de custo fixo mensal (R$)</Label>
              <Input
                type="number"
                min={0}
                max={monthlyFixedCosts}
                value={fixedReduction}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFixedReduction(
                    Number.isFinite(v) ? Math.min(Math.max(0, v), monthlyFixedCosts) : 0,
                  );
                }}
                className="w-32"
                disabled={monthlyFixedCosts <= 0}
              />
            </div>
            <Slider
              min={0}
              max={Math.max(1, monthlyFixedCosts)}
              step={Math.max(1, Math.round(monthlyFixedCosts / 100))}
              value={[Math.min(fixedReduction, monthlyFixedCosts)]}
              onValueChange={(v) => setFixedReduction(v[0] ?? 0)}
              disabled={monthlyFixedCosts <= 0}
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {formatCurrency(monthlyFixedCosts)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            O volume também altera os custos variáveis, pois vender mais normalmente aumenta parte
            dos custos operacionais.
          </p>
        </CardContent>
      </Card>

      {/* 4. Impacto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impacto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Indicador</th>
                  <th className="py-2 text-right">Atual</th>
                  <th className="py-2 text-right">Simulado</th>
                  <th className="py-2 text-right">Δ R$</th>
                  <th className="py-2 text-right">Δ %</th>
                </tr>
              </thead>
              <tbody>
                <ImpactRow
                  label="Receita mensal"
                  a={atual.receita}
                  b={sim.receita}
                  kind="good-up"
                />
                <ImpactRow
                  label="Despesa variável mensal"
                  a={atual.despVar}
                  b={sim.despVar}
                  kind="good-down"
                />
                <ImpactRow
                  label="Custo fixo mensal"
                  a={atual.custoFixo}
                  b={sim.custoFixo}
                  kind="good-down"
                />
                <ImpactRow
                  label="Despesa total mensal"
                  a={atual.despTot}
                  b={sim.despTot}
                  kind="good-down"
                />
                <ImpactRow label="Lucro mensal" a={atual.lucro} b={sim.lucro} kind="good-up" />
                <ImpactRowPct label="Margem" a={atual.margem} b={sim.margem} />
                <ImpactRow
                  label="Projeção de lucro (12 meses)"
                  a={atual.lucro * 12}
                  b={sim.lucro * 12}
                  kind="good-up"
                />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5. Top 3 recomendações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 3 recomendações</CardTitle>
        </CardHeader>
        <CardContent>
          {recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Movimente as alavancas para ver recomendações.
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {recs.map((r, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border p-3">
                  <span>
                    {i + 1}. {r.label}
                  </span>
                  <span className={deltaColor(r.gain, "good-up")}>
                    {r.gain >= 0 ? "+" : ""}
                    {formatCurrency(r.gain)}/mês
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function LeverSlider({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Number.isFinite(v) ? Math.min(Math.max(min, v), max) : 0);
          }}
          className="w-24"
        />
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
      <p className="text-[11px] text-muted-foreground">
        {min}
        {suffix} … {max}
        {suffix} · atual: {value}
        {suffix}
      </p>
    </div>
  );
}

function ImpactRow({
  label,
  a,
  b,
  kind,
}: {
  label: string;
  a: number;
  b: number;
  kind: "good-up" | "good-down";
}) {
  const delta = b - a;
  const pct = a !== 0 ? (delta / Math.abs(a)) * 100 : null;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;
  return (
    <tr className="border-b">
      <td className="py-2">{label}</td>
      <td className="py-2 text-right">{formatCurrency(a)}</td>
      <td className="py-2 text-right font-medium">{formatCurrency(b)}</td>
      <td className={`py-2 text-right ${deltaColor(delta, kind)}`}>
        <span className="inline-flex items-center gap-1">
          {Icon && <Icon className="h-3 w-3" />}
          {delta >= 0 ? "+" : ""}
          {formatCurrency(delta)}
        </span>
      </td>
      <td className={`py-2 text-right ${deltaColor(delta, kind)}`}>
        {pct === null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
      </td>
    </tr>
  );
}

function ImpactRowPct({ label, a, b }: { label: string; a: number | null; b: number | null }) {
  const delta = a !== null && b !== null ? b - a : null;
  return (
    <tr className="border-b">
      <td className="py-2">{label}</td>
      <td className="py-2 text-right">{pctText(a)}</td>
      <td className="py-2 text-right font-medium">{pctText(b)}</td>
      <td
        className={`py-2 text-right ${delta === null ? "text-muted-foreground" : deltaColor(delta, "good-up")}`}
      >
        {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} p.p.`}
      </td>
      <td className="py-2 text-right text-muted-foreground">—</td>
    </tr>
  );
}
