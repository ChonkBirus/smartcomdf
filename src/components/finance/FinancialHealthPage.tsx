import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck, TrendingUp, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { getFinancialHealth, type FinancialHealthResult, type HealthStatus } from "@/lib/finance-health.functions";
import { useCompanyId } from "@/hooks/use-company-id";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusTone(status: HealthStatus): { ring: string; text: string; bg: string; label: string } {
  switch (status) {
    case "VERY_HEALTHY": return { ring: "ring-success", text: "text-success", bg: "bg-success/10", label: "Muito saudável" };
    case "HEALTHY":      return { ring: "ring-success/70", text: "text-success", bg: "bg-success/10", label: "Saudável" };
    case "ATTENTION":    return { ring: "ring-warning", text: "text-warning", bg: "bg-warning/10", label: "Atenção" };
    case "CRITICAL":     return { ring: "ring-destructive", text: "text-destructive", bg: "bg-destructive/10", label: "Crítico" };
    default:             return { ring: "ring-muted", text: "text-muted-foreground", bg: "bg-muted", label: "Dados insuficientes" };
  }
}

export function FinancialHealthScoreCard({ filters, compact = false }: {
  filters?: { from?: string; to?: string };
  compact?: boolean;
}) {
  const companyId = useCompanyId();
  const fn = useServerFn(getFinancialHealth);
  const q = useQuery({
    queryKey: ["fin-health", companyId, filters],
    queryFn: () => fn({ data: filters ?? {} }),
    enabled: !!companyId,
  });

  if (q.isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>;
  }
  if (q.isError || !q.data) {
    return <Card><CardContent className="p-4 text-sm text-muted-foreground">Não foi possível calcular a saúde financeira.</CardContent></Card>;
  }

  const h = q.data;
  const tone = statusTone(h.status);
  const pct = Math.round((h.score / h.maxScore) * 100);

  return (
    <Card className={`border ${tone.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full ring-4 ${tone.ring} ${tone.bg}`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${tone.text}`}>{h.score}</div>
              <div className="text-[10px] text-muted-foreground">/ {h.maxScore}</div>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Saúde Financeira</h3>
              <Badge variant="outline" className={`${tone.text} ${tone.bg} border-current`}>{h.statusLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{h.statusPhrase}</p>
            {!compact && h.attentions.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {h.attentions.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 text-warning shrink-0" /> {a}</li>
                ))}
              </ul>
            )}
            <div className="pt-2">
              <Progress value={pct} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CriterionRow({ c }: { c: FinancialHealthResult["criteria"][number] }) {
  const tone =
    c.status === "ok" ? "text-success" :
    c.status === "warn" ? "text-warning" :
    c.status === "bad" ? "text-destructive" :
    "text-muted-foreground";
  const Icon =
    c.status === "ok" ? CheckCircle2 :
    c.status === "warn" ? AlertTriangle :
    c.status === "bad" ? XCircle :
    Activity;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 ${tone}`} />
        <div>
          <div className="text-sm font-medium">{c.label}</div>
          <div className="text-xs text-muted-foreground">{c.detail}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold ${tone}`}>{c.score}/{c.maxScore}</div>
      </div>
    </div>
  );
}

function AlertCard({ a }: { a: FinancialHealthResult["alerts"][number] }) {
  const sevTone =
    a.severity === "P0" || a.severity === "P1" ? "border-destructive/40 bg-destructive/5" :
    a.severity === "P2" ? "border-warning/40 bg-warning/5" :
    "border-muted bg-muted/30";
  return (
    <Alert className={sevTone}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {a.title}
        <Badge variant="outline" className="text-[10px]">{a.severity}</Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-1">
          <p>{a.explanation}</p>
          <p className="text-xs"><strong>Ação recomendada:</strong> {a.recommendation}</p>
          {a.actionLink && (
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to={a.actionLink as never}>{a.actionLabel ?? "Ver"} <ChevronRight className="h-3 w-3" /></Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function FinancialHealthPage({ filters }: { filters?: { from?: string; to?: string } }) {
  const companyId = useCompanyId();
  const fn = useServerFn(getFinancialHealth);
  const q = useQuery({
    queryKey: ["fin-health", companyId, filters],
    queryFn: () => fn({ data: filters ?? {} }),
    enabled: !!companyId,
  });

  const h = q.data;
  const showCosts = useMemo(() => h && h.dataUsed.desiredMarginRate !== null, [h]);

  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (q.isError) return <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{(q.error as any)?.message ?? "Falha ao carregar saúde financeira."}</AlertDescription></Alert>;
  if (!h) return null;

  if (h.insufficientData) {
    return (
      <div className="space-y-4">
        <FinancialHealthScoreCard filters={filters} />
        <EmptyState
          icon={<Activity className="h-5 w-5" />}
          title="Ainda não há dados financeiros suficientes"
          description="Cadastre entradas, saídas, custos dos produtos e orçamentos para acompanhar a saúde financeira da empresa."
        />
      </div>
    );
  }

  const d = h.dataUsed;

  return (
    <div className="space-y-6">
      <FinancialHealthScoreCard filters={filters} />

      {h.alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">O que corrigir primeiro</h2>
          <p className="text-sm text-muted-foreground">Ordenado por impacto no seu caixa.</p>
          <div className="grid gap-3">
            {h.alerts.map((a) => <AlertCard key={a.id} a={a} />)}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-success" /> Pontos positivos</h3>
          {h.positives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <ul className="space-y-1">
              {h.positives.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> {p}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Pontos de atenção</h3>
          {h.attentions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo certo.</p>
          ) : (
            <ul className="space-y-1">
              {h.attentions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-warning" /> {a}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Critérios do score</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {h.criteria.map((c) => <CriterionRow key={c.key} c={c} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-4 w-4" /> Dados usados no cálculo</h2>
        <Card>
          <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2 md:grid-cols-3">
            <Info label="Período" value={`${d.period.from} → ${d.period.to}`} />
            <Info label="Entradas (pago)" value={BRL(d.incomeTotal)} />
            <Info label="Saídas (pago)" value={BRL(d.expenseTotal)} />
            <Info label="Saldo" value={BRL(d.balance)} />
            <Info label="A receber em aberto" value={BRL(d.receivablesOpen)} />
            <Info label="A pagar em aberto" value={BRL(d.payablesOpen)} />
            <Info label="Recebimentos atrasados" value={`${d.overdueReceivables} (${BRL(d.overdueReceivablesAmount)})`} />
            <Info label="Contas vencidas" value={`${d.overduePayables} (${BRL(d.overduePayablesAmount)})`} />
            <Info label="Caixa projetado 30d" value={BRL(d.projected30dBalance)} />
            <Info label="Produtos ativos" value={String(d.productsTotal)} />
            <Info label="Sem custo" value={String(d.productsWithoutCost)} />
            {showCosts && <Info label="Abaixo do preço sugerido" value={String(d.underpricedProducts)} />}
            {showCosts && d.desiredMarginRate !== null && <Info label="Meta de margem" value={`${(d.desiredMarginRate * 100).toFixed(1)}%`} />}
            {showCosts && d.estimatedMarginRate !== null && <Info label="Margem estimada" value={`${(d.estimatedMarginRate * 100).toFixed(1)}%`} />}
            <Info label="Lançamentos sem categoria" value={String(d.uncategorizedTransactions)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
