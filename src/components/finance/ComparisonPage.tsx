import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, GitCompare, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/lib/permissions";
import { getFinancialComparison } from "@/lib/finance-comparison.functions";
import { Route as ComparisonRoute } from "@/routes/_authenticated/finance.comparison";

export type Preset = "this_month" | "this_year" | "last_30" | "last_90" | "custom";

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfYear(d: Date) { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d: Date) { return new Date(d.getFullYear(), 11, 31); }
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;
}

export function resolvePreset(preset: Preset, today = new Date()): { aFrom: string; aTo: string; bFrom: string; bTo: string } | null {
  if (preset === "this_month") {
    const aF = startOfMonth(today), aT = endOfMonth(today);
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { aFrom: toISO(aF), aTo: toISO(aT), bFrom: toISO(startOfMonth(prev)), bTo: toISO(endOfMonth(prev)) };
  }
  if (preset === "this_year") {
    const aF = startOfYear(today), aT = endOfYear(today);
    const prev = new Date(today.getFullYear() - 1, 0, 1);
    return { aFrom: toISO(aF), aTo: toISO(aT), bFrom: toISO(startOfYear(prev)), bTo: toISO(endOfYear(prev)) };
  }
  if (preset === "last_30") {
    const aT = today, aF = addDays(today, -29);
    const bT = addDays(aF, -1), bF = addDays(bT, -29);
    return { aFrom: toISO(aF), aTo: toISO(aT), bFrom: toISO(bF), bTo: toISO(bT) };
  }
  if (preset === "last_90") {
    const aT = today, aF = addDays(today, -89);
    const bT = addDays(aF, -1), bF = addDays(bT, -89);
    return { aFrom: toISO(aF), aTo: toISO(aT), bFrom: toISO(bF), bTo: toISO(bT) };
  }
  return null;
}

function DeltaPill({ a, b, invert = false }: { a: number; b: number; invert?: boolean }) {
  if (a === 0 && b === 0) return <span className="text-muted-foreground">—</span>;
  const abs = a - b;
  const isNew = b === 0 && a > 0;
  const pct = isNew ? null : (abs / Math.abs(b)) * 100;
  const positive = abs > 0;
  const good = invert ? !positive : positive;
  const zero = abs === 0;
  const color = zero ? "text-muted-foreground" : good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const Icon = zero ? ArrowRight : positive ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {isNew ? "novo" : `${abs >= 0 ? "+" : ""}${formatCurrency(abs)}`}
      {pct !== null && !zero && (
        <span className="text-xs opacity-80">({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)</span>
      )}
    </span>
  );
}

function KpiCard({ title, a, b, invert = false }: { title: string; a: number; b: number; invert?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Período A</div>
            <div className="text-xl font-bold">{formatCurrency(a)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Período B</div>
            <div className="text-base font-medium text-muted-foreground">{formatCurrency(b)}</div>
          </div>
        </div>
        <DeltaPill a={a} b={b} invert={invert} />
      </CardContent>
    </Card>
  );
}

export function ComparisonPage() {
  const { can } = usePermissions();
  const canSeeMargin = can("finance", "view_costs");
  const search = ComparisonRoute.useSearch();
  const navigate = useNavigate({ from: ComparisonRoute.fullPath });
  const getComparison = useServerFn(getFinancialComparison);

  const range = useMemo(() => {
    if (search.preset && search.preset !== "custom") {
      const r = resolvePreset(search.preset as Preset);
      if (r) return r;
    }
    if (search.aFrom && search.aTo && search.bFrom && search.bTo) {
      return { aFrom: search.aFrom, aTo: search.aTo, bFrom: search.bFrom, bTo: search.bTo };
    }
    return resolvePreset("this_month")!;
  }, [search]);

  const q = useQuery({
    queryKey: ["finance-comparison", range.aFrom, range.aTo, range.bFrom, range.bTo],
    queryFn: () => getComparison({ data: range }),
  });

  const setPreset = (p: Preset) => {
    if (p === "custom") {
      navigate({ search: (prev) => ({ ...prev, preset: "custom", aFrom: range.aFrom, aTo: range.aTo, bFrom: range.bFrom, bTo: range.bTo }) });
      return;
    }
    const r = resolvePreset(p)!;
    navigate({ search: () => ({ preset: p, aFrom: r.aFrom, aTo: r.aTo, bFrom: r.bFrom, bTo: r.bTo }) });
  };

  const updateCustom = (field: "aFrom" | "aTo" | "bFrom" | "bTo", value: string) => {
    navigate({ search: (prev) => ({ ...prev, preset: "custom", [field]: value, aFrom: prev.aFrom ?? range.aFrom, aTo: prev.aTo ?? range.aTo, bFrom: prev.bFrom ?? range.bFrom, bTo: prev.bTo ?? range.bTo }) });
  };

  const data = q.data;
  const aDays = daysBetween(range.aFrom, range.aTo);
  const bDays = daysBetween(range.bFrom, range.bTo);
  const showMonthly = aDays >= 60 && bDays >= 60;
  const isEmpty = data && data.a.income === 0 && data.a.expense === 0 && data.b.income === 0 && data.b.expense === 0;

  const marginA = data && data.a.income > 0 ? (data.a.balance / data.a.income) * 100 : null;
  const marginB = data && data.b.income > 0 ? (data.b.balance / data.b.income) * 100 : null;

  const incomeCats = (data?.byCategory ?? []).filter((r) => r.type === "INCOME");
  const expenseCats = (data?.byCategory ?? []).filter((r) => r.type === "EXPENSE");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Comparativo financeiro"
        description="Compare receitas, despesas e saldo entre dois períodos. Considera apenas transações pagas (paid_at)."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <Label className="mb-1 block text-xs">Preset</Label>
              <Select value={(search.preset ?? "this_month") as string} onValueChange={(v) => setPreset(v as Preset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">Este mês vs mês anterior</SelectItem>
                  <SelectItem value="this_year">Este ano vs ano anterior</SelectItem>
                  <SelectItem value="last_30">Últimos 30d vs 30d anteriores</SelectItem>
                  <SelectItem value="last_90">Últimos 90d vs 90d anteriores</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-semibold">Período A</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={range.aFrom} onChange={(e) => updateCustom("aFrom", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={range.aTo} onChange={(e) => updateCustom("aTo", e.target.value)} />
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{aDays} dias</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-semibold">Período B (base)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={range.bFrom} onChange={(e) => updateCustom("bFrom", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={range.bTo} onChange={(e) => updateCustom("bTo", e.target.value)} />
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{bDays} dias</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {q.isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando comparativo…</div>}
      {q.isError && <div className="py-8 text-center text-sm text-destructive">Erro ao carregar comparativo.</div>}

      {data && isEmpty && (
        <EmptyState
          icon={<GitCompare className="h-6 w-6" />}
          title="Nenhuma movimentação realizada encontrada nos períodos selecionados."
          description="O comparativo considera apenas transações com status PAID e data de caixa (paid_at) dentro dos períodos escolhidos."
          action={
            <Button asChild variant="outline">
              <Link to="/finance/transactions"><Wallet className="mr-2 h-4 w-4" />Ir para Movimentações</Link>
            </Button>
          }
        />
      )}

      {data && !isEmpty && (
        <>
          <div className={`grid gap-4 ${canSeeMargin ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            <KpiCard title="Receitas realizadas" a={data.a.income} b={data.b.income} />
            <KpiCard title="Despesas realizadas" a={data.a.expense} b={data.b.expense} invert />
            <KpiCard title="Saldo (receitas − despesas)" a={data.a.balance} b={data.b.balance} />
            {canSeeMargin && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Margem financeira</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Período A</div>
                      <div className="text-xl font-bold">{marginA === null ? "—" : `${marginA.toFixed(1)}%`}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Período B</div>
                      <div className="text-base font-medium text-muted-foreground">{marginB === null ? "—" : `${marginB.toFixed(1)}%`}</div>
                    </div>
                  </div>
                  {marginA !== null && marginB !== null ? (
                    <div className={`text-sm font-medium ${marginA - marginB >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {marginA - marginB >= 0 ? "+" : ""}{(marginA - marginB).toFixed(1)} p.p.
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">—</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle>Detalhamento</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="category">
                <TabsList>
                  <TabsTrigger value="category">Por categoria</TabsTrigger>
                  <TabsTrigger value="month" disabled={!showMonthly}>
                    Por mês {!showMonthly && <Badge variant="outline" className="ml-2 text-[10px]">≥ 60 dias</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="category" className="space-y-6">
                  <CategoryTable title="Receitas" rows={incomeCats} />
                  <Separator />
                  <CategoryTable title="Despesas" rows={expenseCats} invert />
                </TabsContent>

                <TabsContent value="month">
                  {showMonthly && (
                    <div className="space-y-6">
                      <div className="h-80 w-full">
                        <ResponsiveContainer>
                          <BarChart data={data.byMonth}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(v) => formatCurrency(Number(v))} width={100} />
                            <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                            <Legend />
                            <Bar dataKey="a_income" name="Receita A" fill="hsl(var(--primary))" />
                            <Bar dataKey="b_income" name="Receita B" fill="hsl(var(--muted-foreground))" />
                            <Bar dataKey="a_expense" name="Despesa A" fill="hsl(var(--destructive))" />
                            <Bar dataKey="b_expense" name="Despesa B" fill="hsl(var(--border))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Mês</TableHead>
                            <TableHead className="text-right">Receita A</TableHead>
                            <TableHead className="text-right">Receita B</TableHead>
                            <TableHead className="text-right">Despesa A</TableHead>
                            <TableHead className="text-right">Despesa B</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.byMonth.map((m) => (
                            <TableRow key={m.month}>
                              <TableCell>{m.month}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.a_income)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.b_income)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.a_expense)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(m.b_expense)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function CategoryTable({ title, rows, invert = false }: { title: string; rows: Array<{ category_id: string | null; name: string; a: number; b: number; deltaAbs: number }>; invert?: boolean }) {
  if (rows.length === 0) {
    return (
      <div>
        <div className="mb-2 text-sm font-semibold">{title}</div>
        <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">Sem dados nos períodos selecionados.</div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Período A</TableHead>
            <TableHead className="text-right">Período B</TableHead>
            <TableHead className="text-right">Δ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.category_id ?? "none"}-${r.name}`}>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.a)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatCurrency(r.b)}</TableCell>
              <TableCell className="text-right"><DeltaPill a={r.a} b={r.b} invert={invert} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
